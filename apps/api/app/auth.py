"""Authentication (JWT) and authorization (role + case assignment + jurisdiction).

Every authorization decision happens on the server. The frontend never talks to the
graph store or the object store directly.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import time

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from . import config
from .db import get_db
from .models import Case, CaseAssignment, User
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


# ------------------------------------------------------------------ tokens
def issue_token(user: User) -> str:
    now = int(time.time())
    payload = {"sub": user.user_id, "role": user.role, "jur": user.jurisdiction, "iat": now, "exp": now + TOKEN_TTL_SECONDS}
    return jwt.encode(payload, config.SECRET_KEY, algorithm="HS256")


def current_user(request: Request, creds: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)) -> User:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required")
    try:
        payload = jwt.decode(creds.credentials, config.SECRET_KEY, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    user = db.get(User, payload["sub"])
    if user is None or not user.active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unknown user")
    request.state.user = user
    return user


# ------------------------------------------------------------------ policy checks
def require_roles(*roles: str):
    def _dep(user: User = Depends(current_user)) -> User:
        if user.role not in roles and user.role != "ADMIN":
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
