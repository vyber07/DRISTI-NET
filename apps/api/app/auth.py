"""Authentication (JWT) and authorization (role + case assignment + jurisdiction).

Every authorization decision happens on the server. The frontend never talks to the
graph store or the object store directly.
"""
from __future__ import annotations

import datetime
import functools
import hashlib
import hmac
import os
import secrets
import time

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from . import config
from .db import get_db
from .core import request_context
from .models import Case, CaseAssignment, User, UserSession, utcnow
from .services import ratelimit
from .services.audit import record_audit

bearer = HTTPBearer(auto_error=False)
TOKEN_TTL_SECONDS = 8 * 3600


# ------------------------------------------------------------------ passwords (stdlib PBKDF2; demo users only)
def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 120_000)
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    salt_hex, digest_hex = stored.split("$", 1)
    candidate = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), 120_000)
    return hmac.compare_digest(candidate.hex(), digest_hex)


@functools.lru_cache(maxsize=1)
def _dummy_hash() -> str:
    return hash_password("dummy-password-never-matches")


def verify_absent_user(password: str) -> bool:
    """Spend the same hashing cost as a real verification when the username does not exist, so response
    timing does not reveal which usernames are valid. Always returns False."""
    verify_password(password, _dummy_hash())
    return False


# ------------------------------------------------------------------ tokens and sessions
def _now_naive_utc() -> datetime.datetime:
    """Stored timestamps are naive UTC (the audit and session tables); comparisons must use the same convention."""
    return utcnow().replace(tzinfo=None)


def create_session(db: Session, user: User, ip: str | None, user_agent: str | None) -> str:
    """One server-side session per login. Its ID travels in the token's "sid" claim; logout revokes it."""
    sid = secrets.token_urlsafe(24)
    now = _now_naive_utc()
    db.add(UserSession(sid=sid, user_id=user.user_id, created_at=now,
                       expires_at=now + datetime.timedelta(seconds=TOKEN_TTL_SECONDS), ip_address=ip, user_agent=user_agent))
    return sid


def issue_token(user: User, sid: str) -> str:
    now = int(time.time())
    payload = {"sub": user.user_id, "role": user.role, "jur": user.jurisdiction, "tv": user.token_version, "sid": sid,
               "iat": now, "exp": now + TOKEN_TTL_SECONDS}
    return jwt.encode(payload, config.SECRET_KEY, algorithm="HS256")


def _reject(request: Request, db: Session, user: User | None, reason: str) -> None:
    """Refuse a request whose token is well-formed but no longer acceptable. Audited when the subject is a known
    account (malformed or forged tokens are not audited, to keep unauthenticated traffic from filling the log)."""
    if user is not None:
        record_audit(db, getattr(request.state, "trace_id", "-"), user.user_id, "AUTH_TOKEN_REJECTED", "USER", user.user_id,
                     outcome="DENIED", detail={"reason": reason})
        db.commit()
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")


def current_user(request: Request, creds: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)) -> User:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required")
    try:
        payload = jwt.decode(creds.credentials, config.SECRET_KEY, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    user = db.get(User, payload["sub"])
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unknown user")
    if not user.active:
        _reject(request, db, user, "account inactive")
    # Server-side session: revoked by logout, expired, or absent (tokens issued before sessions existed have no sid).
    sid = payload.get("sid")
    session = db.get(UserSession, sid) if sid else None
    if session is not None and session.user_id == user.user_id:
        # The session is confirmed to belong to this user, so refusals below can name it in the audit trail.
        # An unknown or mismatched sid is never recorded.
        request_context.set_actor(user, sid)
    if session is None or session.user_id != user.user_id:
        _reject(request, db, user, "no such session")
    if session.revoked_at is not None:
        _reject(request, db, user, "session revoked")
    if session.expires_at <= _now_naive_utc():
        _reject(request, db, user, "session expired")
    # SEC-02: a token issued before the account's last password reset carries a stale "tv" claim.
    # Tokens have no other revocation mechanism, so this is what makes a reset actually take effect
    # immediately instead of leaving every already-issued token valid until its own natural expiry.
    if payload.get("tv") != user.token_version:
        _reject(request, db, user, "password changed after token issued")
    # DoS layer, per account: the ceiling depends on the account's role (config.API_USER_RATE_PER_MIN_BY_ROLE).
    # Applied only after the token is verified, so the key is a real user id and cannot be chosen by a caller.
    limits = config.API_USER_RATE_PER_MIN_BY_ROLE
    decision = ratelimit.hit(f"drishti:rl:user:{user.user_id}", limits.get(user.role, limits["DEFAULT"]), 60)
    if not decision.allowed:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many requests for this account; try again shortly",
                            headers={"Retry-After": str(decision.retry_after)})
    request.state.user = user
    # Audit context: the actor, session and office come from this database row, not from the request.
    request_context.set_actor(user, sid)
    return user


# ------------------------------------------------------------------ policy checks
def require_roles(*roles: str):
    def _dep(request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)) -> User:
        if user.role not in roles and user.role != "ADMIN":
            # DEF-049: docs/context.md §6.1 "Unauthorized request -> deny server-side and audit". Role denials
            # were raised without an audit row (case denials were audited).
            case_id = request.path_params.get("case_id")
            record_audit(db, getattr(request.state, "trace_id", "-"), user.user_id, "ACCESS_DENIED", "ROUTE",
                         f"{request.method} {request.url.path}", case_id, outcome="DENIED",
                         detail={"reason": "role not permitted", "role": user.role, "required": sorted(roles)})
            db.commit()
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Role {user.role} may not perform this action")
        return user
    return _dep


def authorize_case(db: Session, user: User, case_id: str, request: Request, action: str = "CASE_VIEW") -> Case:
    """Deny unless the user is assigned to the case (or is ADMIN/AUDITOR) and jurisdiction matches.

    Denials are audited. Existence of a case is not leaked to unassigned users (404 vs 403 both audited;
    we return 403 with a neutral message).
    """
    case = db.get(Case, case_id)
    trace_id = getattr(request.state, "trace_id", "-")
    reason = None
    if case is None:
        reason = "case not found"
    elif user.role in ("ADMIN", "AUDITOR"):
        reason = None
    else:
        assigned = db.query(CaseAssignment).filter_by(case_id=case_id, user_id=user.user_id).first()
        if assigned is None and case.owner_id != user.user_id:
            reason = "user not assigned to case"
        elif case.jurisdiction != user.jurisdiction:
            reason = "jurisdiction mismatch"
    if reason:
        record_audit(db, trace_id, user.user_id, "ACCESS_DENIED", "CASE", case_id, case_id, outcome="DENIED", detail={"reason": reason, "attempted_action": action})
        db.commit()
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access to this case is denied for the current user, purpose, or jurisdiction")
    return case
