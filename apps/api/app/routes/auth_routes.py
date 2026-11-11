from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import config
from ..auth import current_user, hash_password, issue_token, require_roles, verify_password
from ..db import get_db
from ..models import CaseAssignment, User
from ..schemas import LoginIn, PasswordResetIn, UserCreateIn, UserUpdateIn
from ..services import ratelimit
from ..services.audit import record_audit

router = APIRouter(tags=["auth"])


def user_out(u: User) -> dict:
    return {"user_id": u.user_id, "username": u.username, "display_name": u.display_name, "role": u.role,
            "jurisdiction": u.jurisdiction, "active": u.active}


@router.post("/auth/login")
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
    trace = request.state.trace_id
    if config.REDIS_URL:
        try:
            throttled = ratelimit.is_login_throttled(body.username)
        except ratelimit.RateLimiterUnavailable:
            throttled = False
            record_audit(db, trace, None, "LOGIN_THROTTLE_DEGRADED", "USER", body.username, outcome="DEGRADED",
                         detail={"reason": "redis unreachable; proceeding without throttling"})
            db.commit()
        if throttled:
            record_audit(db, trace, None, "LOGIN", "USER", body.username, outcome="DENIED", detail={"reason": "rate limited"})
            db.commit()
            raise HTTPException(429, "Too many failed login attempts; try again later")

    user = db.query(User).filter_by(username=body.username, active=True).first()
    if user is None or not verify_password(body.password, user.password_hash):
        ratelimit.record_failed_login(body.username)
        record_audit(db, trace, None, "LOGIN", "USER", body.username, outcome="DENIED", detail={"reason": "bad credentials"})
        db.commit()
        raise HTTPException(401, "Invalid credentials")
    ratelimit.clear_login_throttle(body.username)
    record_audit(db, trace, user.user_id, "LOGIN", "USER", user.user_id)
    db.commit()
    return {"token": issue_token(user), "user": user_out(user)}


@router.get("/auth/me")
def me(user: User = Depends(current_user), db: Session = Depends(get_db)):
    cases = [a.case_id for a in db.query(CaseAssignment).filter_by(user_id=user.user_id).all()]
    return {**user_out(user), "assigned_cases": cases}


@router.get("/users")
def list_users(_: User = Depends(require_roles("ADMIN", "AUDITOR", "INVESTIGATOR")), db: Session = Depends(get_db)):
    return [user_out(u) for u in db.query(User).order_by(User.username).all()]


@router.post("/users", status_code=201)
def create_user(body: UserCreateIn, request: Request, user: User = Depends(require_roles("ADMIN")), db: Session = Depends(get_db)):
    if db.query(User).filter_by(username=body.username).first() is not None:
        raise HTTPException(409, f"username {body.username!r} already exists")
    new_user = User(username=body.username, display_name=body.display_name, role=body.role,
                     jurisdiction=body.jurisdiction, password_hash=hash_password(body.password))
    db.add(new_user)
    db.flush()
    record_audit(db, request.state.trace_id, user.user_id, "USER_CREATE", "USER", new_user.user_id,
                 detail={"username": new_user.username, "role": new_user.role})
    db.commit()
    return user_out(new_user)


@router.patch("/users/{user_id}")
def update_user(user_id: str, body: UserUpdateIn, request: Request, user: User = Depends(require_roles("ADMIN")), db: Session = Depends(get_db)):
    """Role, jurisdiction and display name -- a user's role is the unit of permission in this app
    (apps/web/src/lib/permissions.ts mirrors the same role -> capability table the backend enforces),
    so changing it here is how an admin manages what another user may do."""
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(404, "unknown user")
    before = {"role": target.role, "jurisdiction": target.jurisdiction, "display_name": target.display_name}
    if body.display_name is not None:
        target.display_name = body.display_name
    if body.role is not None:
        target.role = body.role
    if body.jurisdiction is not None:
        target.jurisdiction = body.jurisdiction
    after = {"role": target.role, "jurisdiction": target.jurisdiction, "display_name": target.display_name}
    record_audit(db, request.state.trace_id, user.user_id, "USER_UPDATE", "USER", target.user_id, detail={"before": before, "after": after})
    db.commit()
    return user_out(target)


@router.post("/users/{user_id}/deactivate")
def deactivate_user(user_id: str, request: Request, user: User = Depends(require_roles("ADMIN")), db: Session = Depends(get_db)):
    if user_id == user.user_id:
        # Prevents an admin from locking themselves out; the only way back in would be direct DB access.
        raise HTTPException(400, "cannot deactivate your own account")
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(404, "unknown user")
    target.active = False
    record_audit(db, request.state.trace_id, user.user_id, "USER_DEACTIVATE", "USER", target.user_id, detail={"username": target.username})
    db.commit()
    return user_out(target)


@router.post("/users/{user_id}/reactivate")
def reactivate_user(user_id: str, request: Request, user: User = Depends(require_roles("ADMIN")), db: Session = Depends(get_db)):
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(404, "unknown user")
    target.active = True
    record_audit(db, request.state.trace_id, user.user_id, "USER_REACTIVATE", "USER", target.user_id, detail={"username": target.username})
    db.commit()
    return user_out(target)


@router.post("/users/{user_id}/reset-password")
def reset_password(user_id: str, body: PasswordResetIn, request: Request, user: User = Depends(require_roles("ADMIN")), db: Session = Depends(get_db)):
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(404, "unknown user")
    target.password_hash = hash_password(body.new_password)
    target.token_version += 1  # SEC-02: invalidate every token issued before this reset
    record_audit(db, request.state.trace_id, user.user_id, "USER_PASSWORD_RESET", "USER", target.user_id, detail={"username": target.username})
    db.commit()
    return {"ok": True}
