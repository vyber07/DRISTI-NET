from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import config
from ..auth import current_user, issue_token, require_roles, verify_password
from ..db import get_db
from ..models import CaseAssignment, User
from ..schemas import LoginIn
from ..services import ratelimit
from ..services.audit import record_audit

router = APIRouter(tags=["auth"])


def user_out(u: User) -> dict:
    return {"user_id": u.user_id, "username": u.username, "display_name": u.display_name, "role": u.role, "jurisdiction": u.jurisdiction}


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
