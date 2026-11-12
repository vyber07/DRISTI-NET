from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import config
from ..auth import create_session, current_user, hash_password, issue_token, require_roles, verify_absent_user, verify_password
from ..core import request_context
from ..db import get_db
from ..models import CaseAssignment, User, UserSession, utcnow
from ..schemas import LoginIn, PasswordResetIn, UserCreateIn, UserUpdateIn
from ..services import ratelimit
from ..services.audit import record_audit, record_audit_best_effort

router = APIRouter(tags=["auth"])


def user_out(u: User) -> dict:
    return {"user_id": u.user_id, "username": u.username, "display_name": u.display_name, "role": u.role,
            "jurisdiction": u.jurisdiction, "office_id": u.office_id, "active": u.active}


LOGIN_RATE_LIMITED = "Too many failed login attempts; try again later"
LOGIN_BAD_CREDENTIALS = "Invalid credentials"  # one message for unknown user, inactive, wrong password


@router.post("/auth/login")
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
    """Password login. Never reveals whether a username exists: unknown, inactive and wrong-password all return
    the same 401, and a rate-limited attempt returns the same 429 whichever account it names. Passwords are never
    written to the audit log or any counter."""
    trace = request.state.trace_id
    ip = ratelimit.client_ip(request)
    # The role of a known account selects its policy; unknown usernames use DEFAULT (see ratelimit.user_policy).
    known = db.query(User).filter_by(username=body.username).first()
    role = known.role if known else None

    if ratelimit.degraded():
        record_audit(db, trace, None, "LOGIN_THROTTLE_DEGRADED", "USER", body.username, outcome="DEGRADED",
                     detail={"reason": "redis unreachable; using per-process login counters"})

    # Reserve this attempt on every scope BEFORE any password hashing. A denied attempt costs no PBKDF2 work.
    attempt = ratelimit.begin_attempt(body.username, ip, role)
    if isinstance(attempt, ratelimit.Denied):
        record_audit(db, trace, None, "LOGIN", "USER", body.username, outcome="DENIED",
                     detail={"reason": "rate limited", "scope": attempt.scope, "ip": ip,
                             "retry_after": attempt.retry_after})
        db.commit()
        raise HTTPException(429, LOGIN_RATE_LIMITED, headers={"Retry-After": str(max(1, attempt.retry_after))})

    success = False
    sid = None
    try:
        user = db.query(User).filter_by(username=body.username, active=True).first()
        if user is None:
            verify_absent_user(body.password)  # same cost as a real check; timing does not reveal existence
        else:
            success = verify_password(body.password, user.password_hash)
        if success:
            ctx = request_context.current()
            sid = create_session(db, user, ip, ctx.user_agent if ctx else None)
            request_context.set_actor(user, sid)
            record_audit(db, trace, user.user_id, "LOGIN", "USER", user.user_id, detail={"ip": ip})
        else:
            record_audit(db, trace, None, "LOGIN", "USER", body.username, outcome="DENIED",
                         detail={"reason": "bad credentials", "ip": ip})
        db.commit()
    finally:
        # Settle after the audit so a crash while auditing still leaves the failure counted (finish runs on error too).
        locked = ratelimit.finish_attempt(attempt, success)
    if locked:
        record_audit(db, trace, None, "ACCOUNT_LOCKED", "USER", body.username, outcome="DENIED",
                     detail={"escalation_level": locked["level"], "lock_seconds": locked["duration_s"],
                             "distinct_sources": locked["sources"]})
        db.commit()
    if not success:
        raise HTTPException(401, LOGIN_BAD_CREDENTIALS)
    return {"token": issue_token(user, sid), "user": user_out(user)}


@router.get("/users/{user_id}/login-status")
def login_status(user_id: str, request: Request, user: User = Depends(require_roles("ADMIN", action="manageUsers")), db: Session = Depends(get_db)):
    """Administrator view of an account's lockout state, for deciding whether an unlock is needed. Audited (fail-closed)."""
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(404, "unknown user")
    status_out = ratelimit.account_status(target.username, target.role)
    record_audit(db, request.state.trace_id, user.user_id, "LOGIN_STATUS_VIEW", "USER", target.user_id,
                 detail={"username": target.username, "locked": status_out["locked"]})
    db.commit()
    return status_out


