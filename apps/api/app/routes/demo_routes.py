"""ADMIN-only helpers that exist solely to demonstrate failure paths in the prototype."""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..auth import require_roles
from ..db import get_db
from ..models import Evidence, User
from ..services import storage
from ..services.audit import record_audit

router = APIRouter(tags=["demo"])


@router.post("/demo/tamper/{evidence_id}")
def tamper(evidence_id: str, request: Request, user: User = Depends(require_roles("ADMIN")), db: Session = Depends(get_db)):
    """Append one byte to the stored object so /verify reports a hash mismatch. Demo only; audited."""
    ev = db.get(Evidence, evidence_id)
    if ev is None:
        raise HTTPException(404, "unknown evidence")
    storage.overwrite_for_demo(ev.storage_path, storage.read_bytes(ev.storage_path) + b"\n")
    record_audit(db, request.state.trace_id, user.user_id, "DEMO_TAMPER", "EVIDENCE", evidence_id, ev.case_id, outcome="OK", detail={"note": "stored object altered for hash-mismatch demonstration"})
    db.commit()
    return {"evidence_id": evidence_id, "note": "stored object altered; call GET /evidence/{id}/verify"}
