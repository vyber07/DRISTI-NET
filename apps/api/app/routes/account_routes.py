"""Self-service account endpoints for the signed-in user (P2.3, docs/frontend/PROFILE.md).

Every endpoint acts on the caller's own account only: no user id is taken from the path or body, so there is nothing to
tamper with (no IDOR surface). What a user may change about themselves is deliberately small:

- display name (PATCH /auth/me): the only self-editable profile field. Role, jurisdiction, office, organisational user
  ID, username and account status stay administrator-controlled (routes/auth_routes.py); the request body refuses any
  other field (422), and a change is audited with before/after.
- password (POST /auth/me/password): needs the current password. Wrong attempts count toward the same lockout as
  sign-in (services/ratelimit). Success re-hashes, bumps token_version (every other token stops working), revokes the
  caller's other sessions and returns a fresh token for the current session. Audited (OK and DENIED).
- sessions (GET /auth/me/sessions, POST .../{id}/revoke, POST .../revoke-others): the caller's own server-side
  sessions. Session IDs are bearer-adjacent, so they are never returned; each session is addressed by a one-way hash.
- activity (GET /auth/me/activity): the account's own security-relevant audit events (sign-ins, failed sign-ins that
  named this username, password and profile changes, and administrators' changes to the account).
"""
from __future__ import annotations

import datetime
import hashlib
import re

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import and_, or_, update
from sqlalchemy.orm import Session

from ..auth import current_user, hash_password, issue_token, verify_password
from ..core import request_context
from ..db import get_db
from ..models import AuditEvent, User, UserSession
from ..schemas import PasswordChangeIn, ProfileUpdateIn
from ..services import ratelimit
from ..services.audit import record_audit

router = APIRouter(tags=["account"])

# Control characters and bidirectional overrides would let a display name impersonate another (or hide text).
_BAD_NAME_CHARS = re.compile(r"[\x00-\x1f\x7f​-‏‪-‮⁦-⁩﻿]")
CHANGE_PASSWORD_FAILED = "The current password is not correct"


class AccountError(HTTPException):
    def __init__(self, status_code: int, detail: str, code: str, headers: dict | None = None):
        super().__init__(status_code, detail, headers=headers)
        self.code = code


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)


def _iso(dt: datetime.datetime | None) -> str | None:
    return dt.replace(tzinfo=datetime.timezone.utc).isoformat().replace("+00:00", "Z") if dt else None


def _public_id(sid: str) -> str:
    return hashlib.sha256(sid.encode()).hexdigest()[:20]


def _current_sid() -> str | None:
    ctx = request_context.current()
    return ctx.session_id if ctx else None


# ------------------------------------------------------------------------------------------------ profile
@router.patch("/auth/me")
def update_profile(body: ProfileUpdateIn, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db, scope="function")):
    name = " ".join(body.display_name.split())
    if _BAD_NAME_CHARS.search(name) or not 2 <= len(name) <= 120:
        raise AccountError(422, "Display name must be 2-120 visible characters", "DISPLAY_NAME_INVALID")
    me = db.get(User, user.user_id)
    before = me.display_name
    if name == before:
        raise AccountError(409, "That is already your display name", "UNCHANGED")
    me.display_name = name
    record_audit(db, request.state.trace_id, me.user_id, "PROFILE_UPDATE", "USER", me.user_id,
                 detail={"field": "display_name", "before": before, "after": name})
    db.commit()
    from .auth_routes import user_out
    return user_out(me)


# ------------------------------------------------------------------------------------------------ password
@router.post("/auth/me/password")
def change_password(body: PasswordChangeIn, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db, scope="function")):
    me = db.get(User, user.user_id)
    sid = _current_sid()
    trace = request.state.trace_id
    ip = ratelimit.client_ip(request)
    attempt = ratelimit.begin_attempt(me.username, ip, me.role)
    if isinstance(attempt, ratelimit.Denied):
        record_audit(db, trace, me.user_id, "PASSWORD_CHANGE", "USER", me.user_id, outcome="DENIED",
                     detail={"reason": "rate limited", "scope": attempt.scope})
        db.commit()
        raise AccountError(429, "Too many failed attempts; try again later", "RATE_LIMITED",
                           headers={"Retry-After": str(max(1, attempt.retry_after))})
    ok = False
    try:
        ok = verify_password(body.current_password, me.password_hash)
        if not ok:
            record_audit(db, trace, me.user_id, "PASSWORD_CHANGE", "USER", me.user_id, outcome="DENIED",
                         detail={"reason": "current password incorrect"})
            db.commit()
    finally:
        locked = ratelimit.finish_attempt(attempt, ok)
    if locked:
        record_audit(db, trace, None, "ACCOUNT_LOCKED", "USER", me.username, outcome="DENIED",
                     detail={"escalation_level": locked["level"], "lock_seconds": locked["duration_s"], "via": "password change"})
        db.commit()
    if not ok:
        raise AccountError(400, CHANGE_PASSWORD_FAILED, "CURRENT_PASSWORD_INVALID")

    if body.new_password == body.current_password:
        raise AccountError(422, "The new password must differ from the current one", "PASSWORD_UNCHANGED")
    if body.new_password.strip().lower() == me.username.lower():
        raise AccountError(422, "The new password must not be your username", "PASSWORD_WEAK")

    me.password_hash = hash_password(body.new_password)
    me.token_version = (me.token_version or 0) + 1      # every token issued before this stops working (SEC-02)
    now = _now()
    revoked = db.execute(update(UserSession).where(UserSession.user_id == me.user_id, UserSession.revoked_at.is_(None),
                                                    UserSession.sid != (sid or ""))
                         .values(revoked_at=now).execution_options(synchronize_session=False)).rowcount
    record_audit(db, trace, me.user_id, "PASSWORD_CHANGE", "USER", me.user_id,
                 detail={"other_sessions_revoked": revoked})
    db.commit()
    # The current session stays; its token must carry the new token_version.
    return {"ok": True, "token": issue_token(me, sid), "other_sessions_revoked": revoked}