@router.post("/auth/logout")
def logout(request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Revokes the caller's session. The token stops working on its next use; other sessions of the same user are
    unaffected. Audited (LOGOUT). Audited before the revocation commits, so a failed audit leaves the session live."""
    sid = request_context.current().session_id if request_context.current() else None
    session = db.get(UserSession, sid) if sid else None
    if session is None:
        raise HTTPException(401, "Invalid or expired token")
    record_audit(db, request.state.trace_id, user.user_id, "LOGOUT", "USER", user.user_id, detail={"session": sid})
    session.revoked_at = utcnow().replace(tzinfo=None)
    db.commit()
    return {"ok": True}


@router.post("/users/{user_id}/unlock")
def unlock_user(user_id: str, request: Request, user: User = Depends(require_roles("ADMIN", action="manageUsers")), db: Session = Depends(get_db)):
    """Administrator unlock: clears every login lock and failure counter for the account. Audited."""
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(404, "unknown user")
    before = ratelimit.account_status(target.username, target.role)
    ratelimit.unlock_account(target.username)
    record_audit(db, request.state.trace_id, user.user_id, "USER_UNLOCK", "USER", target.user_id,
                 detail={"username": target.username, "was_locked": before["locked"],
                         "distinct_failing_sources": before["distinct_failing_sources"]})
    db.commit()
    return {"ok": True, "username": target.username, "was_locked": before["locked"]}


@router.get("/auth/me")
def me(user: User = Depends(current_user), db: Session = Depends(get_db)):
    cases = [a.case_id for a in db.query(CaseAssignment).filter_by(user_id=user.user_id).all()]
    return {**user_out(user), "assigned_cases": cases}


@router.get("/users")
def list_users(request: Request, user: User = Depends(require_roles("ADMIN", "AUDITOR", "INVESTIGATOR", action="viewUsers")), db: Session = Depends(get_db)):
    rows = db.query(User).order_by(User.username).all()
    record_audit_best_effort(db, request.state.trace_id, user.user_id, "USER_LIST", "USER", None, detail={"count": len(rows)})
    return [user_out(u) for u in rows]


@router.post("/users", status_code=201)
def create_user(body: UserCreateIn, request: Request, user: User = Depends(require_roles("ADMIN", action="manageUsers")), db: Session = Depends(get_db)):
    if db.query(User).filter_by(username=body.username).first() is not None:
        raise HTTPException(409, f"username {body.username!r} already exists")
    new_user = User(username=body.username, display_name=body.display_name, role=body.role,
                     jurisdiction=body.jurisdiction, office_id=body.office_id, password_hash=hash_password(body.password))
    db.add(new_user)
    db.flush()
    record_audit(db, request.state.trace_id, user.user_id, "USER_CREATE", "USER", new_user.user_id,
                 detail={"username": new_user.username, "role": new_user.role, "office_id": new_user.office_id})
    db.commit()
    return user_out(new_user)


@router.patch("/users/{user_id}")
def update_user(user_id: str, body: UserUpdateIn, request: Request, user: User = Depends(require_roles("ADMIN", action="manageUsers")), db: Session = Depends(get_db)):
    """Role, jurisdiction and display name -- a user's role is the unit of permission in this app
    (apps/web/src/lib/permissions.ts mirrors the same role -> capability table the backend enforces),
    so changing it here is how an admin manages what another user may do."""
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(404, "unknown user")
    before = {"role": target.role, "jurisdiction": target.jurisdiction, "display_name": target.display_name, "office_id": target.office_id}
    if body.display_name is not None:
        target.display_name = body.display_name
    if body.role is not None:
        target.role = body.role
    if body.jurisdiction is not None:
        target.jurisdiction = body.jurisdiction
    if body.office_id is not None:
        target.office_id = body.office_id or None
    after = {"role": target.role, "jurisdiction": target.jurisdiction, "display_name": target.display_name, "office_id": target.office_id}
    record_audit(db, request.state.trace_id, user.user_id, "USER_UPDATE", "USER", target.user_id, detail={"before": before, "after": after})
    db.commit()
    return user_out(target)


@router.post("/users/{user_id}/deactivate")
def deactivate_user(user_id: str, request: Request, user: User = Depends(require_roles("ADMIN", action="manageUsers")), db: Session = Depends(get_db)):
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
def reactivate_user(user_id: str, request: Request, user: User = Depends(require_roles("ADMIN", action="manageUsers")), db: Session = Depends(get_db)):
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(404, "unknown user")
    target.active = True
    record_audit(db, request.state.trace_id, user.user_id, "USER_REACTIVATE", "USER", target.user_id, detail={"username": target.username})
    db.commit()
    return user_out(target)


@router.post("/users/{user_id}/reset-password")
def reset_password(user_id: str, body: PasswordResetIn, request: Request, user: User = Depends(require_roles("ADMIN", action="manageUsers")), db: Session = Depends(get_db)):
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(404, "unknown user")
    target.password_hash = hash_password(body.new_password)
    target.token_version += 1  # SEC-02: invalidate every token issued before this reset
    # A reset is the administrator's recovery action, so it also clears any login lock or failure counters
    # the account has accumulated (an attacker's guesses must not outlive the password they were guessing).
    ratelimit.unlock_account(target.username)
    record_audit(db, request.state.trace_id, user.user_id, "USER_PASSWORD_RESET", "USER", target.user_id,
                 detail={"username": target.username, "login_lock_cleared": True})
    db.commit()
    return {"ok": True}
