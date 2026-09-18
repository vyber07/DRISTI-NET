from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ..auth import authorize_case, current_user, require_roles
from ..db import get_db
from ..models import Claim, Evidence, Job, User

from ..services import extract as extract_svc
from ..services import pipeline, storage
from ..services.audit import record_audit
from ..services.masking import mask_text

router = APIRouter(tags=["evidence"])


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


@router.post("/cases/{case_id}/evidence", status_code=201)
async def upload(case_id: str, request: Request, file: UploadFile = File(...), source_label: str = Form("synthetic"),
                 process: bool = Form(True),
                 user: User = Depends(require_roles("EVIDENCE_OFFICER", "INVESTIGATOR", "ADMIN")), db: Session = Depends(get_db)):
    """Upload → validate → UPLOADED → HASHED → QUARANTINED (→ optional immediate processing)."""
    case = authorize_case(db, user, case_id, request, action="EVIDENCE_UPLOAD")
    trace = request.state.trace_id
    data = await file.read()
    v = extract_svc.validate_upload(file.filename or "", data)
    if not v.ok:
        record_audit(db, trace, user.user_id, "EVIDENCE_UPLOAD", "FILE", file.filename, case_id, outcome="DENIED", detail={"reason": v.reason})
        db.commit()
        raise HTTPException(422, f"upload rejected: {v.reason}")
    sha = storage.sha256_bytes(data)
    prior = db.query(Evidence).filter_by(case_id=case_id, sha256=sha).first()
    if prior:
        record_audit(db, trace, user.user_id, "EVIDENCE_UPLOAD_DUPLICATE", "EVIDENCE", prior.evidence_id, case_id); return evidence_out(prior, db)
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
        return evidence_out(prior, db)
    ev.status = "HASHED"
    ev.storage_path = storage.write_quarantine(case_id, ev.evidence_id, file.filename, data)
    ev.status = "QUARANTINED"
    record_audit(db, trace, user.user_id, "EVIDENCE_UPLOAD", "EVIDENCE", ev.evidence_id, case_id,
                 detail={"filename": file.filename, "sha256": sha, "size": len(data), "duplicate_of": prior.evidence_id if prior else None})
    db.commit()
    if process:
        pipeline.process_evidence(db, ev.evidence_id, trace, user.user_id)
        db.refresh(ev)
    return evidence_out(ev, db)


