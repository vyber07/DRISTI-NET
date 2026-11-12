from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import Response
from fastapi import Response as FastAPIResponse
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from starlette.requests import ClientDisconnect

from .. import config
from ..auth import authorize_case, current_user, require_roles
from ..db import get_db
from ..models import Claim, Evidence, Job, User
from ..schemas import ContextRevealIn, DownloadIn, EvidenceOut

from ..services import extract as extract_svc
from ..services import pipeline, storage
from ..services import masking_policy, upload_policy
from ..services.audit import record_audit, record_read
from ..services.evidence_service import build_context_window, mark_object_missing
from ..services.masking import mask_text
from .graph_routes import claim_out
from .listing import MAX_LIMIT, like_pattern, page

router = APIRouter(tags=["evidence"])


def _reject(db: Session, trace: str, user: User, case_id: str, filename: str | None, exc: upload_policy.UploadRejected,
            size_hint: int | None = None):
    """Audit and report a refused upload. The message is the uploader-facing reason; the code feeds monitoring."""
    upload_policy.note_rejection(exc.code, case_id=case_id)
    record_audit(db, trace, user.user_id, "EVIDENCE_UPLOAD", "FILE", (filename or "")[:120], case_id, outcome="DENIED",
                 detail={"reason": exc.message, "code": exc.code, **({"declared_bytes": size_hint} if size_hint else {})})
    db.commit()
    headers = {"Retry-After": "30"} if exc.status == 429 else None
    raise HTTPException(exc.status, f"upload rejected: {exc.message}", headers=headers)


def _ingest(db: Session, request: Request, user: User, case, st: "upload_policy.Staged", source_label: str, process: bool) -> dict:
    """Shared tail of both upload routes, for a staged and validated file: duplicate check on the SHA-256, evidence row,
    move into quarantine (no read into memory), audit, commit. On any failure the staging file and any stored
    object are removed, so no partial evidence survives. Quarantine, scanning and promotion are unchanged."""
    trace = request.state.trace_id
    case_id = case.case_id
    try:
        prior = db.query(Evidence).filter_by(case_id=case_id, sha256=st.sha256).first()
        if prior:
            record_audit(db, trace, user.user_id, "EVIDENCE_UPLOAD_DUPLICATE", "EVIDENCE", prior.evidence_id, case_id,
                         detail={"sha256": st.sha256, "size": st.size})
            db.commit()  # DEF-045
            return evidence_out(prior, db)
        ev = Evidence(case_id=case_id, version=1, filename=st.filename, extension=st.ext, detected_type=st.mime,
                      size_bytes=st.size, sha256=st.sha256, status="UPLOADED", storage_path="pending", source_label=source_label,
                      record_type=st.record_type, uploaded_by=user.user_id,
                      # Snapshot of the case's own governance fields at the moment of acceptance (docs/context.md §9.2).
                      classification=case.classification, jurisdiction=case.jurisdiction, purpose=case.purpose,
                      access_class=case.sensitivity, authority_reference=case.authority_reference)
        db.add(ev)
        try:
            db.flush()
        except IntegrityError as exc:  # a concurrent upload of the same file won the race
            if "uix_evidence_case_sha" not in str(exc) and "UNIQUE constraint failed: evidence.case_id, evidence.sha256" not in str(exc):
                raise
            db.rollback()
            prior = db.query(Evidence).filter_by(case_id=case_id, sha256=st.sha256).first()
            record_audit(db, trace, user.user_id, "EVIDENCE_UPLOAD_DUPLICATE", "EVIDENCE", prior.evidence_id, case_id,
                         detail={"sha256": st.sha256, "size": st.size, "concurrent": True})
            db.commit()  # DEF-045
            return evidence_out(prior, db)
        ev.status = "HASHED"
        try:
            ev.storage_path = storage.store_quarantine_file(case_id, ev.evidence_id, st.filename, st.path)
        except Exception as exc:  # DEF-044: object store unreachable -> no row, controlled 503
            db.rollback()
            upload_policy.note_rejection("STORAGE_UNAVAILABLE", case_id=case_id)
            record_audit(db, trace, user.user_id, "EVIDENCE_UPLOAD", "FILE", st.filename, case_id, outcome="ERROR",
                         detail={"reason": "evidence storage unavailable", "code": "STORAGE_UNAVAILABLE", "error": type(exc).__name__})
            db.commit()
            raise HTTPException(503, "evidence storage is unavailable; the upload was not accepted")
        ev.status = "QUARANTINED"
        record_audit(db, trace, user.user_id, "EVIDENCE_UPLOAD", "EVIDENCE", ev.evidence_id, case_id,
                     detail={"filename": st.filename, "sha256": st.sha256, "size": st.size, "category": st.category,
                             "detected_type": st.mime, "duplicate_of": None})
        try:
            db.commit()
        except Exception:
            db.rollback()
            storage.discard_uncommitted(ev.storage_path)  # the row never existed, so neither may the object
            raise
        upload_policy.METRICS.accepted += 1
        upload_policy.METRICS.accepted_bytes += st.size
    finally:
        st.path.unlink(missing_ok=True)  # moved already on success; removes it on every failure path
    if process:
        pipeline.process_evidence(db, ev.evidence_id, trace, user.user_id)
        db.refresh(ev)
    return evidence_out(ev, db)


