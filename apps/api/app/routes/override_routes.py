"""Permission overrides: administration API, and the caller's own effective permissions.

GET  /permission-overrides                 ADMIN, AUDITOR  list (filter by effective status, subject, case, action)
GET  /permission-overrides/meta            ADMIN, AUDITOR  actions, resource types and limits for the admin UI
GET  /permission-overrides/{id}            ADMIN, AUDITOR  one override with its complete history
POST /permission-overrides                 ADMIN           create (ALLOW -> PENDING, DENY -> ACTIVE)
POST /permission-overrides/{id}/approve    ADMIN           a different ADMIN, not the subject
POST /permission-overrides/{id}/reject     ADMIN
POST /permission-overrides/{id}/revoke     ADMIN           not the subject
GET  /auth/me/permissions?case_id=         authenticated   what the server will decide for the caller

Every view and change is audited; refused attempts are audited as DENIED.
"""
import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..auth import current_user, require_roles
from ..db import get_db
from ..models import PermissionOverride, PermissionOverrideEvent, User
from ..services import overrides
from ..services.audit import record_audit

router = APIRouter(tags=["permission-overrides"])


class OverrideIn(BaseModel):
    effect: str = Field(pattern=r"^(ALLOW|DENY)$")
    action: str = Field(max_length=40)
    subject_type: str = Field(pattern=r"^(USER|ROLE)$")
    subject: str = Field(min_length=1, max_length=64)
    case_id: str | None = Field(default=None, max_length=64)
    resource_type: str | None = Field(default=None, max_length=20)
    resource_id: str | None = Field(default=None, max_length=64)
    reason: str = Field(min_length=10, max_length=1000)
    starts_at: datetime.datetime | None = None
    expires_at: datetime.datetime


class NoteIn(BaseModel):
    note: str | None = Field(default=None, max_length=1000)


class ReasonIn(BaseModel):
    reason: str = Field(min_length=10, max_length=1000)


def _refused(db: Session, request: Request, user: User, what: str, target: str | None, message: str, status: int):
    record_audit(db, request.state.trace_id, user.user_id, f"OVERRIDE_{what}", "PERMISSION_OVERRIDE", target,
                 outcome="DENIED", detail={"reason": message})
    db.commit()
    raise HTTPException(status, message)


def _run(db: Session, request: Request, user: User, what: str, target: str | None, fn):
    try:
        result = fn()
    except PermissionError as exc:
        db.rollback()
        _refused(db, request, user, what, target, str(exc), 403)
    except overrides.OverrideError as exc:
        db.rollback()
        _refused(db, request, user, what, target, str(exc), 422)
    except LookupError:
        db.rollback()
        raise HTTPException(404, "unknown override")
    db.commit()
    return overrides.override_out(result, db)


@router.get("/permission-overrides/meta")
def meta(user: User = Depends(require_roles("ADMIN", "AUDITOR", action="viewOverrides"))):
    return {"overridable_actions": sorted(overrides.OVERRIDABLE), "mandatory_actions": sorted(overrides.NON_OVERRIDABLE),
            "resource_types": sorted(overrides.RESOURCE_TYPES), "max_duration_days": overrides.MAX_DURATION_DAYS,
            "precedence": ["mandatory restriction", "DENY override", "role / assignment allow", "ALLOW override", "deny"]}


@router.get("/permission-overrides")
def list_overrides(request: Request, status: str = Query("all", pattern="^(all|active|pending|scheduled|expired|revoked|rejected)$"),
                   subject: str | None = Query(None, max_length=64), case_id: str | None = Query(None, max_length=64),
                   action: str | None = Query(None, max_length=40),
                   user: User = Depends(require_roles("ADMIN", "AUDITOR", action="viewOverrides")), db: Session = Depends(get_db)):
    q = db.query(PermissionOverride)
    if subject:
        q = q.filter(PermissionOverride.subject == subject)
    if case_id:
        q = q.filter(PermissionOverride.case_id == case_id)
    if action:
        q = q.filter(PermissionOverride.action == action)
    rows = [o for o in q.order_by(PermissionOverride.created_at.desc()).limit(1000).all()
            if status == "all" or overrides.effective_status(o).lower() == status]
    record_audit(db, request.state.trace_id, user.user_id, "OVERRIDE_VIEW", "PERMISSION_OVERRIDE", None,
                 detail={"filters": {"status": status, "subject": subject, "case_id": case_id, "action": action}, "returned": len(rows)})
    db.commit()
    return [overrides.override_out(o, db) for o in rows]


@router.get("/permission-overrides/{override_id}")
def get_override(override_id: str, request: Request, user: User = Depends(require_roles("ADMIN", "AUDITOR", action="viewOverrides")),
                 db: Session = Depends(get_db)):
    o = db.get(PermissionOverride, override_id)
    if o is None:
        raise HTTPException(404, "unknown override")
    events = db.query(PermissionOverrideEvent).filter_by(override_id=override_id).order_by(PermissionOverrideEvent.at,
                                                                                          PermissionOverrideEvent.event_id).all()
    record_audit(db, request.state.trace_id, user.user_id, "OVERRIDE_VIEW", "PERMISSION_OVERRIDE", override_id, o.case_id)
    db.commit()
    return {**overrides.override_out(o, db),
            "history": [{"event": e.event, "actor_id": e.actor_id, "at": e.at.isoformat() + "Z", "reason": e.reason,
                         "snapshot": e.snapshot} for e in events]}


@router.post("/permission-overrides", status_code=201)
def create_override(body: OverrideIn, request: Request, user: User = Depends(require_roles("ADMIN", action="manageOverrides")),
                    db: Session = Depends(get_db)):
    return _run(db, request, user, "CREATE", None, lambda: overrides.create(
        db, user, effect=body.effect, action=body.action, subject_type=body.subject_type, subject=body.subject,
        reason=body.reason, starts_at=body.starts_at, expires_at=body.expires_at, case_id=body.case_id,
        resource_type=body.resource_type, resource_id=body.resource_id, trace=request.state.trace_id))


@router.post("/permission-overrides/{override_id}/approve")
def approve_override(override_id: str, body: NoteIn, request: Request,
                     user: User = Depends(require_roles("ADMIN", action="manageOverrides")), db: Session = Depends(get_db)):
    return _run(db, request, user, "APPROVE", override_id,
                lambda: overrides.approve(db, user, override_id, body.note, request.state.trace_id))


@router.post("/permission-overrides/{override_id}/reject")
def reject_override(override_id: str, body: ReasonIn, request: Request,
                    user: User = Depends(require_roles("ADMIN", action="manageOverrides")), db: Session = Depends(get_db)):
    return _run(db, request, user, "REJECT", override_id,
                lambda: overrides.reject(db, user, override_id, body.reason, request.state.trace_id))


@router.post("/permission-overrides/{override_id}/revoke")
def revoke_override(override_id: str, body: ReasonIn, request: Request,
                    user: User = Depends(require_roles("ADMIN", action="manageOverrides")), db: Session = Depends(get_db)):
    return _run(db, request, user, "REVOKE", override_id,
                lambda: overrides.revoke(db, user, override_id, body.reason, request.state.trace_id))


@router.get("/auth/me/permissions")
def my_permissions(case_id: str | None = Query(None, max_length=64), user: User = Depends(current_user),
                   db: Session = Depends(get_db)):
    """The caller's own effective capabilities, overrides included, optionally for one case. The frontend uses this
    to decide which controls to show; the server still decides every request itself."""
    return {"role": user.role, "case_id": case_id, "capabilities": overrides.effective_capabilities(db, user, case_id)}