@router.get("/cases/{case_id}/evidence")
def list_evidence(case_id: str, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    authorize_case(db, user, case_id, request)
    return [evidence_out(e) for e in db.query(Evidence).filter_by(case_id=case_id).order_by(Evidence.created_at).all()]


def _get_ev(db: Session, user: User, evidence_id: str, request: Request, action="EVIDENCE_VIEW") -> Evidence:
    ev = db.get(Evidence, evidence_id)
    if ev is None:
        raise HTTPException(404, "unknown evidence")
    authorize_case(db, user, ev.case_id, request, action=action)
    return ev


@router.get("/evidence/{evidence_id}")
def get_evidence(evidence_id: str, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return evidence_out(_get_ev(db, user, evidence_id, request), db)


@router.post("/evidence/{evidence_id}/process")
def process(evidence_id: str, request: Request, user: User = Depends(require_roles("EVIDENCE_OFFICER", "INVESTIGATOR", "ADMIN")), db: Session = Depends(get_db)):
    ev = _get_ev(db, user, evidence_id, request, action="EVIDENCE_PROCESS")
    if ev.status not in ("QUARANTINED", "SCAN_FAILED", "SCAN_TIMEOUT", "SCANNER_UNAVAILABLE", "ACCEPTED", "EXTRACTION_FAILED", "EXTRACTED"):
        raise HTTPException(409, f"evidence in status {ev.status} cannot be (re)processed")
    pipeline.process_evidence(db, evidence_id, request.state.trace_id, user.user_id)
    db.refresh(ev)
    return evidence_out(ev, db)


@router.get("/evidence/{evidence_id}/verify")
def verify(evidence_id: str, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Recompute the stored file's SHA-256 and compare with the manifest."""
    ev = _get_ev(db, user, evidence_id, request, action="EVIDENCE_VERIFY")
    if not storage.exists(ev.storage_path):
        return {"evidence_id": evidence_id, "match": False, "reason": "stored object missing"}
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
            json_path: str | None = None, window: int = 2,
            user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Return the source lines around a locator (masked by default) so a graph edge can be traced to its origin."""
    ev = _authorize_evidence_read(db, user, evidence_id, request, action="EVIDENCE_CONTEXT")
    data = storage.read_bytes(ev.storage_path)
    ok = True
    if ev.extension == ".pdf":
        import io
        from pypdf import PdfReader
        pages = [(p.extract_text() or "").splitlines() for p in PdfReader(io.BytesIO(data)).pages]
        pno = page or 1
        lines = pages[pno - 1] if 0 < pno <= len(pages) else []
        centre = (line or 1) - 1
    else:
        lines = data.decode("utf-8", "replace").splitlines()
        if json_path:
            import re
            m = re.match(r"\$\[(\d+)\]", json_path)
            idx = int(m.group(1)) if m else 0
            import json as _json
            obj = _json.loads(data.decode("utf-8", "replace"))
            rec = obj[idx] if isinstance(obj, list) and idx < len(obj) else None
            text = _json.dumps(rec, indent=1) if rec is not None else ""
            return {"evidence_id": evidence_id, "filename": ev.filename, "hash_match": ok, "locator": {"json_path": json_path},
                    "lines": [{"n": i + 1, "text": mask_text(t), "hit": True} for i, t in enumerate(text.splitlines())]}
        centre = (row or line or 1) - 1
    lo, hi = max(0, centre - window), min(len(lines), centre + window + 1)
    out = [{"n": i + 1, "text": mask_text(lines[i]), "hit": i == centre} for i in range(lo, hi)]
    return {"evidence_id": evidence_id, "filename": ev.filename, "hash_match": ok, "locator": {"row": row, "page": page, "line": line}, "lines": out}


from ..schemas import ContextRevealIn
@router.post("/evidence/{evidence_id}/context/reveal")
def context_reveal(evidence_id: str, body: ContextRevealIn, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Authorized unmasking of evidence context. Requires a reason, is role-gated, and writes an UNMASK audit event."""
    if user.role not in ("INVESTIGATOR", "REVIEWER", "ADMIN"):
        ev = db.get(Evidence, evidence_id)
        case_id = ev.case_id if ev else None
        record_audit(db, request.state.trace_id, user.user_id, "UNMASK", "EVIDENCE", evidence_id, case_id, outcome="DENIED", detail={"reason": body.reason, "why": "role not permitted"})
        db.commit()
        raise HTTPException(403, f"role {user.role} may not reveal masked values")
    
    ev = _authorize_evidence_read(db, user, evidence_id, request, action="UNMASK")
    data = storage.read_bytes(ev.storage_path)
    ok = True
    
    row, page, line, json_path, window = body.row, body.page, body.line, body.json_path, body.window
    
    if ev.extension == ".pdf":
        import io
        from pypdf import PdfReader
        pages = [(p.extract_text() or "").splitlines() for p in PdfReader(io.BytesIO(data)).pages]
        pno = page or 1
        lines = pages[pno - 1] if 0 < pno <= len(pages) else []
        centre = (line or 1) - 1
    else:
        lines = data.decode("utf-8", "replace").splitlines()
        if json_path:
            import re
            m = re.match(r"\$\[(\d+)\]", json_path)
            idx = int(m.group(1)) if m else 0
            import json as _json
            obj = _json.loads(data.decode("utf-8", "replace"))
            rec = obj[idx] if isinstance(obj, list) and idx < len(obj) else None
            text = _json.dumps(rec, indent=1) if rec is not None else ""
            record_audit(db, request.state.trace_id, user.user_id, "UNMASK", "EVIDENCE", evidence_id, ev.case_id, detail={"reason": body.reason, "locator": {"json_path": json_path}})
            db.commit()
            return {"evidence_id": evidence_id, "filename": ev.filename, "hash_match": ok, "locator": {"json_path": json_path},
                    "lines": [{"n": i + 1, "text": t, "hit": True} for i, t in enumerate(text.splitlines())]}
        centre = (row or line or 1) - 1
        
    lo, hi = max(0, centre - window), min(len(lines), centre + window + 1)
    out = [{"n": i + 1, "text": lines[i], "hit": i == centre} for i in range(lo, hi)]
    
    record_audit(db, request.state.trace_id, user.user_id, "UNMASK", "EVIDENCE", evidence_id, ev.case_id, detail={"reason": body.reason, "locator": {"row": row, "page": page, "line": line}})
    db.commit()
    
    return {"evidence_id": evidence_id, "filename": ev.filename, "hash_match": ok, "locator": {"row": row, "page": page, "line": line}, "lines": out}


@router.get("/evidence/{evidence_id}/download")
def download(evidence_id: str, request: Request, user: User = Depends(require_roles("EVIDENCE_OFFICER", "INVESTIGATOR", "ADMIN", "AUDITOR")), db: Session = Depends(get_db)):
    ev = _authorize_evidence_read(db, user, evidence_id, request, action="EVIDENCE_DOWNLOAD", require_clean=False)
    if ev.status in ("QUARANTINED", "MALWARE_SCANNING", "INFECTED", "SCAN_FAILED", "SCAN_TIMEOUT", "SCANNER_UNAVAILABLE", "INTEGRITY_MISMATCH") and user.role != "ADMIN":
        raise HTTPException(409, "file is still in quarantine")
    data = storage.read_bytes(ev.storage_path)
    record_audit(db, request.state.trace_id, user.user_id, "EVIDENCE_DOWNLOAD", "EVIDENCE", evidence_id, ev.case_id)
    db.commit()
    return Response(content=data, media_type=ev.detected_type, headers={"Content-Disposition": f'attachment; filename="{ev.filename}"', "X-Evidence-SHA256": ev.sha256})


@router.get("/evidence/{evidence_id}/claims")
def evidence_claims(evidence_id: str, request: Request, limit: int = 100, user: User = Depends(current_user), db: Session = Depends(get_db)):
    ev = _get_ev(db, user, evidence_id, request)
    from .graph_routes import claim_out
    claims = db.query(Claim).filter_by(evidence_id=ev.evidence_id).order_by(Claim.created_at).limit(min(limit, 500)).all()
    return [claim_out(c, db) for c in claims]

def _authorize_evidence_read(db: Session, user: User, evidence_id: str, request: Request, action: str, require_clean: bool = True) -> Evidence:
    """Centralized authorization and integrity gateway for evidence source access."""
    ev = _get_ev(db, user, evidence_id, request, action=action)
    if require_clean:
        if ev.status in ("QUARANTINED", "MALWARE_SCANNING", "INFECTED", "SCAN_FAILED", "SCAN_TIMEOUT", "SCANNER_UNAVAILABLE", "INTEGRITY_MISMATCH"):
            record_audit(db, request.state.trace_id, user.user_id, action, "EVIDENCE", evidence_id, ev.case_id, outcome="DENIED", detail={"reason": f"evidence state {ev.status} blocks read"})
            db.commit()
            raise HTTPException(409, f"evidence is {ev.status}; source content is only served for files that passed the scan gate and match their manifest")
    
    # Always verify integrity on read
    ok, actual_hash = storage.verify_hash(ev.storage_path, ev.sha256)
    if not ok:
        ev.status = "INTEGRITY_MISMATCH"
        ev.error = f"stored object hash {actual_hash[:12]}… does not match manifest {ev.sha256[:12]}…"
        record_audit(db, request.state.trace_id, user.user_id, "INTEGRITY_MISMATCH", "EVIDENCE", evidence_id, ev.case_id, outcome="ERROR", detail={"expected": ev.sha256, "actual": actual_hash})
        db.commit()
        raise HTTPException(409, "evidence integrity verification failed")
    return ev