def evidence_out(ev: Evidence, db: Session | None = None) -> dict:
    d = {"evidence_id": ev.evidence_id, "case_id": ev.case_id, "version": ev.version, "filename": ev.filename, "extension": ev.extension,
         "detected_type": ev.detected_type, "record_type": ev.record_type, "size_bytes": ev.size_bytes, "sha256": ev.sha256,
         "status": ev.status, "storage_area": ev.storage_path.split("/", 1)[0], "source_label": ev.source_label, "uploaded_by": ev.uploaded_by,
         "scan_engine": ev.scan_engine, "scan_result": ev.scan_result, "error": ev.error, "retention_policy": ev.retention_policy,
         "legal_hold": ev.legal_hold, "tombstoned": ev.tombstoned, "created_at": ev.created_at.isoformat(), "updated_at": ev.updated_at.isoformat(),
         "classification": ev.classification, "jurisdiction": ev.jurisdiction, "purpose": ev.purpose, "access_class": ev.access_class,
         "authority_reference": ev.authority_reference}
    if db is not None:
        d["jobs"] = [{"job_id": j.job_id, "kind": j.kind, "status": j.status, "attempts": j.attempts, "trace_id": j.trace_id, "error": j.error, "metrics": j.metrics}
                     for j in db.query(Job).filter_by(evidence_id=ev.evidence_id).order_by(Job.created_at).all()]
        d["claim_count"] = db.query(Claim).filter_by(evidence_id=ev.evidence_id).count()
    return d


@router.post("/cases/{case_id}/evidence", status_code=201, response_model=EvidenceOut)
async def upload(case_id: str, request: Request, file: UploadFile = File(...), source_label: str = Form("synthetic"),
                 process: bool = Form(True),
                 user: User = Depends(require_roles("EVIDENCE_OFFICER", "INVESTIGATOR", "ADMIN", action="upload")), db: Session = Depends(get_db, scope="function")):
    """Multipart upload: stage → validate → UPLOADED → HASHED → QUARANTINED (→ optional immediate processing).
    Capped at the smaller of MAX_UPLOAD_MB and the category limit. Large evidence uses POST .../evidence/stream."""
    case = authorize_case(db, user, case_id, request, action="EVIDENCE_UPLOAD")
    trace = request.state.trace_id
    filename = file.filename or ""
    try:
        with upload_policy.upload_slot():
            policies = upload_policy.effective_policies(db)
            ext, category, pol = upload_policy.classify(filename, policies)
            upload_policy.check_capacity(None)
            limit = min(pol["max_bytes"], config.MAX_UPLOAD_MB * 1024 * 1024)
            st = await upload_policy.stage(upload_policy.iter_upload_file(file), filename, ext, category, limit)
            try:
                upload_policy.validate_staged(st)
            except upload_policy.UploadRejected:
                st.path.unlink(missing_ok=True)
                raise
            return _ingest(db, request, user, case, st, source_label, process)
    except upload_policy.UploadRejected as exc:
        _reject(db, trace, user, case_id, filename, exc)


