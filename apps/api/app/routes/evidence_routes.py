from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import Response
from fastapi import Response as FastAPIResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import config
from ..auth import authorize_case, current_user, require_roles
from ..db import get_db
from ..models import Claim, Evidence, Job, User
from ..schemas import ContextRevealIn, DownloadIn, EvidenceOut

from ..services import extract as extract_svc
from ..services import pipeline, storage
from ..services import masking_policy
from ..services.audit import record_audit, record_read
from ..services.evidence_service import build_context_window, mark_object_missing
from ..services.masking import mask_text
from .graph_routes import claim_out
from .listing import MAX_LIMIT, like_pattern, page

router = APIRouter(tags=["evidence"])


async def _read_bounded(file: UploadFile, max_bytes: int) -> bytes:
    """Read the upload in chunks, aborting as soon as it exceeds max_bytes instead of after
    buffering the whole thing (SEC-10): a client could otherwise force the server to hold an
    arbitrarily large body in memory before validate_upload()'s own size check ever runs.
    """
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(1 << 20)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(413, f"upload exceeds {max_bytes // (1024 * 1024)} MB")
        chunks.append(chunk)
    return b"".join(chunks)


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
                 user: User = Depends(require_roles("EVIDENCE_OFFICER", "INVESTIGATOR", "ADMIN", action="upload")), db: Session = Depends(get_db)):
    """Upload → validate → UPLOADED → HASHED → QUARANTINED (→ optional immediate processing)."""
    case = authorize_case(db, user, case_id, request, action="EVIDENCE_UPLOAD")
    trace = request.state.trace_id
    data = await _read_bounded(file, config.MAX_UPLOAD_MB * 1024 * 1024)
    v = extract_svc.validate_upload(file.filename or "", data)
    if not v.ok:
        record_audit(db, trace, user.user_id, "EVIDENCE_UPLOAD", "FILE", file.filename, case_id, outcome="DENIED", detail={"reason": v.reason})
        db.commit()
        raise HTTPException(422, f"upload rejected: {v.reason}")
    sha = storage.sha256_bytes(data)
    prior = db.query(Evidence).filter_by(case_id=case_id, sha256=sha).first()
    if prior:
        record_audit(db, trace, user.user_id, "EVIDENCE_UPLOAD_DUPLICATE", "EVIDENCE", prior.evidence_id, case_id)
        db.commit()  # DEF-045: the audit row was never committed
        return evidence_out(prior, db)
    version = 1
    ev = Evidence(case_id=case_id, version=version, filename=file.filename, extension=v.extension, detected_type=v.detected_type,
                  size_bytes=len(data), sha256=sha, status="UPLOADED", storage_path="pending", source_label=source_label,
                  record_type=extract_svc.detect_record_type(file.filename, data, v.extension), uploaded_by=user.user_id,
                  # Snapshot of the case's own governance fields at the moment of acceptance (docs/context.md
                  # §9.2) -- fixed here, not looked up live later, so a later change to the case's own
                  # classification never rewrites what this evidence item was actually collected under.
                  classification=case.classification, jurisdiction=case.jurisdiction, purpose=case.purpose,
                  access_class=case.sensitivity, authority_reference=case.authority_reference)
    db.add(ev)
    try:
        db.flush()
    except __import__("sqlalchemy.exc").exc.IntegrityError as exc:
        if "uix_evidence_case_sha" not in str(exc) and "UNIQUE constraint failed: evidence.case_id, evidence.sha256" not in str(exc):
            raise
        db.rollback()
        prior = db.query(Evidence).filter_by(case_id=case_id, sha256=sha).first()
        record_audit(db, trace, user.user_id, "EVIDENCE_UPLOAD_DUPLICATE", "EVIDENCE", prior.evidence_id, case_id)
        db.commit()  # DEF-045
        return evidence_out(prior, db)
    ev.status = "HASHED"
    try:
        ev.storage_path = storage.write_quarantine(case_id, ev.evidence_id, file.filename, data)
    except Exception as exc:  # DEF-044: object store unreachable -> no row, controlled 503 (was an unhandled 500)
        db.rollback()
        record_audit(db, trace, user.user_id, "EVIDENCE_UPLOAD", "FILE", file.filename, case_id, outcome="ERROR",
                     detail={"reason": "evidence storage unavailable", "error": type(exc).__name__})
        db.commit()
        raise HTTPException(503, "evidence storage is unavailable; the upload was not accepted")
    ev.status = "QUARANTINED"
    record_audit(db, trace, user.user_id, "EVIDENCE_UPLOAD", "EVIDENCE", ev.evidence_id, case_id,
                 detail={"filename": file.filename, "sha256": sha, "size": len(data), "duplicate_of": prior.evidence_id if prior else None})
    db.commit()
    if process:
        pipeline.process_evidence(db, ev.evidence_id, trace, user.user_id)
        db.refresh(ev)
    return evidence_out(ev, db)