# ------------------------------------------------------------------------------------------------ sessions
@router.get("/auth/me/sessions")
def my_sessions(user: User = Depends(current_user), db: Session = Depends(get_db, scope="function")):
    sid = _current_sid()
    now = _now()
    rows = (db.query(UserSession).filter(UserSession.user_id == user.user_id)
            .order_by(UserSession.created_at.desc()).limit(50).all())
    out = []
    for s in rows:
        status = "revoked" if s.revoked_at else ("expired" if s.expires_at <= now else "active")
        out.append({"id": _public_id(s.sid), "current": s.sid == sid, "status": status, "created_at": _iso(s.created_at),
                    "expires_at": _iso(s.expires_at), "revoked_at": _iso(s.revoked_at), "ip_address": s.ip_address,
                    "user_agent": (s.user_agent or "")[:200]})
    active = [s for s in out if s["status"] == "active"]
    ended = [s for s in out if s["status"] != "active"][:10]
    return {"sessions": active + ended}


@router.post("/auth/me/sessions/{session_id}/revoke")
def revoke_session(session_id: str, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db, scope="function")):
    sid = _current_sid()
    target = next((s for s in db.query(UserSession).filter(UserSession.user_id == user.user_id, UserSession.revoked_at.is_(None)).all()
                   if _public_id(s.sid) == session_id), None)
    if target is None:
        raise AccountError(404, "No such active session", "SESSION_NOT_FOUND")
    if target.sid == sid:
        raise AccountError(409, "This is the session you are using; sign out instead", "CURRENT_SESSION")
    target.revoked_at = _now()
    record_audit(db, request.state.trace_id, user.user_id, "SESSION_REVOKE", "USER", user.user_id,
                 detail={"session": session_id, "scope": "one"})
    db.commit()
    return {"ok": True, "revoked": 1}


@router.post("/auth/me/sessions/revoke-others")
def revoke_other_sessions(request: Request, user: User = Depends(current_user), db: Session = Depends(get_db, scope="function")):
    sid = _current_sid()
    n = db.execute(update(UserSession).where(UserSession.user_id == user.user_id, UserSession.revoked_at.is_(None),
                                              UserSession.sid != (sid or ""))
                   .values(revoked_at=_now()).execution_options(synchronize_session=False)).rowcount
    record_audit(db, request.state.trace_id, user.user_id, "SESSION_REVOKE", "USER", user.user_id,
                 detail={"scope": "others", "revoked": n})
    db.commit()
    return {"ok": True, "revoked": n}


# ------------------------------------------------------------------------------------------------ activity
SELF_ACTIONS = ("LOGIN", "LOGOUT", "PASSWORD_CHANGE", "PROFILE_UPDATE", "SESSION_REVOKE")
ON_ME_ACTIONS = ("USER_UPDATE", "USER_PASSWORD_RESET", "USER_DEACTIVATE", "USER_REACTIVATE", "USER_UNLOCK",
                 "USER_ID_ASSIGN", "USER_ID_CHANGE", "USER_ID_CORRECT", "USER_ID_RETIRE", "USER_CREATE")


@router.get("/auth/me/activity")
def my_activity(limit: int = 30, user: User = Depends(current_user), db: Session = Depends(get_db, scope="function")):
    """The account's own security-relevant events, newest first. Failed sign-ins are found by the username they named
    (the attempt had no authenticated actor)."""
    limit = max(1, min(limit, 100))
    rows = (db.query(AuditEvent)
            .filter(or_(and_(AuditEvent.actor_id == user.user_id, AuditEvent.action.in_(SELF_ACTIONS)),
                        and_(AuditEvent.target_id == user.user_id, AuditEvent.action.in_(ON_ME_ACTIONS),
                             or_(AuditEvent.actor_id.is_(None), AuditEvent.actor_id != user.user_id)),
                        and_(AuditEvent.target_id == user.username, AuditEvent.action.in_(("LOGIN", "ACCOUNT_LOCKED")),
                             AuditEvent.outcome == "DENIED")))
            .order_by(AuditEvent.created_at.desc()).limit(limit).all())
    out = []
    for a in rows:
        d = a.detail or {}
        by_admin = a.actor_id not in (None, user.user_id)
        out.append({"at": _iso(a.created_at), "action": a.action, "outcome": a.outcome,
                    "reason": d.get("reason") if a.outcome != "OK" else None,
                    "ip_address": a.ip_address or d.get("ip"),
                    "by": a.actor_username if by_admin else None})
    return {"events": out}