@router.post("/cases/{case_id}/evidence/stream", status_code=201, response_model=EvidenceOut)
async def upload_stream(case_id: str, request: Request, filename: str = Query(..., max_length=120),
                        source_label: str = Query("manual upload", max_length=120), process: bool = Query(True),
                        user: User = Depends(require_roles("EVIDENCE_OFFICER", "INVESTIGATOR", "ADMIN", action="upload")),
                        db: Session = Depends(get_db, scope="function")):
    """Streaming upload for evidence of any size the policy allows (CCTV, disk images). The raw request body is the
    file (Content-Type application/octet-stream). Content-Length is required and checked against the category limit
    before a byte is read; bytes go straight to staging while being hashed, so memory use is constant. Roles, case
    access, file-name, signature and content checks are the same as the multipart route."""
    case = authorize_case(db, user, case_id, request, action="EVIDENCE_UPLOAD")
    trace = request.state.trace_id
    length_header = request.headers.get("content-length")
    try:
        if not length_header or not length_header.isdigit():
            raise upload_policy.UploadRejected(411, "LENGTH_REQUIRED", "Content-Length is required for streaming uploads")
        declared = int(length_header)
        with upload_policy.upload_slot():
            policies = upload_policy.effective_policies(db)
            ext, category, pol = upload_policy.classify(filename, policies)
            if declared > pol["max_bytes"]:
                raise upload_policy.UploadRejected(413, "TOO_LARGE", f"file exceeds the {category.lower()} limit of {pol['max_mb']} MB")
            upload_policy.check_capacity(declared)
            try:
                st = await upload_policy.stage(request.stream(), filename, ext, category, pol["max_bytes"], expected_length=declared)
            except ClientDisconnect:
                raise upload_policy.UploadRejected(400, "INTERRUPTED", "upload was interrupted; nothing was stored")
            try:
                upload_policy.validate_staged(st)
            except upload_policy.UploadRejected:
                st.path.unlink(missing_ok=True)
                raise
            return _ingest(db, request, user, case, st, source_label, process)
    except upload_policy.UploadRejected as exc:
        _reject(db, trace, user, case_id, filename, exc, size_hint=int(length_header) if length_header and length_header.isdigit() else None)


@router.get("/cases/{case_id}/evidence", response_model=list[EvidenceOut])
def list_evidence(case_id: str, request: Request, response: FastAPIResponse, q: str | None = Query(None, max_length=200),
                  status: str | None = Query(None, max_length=40), limit: int | None = Query(None, ge=1, le=MAX_LIMIT),
                  offset: int = Query(0, ge=0), user: User = Depends(current_user), db: Session = Depends(get_db, scope="function")):
    """Optional search (file name, evidence id, start of SHA-256), status filter and paging; X-Total-Count = matches."""
    authorize_case(db, user, case_id, request)
    record_read(db, None, user.user_id, "EVIDENCE_LIST", case_id=case_id, search=q,
                detail={"status_filter": status, "limit": limit, "offset": offset})
    query = db.query(Evidence).filter_by(case_id=case_id)
    if status:
        query = query.filter(Evidence.status == status)
    if q and q.strip():
        pat, prefix = like_pattern(q), q.strip().lower().replace("\\", "").replace("%", "").replace("_", "") + "%"
        query = query.filter(Evidence.filename.ilike(pat, escape="\\") | Evidence.evidence_id.ilike(pat, escape="\\")
                             | Evidence.sha256.like(prefix))
    return [evidence_out(e) for e in page(query.order_by(Evidence.created_at), response, limit, offset)]


@router.get("/cases/{case_id}/evidence/summary")
def evidence_summary(case_id: str, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db, scope="function")):
    """Counts by status for the whole case (filters and the overview need them without loading every row)."""
    authorize_case(db, user, case_id, request)
    record_read(db, None, user.user_id, "EVIDENCE_SUMMARY", case_id=case_id)
    rows = db.query(Evidence.status, func.count()).filter_by(case_id=case_id).group_by(Evidence.status).all()
    return {"case_id": case_id, "total": sum(n for _, n in rows), "by_status": {s: n for s, n in rows}}


def _get_ev(db: Session, user: User, evidence_id: str, request: Request, action="EVIDENCE_VIEW") -> Evidence:
    ev = db.get(Evidence, evidence_id)
    if ev is None:
        raise HTTPException(404, "unknown evidence")
    authorize_case(db, user, ev.case_id, request, action=action)
    return ev


@router.get("/evidence/{evidence_id}", response_model=EvidenceOut)
def get_evidence(evidence_id: str, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db, scope="function")):
    ev = _get_ev(db, user, evidence_id, request)
    record_audit(db, request.state.trace_id, user.user_id, "EVIDENCE_VIEW", "EVIDENCE", evidence_id, ev.case_id)
    db.commit()
    return evidence_out(ev, db)


