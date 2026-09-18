from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ..auth import authorize_case, current_user, require_roles
from ..db import get_db
from ..models import AuditEvent, User

router = APIRouter(tags=["audit"])


def audit_out(a: AuditEvent) -> dict:
    return {"audit_id": a.audit_id, "trace_id": a.trace_id, "actor_id": a.actor_id, "action": a.action, "target_kind": a.target_kind,
            "target_id": a.target_id, "case_id": a.case_id, "outcome": a.outcome, "detail": a.detail, "created_at": a.created_at.isoformat()}


@router.get("/audit")
def all_audit(limit: int = 200, action: str | None = None, _: User = Depends(require_roles("AUDITOR", "ADMIN")), db: Session = Depends(get_db)):
    q = db.query(AuditEvent)
    if action:
        q = q.filter(AuditEvent.action == action)
    return [audit_out(a) for a in q.order_by(AuditEvent.created_at.desc()).limit(min(limit, 1000)).all()]


@router.get("/cases/{case_id}/audit")
def case_audit(case_id: str, request: Request, limit: int = 200, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Case-scoped audit trail: assigned users see decisions/access for their case; auditors see everything."""
    authorize_case(db, user, case_id, request, action="AUDIT_VIEW")
    return [audit_out(a) for a in db.query(AuditEvent).filter_by(case_id=case_id).order_by(AuditEvent.created_at.desc()).limit(min(limit, 1000)).all()]