@router.get("/cases/{case_id}/evidence", response_model=list[EvidenceOut])
def list_evidence(case_id: str, request: Request, response: FastAPIResponse, q: str | None = Query(None, max_length=200),
                  status: str | None = Query(None, max_length=40), limit: int | None = Query(None, ge=1, le=MAX_LIMIT),
                  offset: int = Query(0, ge=0), user: User = Depends(current_user), db: Session = Depends(get_db)):
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
def evidence_summary(case_id: str, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
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
def get_evidence(evidence_id: str, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    ev = _get_ev(db, user, evidence_id, request)
    record_audit(db, request.state.trace_id, user.user_id, "EVIDENCE_VIEW", "EVIDENCE", evidence_id, ev.case_id)
    db.commit()
    return evidence_out(ev, db)


@router.post("/evidence/{evidence_id}/process", response_model=EvidenceOut)
def process(evidence_id: str, request: Request, user: User = Depends(require_roles("EVIDENCE_OFFICER", "INVESTIGATOR", "ADMIN", action="upload")), db: Session = Depends(get_db)):
    ev = _get_ev(db, user, evidence_id, request, action="EVIDENCE_PROCESS")
    if ev.status not in ("QUARANTINED", "SCAN_FAILED", "SCAN_TIMEOUT", "SCANNER_UNAVAILABLE", "ACCEPTED", "EXTRACTION_FAILED", "EXTRACTED",
                         "MALWARE_SCANNING", "PROCESSING", "ENTITY_CANDIDATES"):  # in-between states: DEF-098 lease reclaim
        raise HTTPException(409, f"evidence in status {ev.status} cannot be (re)processed")
    pipeline.process_evidence(db, evidence_id, request.state.trace_id, user.user_id)
    db.refresh(ev)
    return evidence_out(ev, db)


@router.get("/evidence/{evidence_id}/verify")
def verify(evidence_id: str, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
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
            user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Return the source lines around a locator (masked by default) so a graph edge can be traced to its origin."""
    ev = _authorize_evidence_read(db, user, evidence_id, request, action="EVIDENCE_CONTEXT")
    data = storage.read_bytes(ev.storage_path)
    ctx = build_context_window(data, ev.extension, row=row, page=page, line=line,
                               json_path=json_path, window=window, mask=True)
    record_audit(db, request.state.trace_id, user.user_id, "EVIDENCE_CONTEXT", "EVIDENCE", evidence_id, ev.case_id)
    db.commit()
    return {"evidence_id": evidence_id, "filename": ev.filename, "hash_match": True, **ctx}


@router.post("/evidence/{evidence_id}/context/reveal")
def context_reveal(evidence_id: str, body: ContextRevealIn, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
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
             db: Session = Depends(get_db)):
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
def evidence_claims(evidence_id: str, request: Request, limit: int = 100, user: User = Depends(current_user), db: Session = Depends(get_db)):
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