@router.post("/evidence/{evidence_id}/process", response_model=EvidenceOut)
def process(evidence_id: str, request: Request, user: User = Depends(require_roles("EVIDENCE_OFFICER", "INVESTIGATOR", "ADMIN", action="upload")), db: Session = Depends(get_db, scope="function")):
    ev = _get_ev(db, user, evidence_id, request, action="EVIDENCE_PROCESS")
    if ev.status not in ("QUARANTINED", "SCAN_FAILED", "SCAN_TIMEOUT", "SCANNER_UNAVAILABLE", "ACCEPTED", "EXTRACTION_FAILED", "EXTRACTED",
                         "MALWARE_SCANNING", "PROCESSING", "ENTITY_CANDIDATES"):  # in-between states: DEF-098 lease reclaim
        raise HTTPException(409, f"evidence in status {ev.status} cannot be (re)processed")
    pipeline.process_evidence(db, evidence_id, request.state.trace_id, user.user_id)
    db.refresh(ev)
    return evidence_out(ev, db)


@router.get("/evidence/{evidence_id}/verify")
def verify(evidence_id: str, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db, scope="function")):
    """Recompute the stored file's SHA-256 and compare with the manifest."""
    ev = _get_ev(db, user, evidence_id, request, action="EVIDENCE_VERIFY")
    if not storage.exists(ev.storage_path):
        _do_mark_object_missing(db, ev, user, request)  # DEF-042: was reported without changing state
        return {"evidence_id": evidence_id, "match": False, "status": ev.status, "reason": "stored object missing"}
    ok, actual = storage.verify_hash(ev.storage_path, ev.sha256)
    record_audit(db, request.state.trace_id, user.user_id, "HASH_VERIFY", "EVIDENCE", evidence_id, ev.case_id, outcome="OK" if ok else "ERROR",
                 detail={"expected": ev.sha256, "actual": actual})
    if not ok and ev.status != "INTEGRITY_MISMATCH":
        # blueprint §6.1: a mismatch blocks normal acceptance until investigated; the record and bytes are preserved
        ev.status = "INTEGRITY_MISMATCH"
        ev.error = f"stored object hash {actual[:12]}… does not match manifest {ev.sha256[:12]}…"
        record_audit(db, request.state.trace_id, user.user_id, "INTEGRITY_MISMATCH", "EVIDENCE", evidence_id, ev.case_id, outcome="ERROR", detail={"expected": ev.sha256, "actual": actual})
    db.commit()
    return {"evidence_id": evidence_id, "match": ok, "status": ev.status, "expected_sha256": ev.sha256, "actual_sha256": actual,
            "note": "A hash match supports integrity of the stored object; it is not a chain-of-custody certificate."}


@router.get("/evidence/{evidence_id}/context")
def context(evidence_id: str, request: Request, row: int | None = None, page: int | None = None, line: int | None = None,
            json_path: str | None = None, window: int = Query(2, ge=0, le=10),
            user: User = Depends(current_user), db: Session = Depends(get_db, scope="function")):
    """Return the source lines around a locator (masked by default) so a graph edge can be traced to its origin."""
    ev = _authorize_evidence_read(db, user, evidence_id, request, action="EVIDENCE_CONTEXT")
    data = storage.read_bytes(ev.storage_path)
    ctx = build_context_window(data, ev.extension, row=row, page=page, line=line,
                               json_path=json_path, window=window, mask=True)
    record_audit(db, request.state.trace_id, user.user_id, "EVIDENCE_CONTEXT", "EVIDENCE", evidence_id, ev.case_id)
    db.commit()
    return {"evidence_id": evidence_id, "filename": ev.filename, "hash_match": True, **ctx}


@router.post("/evidence/{evidence_id}/context/reveal")
def context_reveal(evidence_id: str, body: ContextRevealIn, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db, scope="function")):
    """Authorized unmasking of evidence context. Requires a reason; allowed only by the EVIDENCE_CONTEXT masking policy
    AND an assignment to the evidence's case; every attempt writes an UNMASK audit event."""
    ev = _authorize_evidence_read(db, user, evidence_id, request, action="UNMASK")
    masking_policy.authorize_reveal(db, user, "EVIDENCE_CONTEXT", ev.case_id, request, "EVIDENCE", evidence_id, body.reason)
    data = storage.read_bytes(ev.storage_path)
    row, page, line, json_path, window = body.row, body.page, body.line, body.json_path, body.window
    ctx = build_context_window(data, ev.extension, row=row, page=page, line=line,
                               json_path=json_path, window=window, mask=False)
    record_audit(db, request.state.trace_id, user.user_id, "UNMASK", "EVIDENCE", evidence_id, ev.case_id,
                 detail={"reason": body.reason, "locator": ctx["locator"]})
    db.commit()
    return {"evidence_id": evidence_id, "filename": ev.filename, "hash_match": True, **ctx}


@router.post("/evidence/{evidence_id}/download")
def download(evidence_id: str, body: DownloadIn, request: Request, user: User = Depends(current_user),
             db: Session = Depends(get_db, scope="function")):
    """Raw (unmasked) original bytes. DEF-101: only with a reason written to the audit log; POST so the reason never
    appears in URLs or access logs. Who may download is the RAW_FILE masking policy (default INVESTIGATOR, REVIEWER),
    plus an assignment to the case. ADMIN cannot hold this permission (separation of duties), so the earlier ADMIN
    exception for quarantined files no longer applies: a quarantined file is never released through this route."""
    ev = _authorize_evidence_read(db, user, evidence_id, request, action="EVIDENCE_DOWNLOAD", require_clean=False)
    masking_policy.authorize_reveal(db, user, "RAW_FILE", ev.case_id, request, "EVIDENCE", evidence_id, body.reason)
    if ev.status in ("QUARANTINED", "MALWARE_SCANNING", "INFECTED", "SCAN_FAILED", "SCAN_TIMEOUT", "SCANNER_UNAVAILABLE", "INTEGRITY_MISMATCH"):
        raise HTTPException(409, "file is still in quarantine")
    data = storage.read_bytes(ev.storage_path)
    record_audit(db, request.state.trace_id, user.user_id, "EVIDENCE_DOWNLOAD", "EVIDENCE", evidence_id, ev.case_id,
                 detail={"reason": body.reason, "unmasked": True, "sha256": ev.sha256})
    db.commit()
    return Response(content=data, media_type=ev.detected_type, headers={"Content-Disposition": f'attachment; filename="{ev.filename}"', "X-Evidence-SHA256": ev.sha256})


@router.get("/evidence/{evidence_id}/claims")
def evidence_claims(evidence_id: str, request: Request, limit: int = 100, user: User = Depends(current_user), db: Session = Depends(get_db, scope="function")):
    ev = _get_ev(db, user, evidence_id, request)
    claims = db.query(Claim).filter_by(evidence_id=ev.evidence_id).order_by(Claim.created_at).limit(min(limit, 500)).all()
    record_audit(db, request.state.trace_id, user.user_id, "EVIDENCE_CLAIMS_VIEW", "EVIDENCE", evidence_id, ev.case_id, detail={"count": len(claims)})
    db.commit()
    return [claim_out(c, db) for c in claims]

def _do_mark_object_missing(db: Session, ev: Evidence, user: User, request: Request) -> None:
    """Route-layer wrapper for mark_object_missing that commits the session."""
    mark_object_missing(db, ev, user.user_id, request.state.trace_id)
    db.commit()


def _authorize_evidence_read(db: Session, user: User, evidence_id: str, request: Request, action: str, require_clean: bool = True) -> Evidence:
    """Centralized authorization and integrity gateway for evidence source access."""
    ev = _get_ev(db, user, evidence_id, request, action=action)
    if require_clean:
        if ev.status in ("QUARANTINED", "MALWARE_SCANNING", "INFECTED", "SCAN_FAILED", "SCAN_TIMEOUT", "SCANNER_UNAVAILABLE", "INTEGRITY_MISMATCH"):
            record_audit(db, request.state.trace_id, user.user_id, action, "EVIDENCE", evidence_id, ev.case_id, outcome="DENIED", detail={"reason": f"evidence state {ev.status} blocks read"})
            db.commit()
            raise HTTPException(409, f"evidence is {ev.status}; source content is only served for files that passed the scan gate and match their manifest")
    
    # Always verify integrity on read. DEF-042: a missing object used to raise inside verify_hash -> HTTP 500.
    if not storage.exists(ev.storage_path):
        _do_mark_object_missing(db, ev, user, request)
        raise HTTPException(409, "evidence integrity verification failed: stored object missing")
    ok, actual_hash = storage.verify_hash(ev.storage_path, ev.sha256)
    if not ok:
        ev.status = "INTEGRITY_MISMATCH"
        ev.error = f"stored object hash {actual_hash[:12]}… does not match manifest {ev.sha256[:12]}…"
        record_audit(db, request.state.trace_id, user.user_id, "INTEGRITY_MISMATCH", "EVIDENCE", evidence_id, ev.case_id, outcome="ERROR", detail={"expected": ev.sha256, "actual": actual_hash})
        db.commit()
        raise HTTPException(409, "evidence integrity verification failed")
    return ev
