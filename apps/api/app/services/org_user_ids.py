"""Organisational user IDs: manual, controlled allocation by administrators (ADR-019, docs/USER_ID_ALLOCATION.md).

Two identifiers, deliberately separate:
- users.user_id ("USR-<hex>") is the internal primary key. Every foreign key, audit row, session and override refers to
  it. It is generated, never shown as "the" user ID, and never changes.
- users.org_user_id is the identifier the organisation issues (a service or employee number). Administrators allocate
  it, at account creation or later; it is what the UI shows as "User ID".

Rules enforced here and by the database, not by the UI:
- Format: trimmed and upper-cased, 3-32 characters, matching config.ORG_USER_ID_PATTERN. The "USR-" prefix is refused
  because it is the internal key namespace (an organisational ID must never be mistaken for an internal one).
- Unique: at most one holder at a time (users.org_user_id is unique; uix_org_user_ids_active_user allows one ACTIVE
  allocation per user).
- Never reused: changing or retiring an ID marks its registry row RETIRED, and uix_org_user_ids_taken keeps a RETIRED
  ID unavailable forever. The only exception is a correction: an ID assigned in error may be VOIDED within
  config.ORG_USER_ID_CORRECTION_HOURS of its allocation, which frees it for its rightful holder.
- Compare-and-set: every change names the ID it expects the user to hold now (None = none). A conditional UPDATE on
  users makes a concurrent second change fail with 409 instead of silently overwriting the first.
- Only ADMIN (route gate "manageUsers", not overridable), never for their own account, always with a reason.
- Every change writes the registry row and a signed audit event in the same transaction (fail-closed).
"""
from __future__ import annotations

import datetime
import re

from fastapi import HTTPException
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import config
from ..models import OrgUserIdAssignment, User
from .audit import record_audit

MIN_LEN, MAX_LEN = 3, 32
RESERVED_PREFIX = "USR-"
REASON_MIN, REASON_MAX = 5, 500
CREATION_REASON = "allocated at account creation"
_PATTERN = re.compile(config.ORG_USER_ID_PATTERN)


class OrgUserIdError(HTTPException):
    """An HTTPException with a stable machine-readable code (the error envelope's `code`)."""

    def __init__(self, status_code: int, detail: str, code: str):
        super().__init__(status_code, detail)
        self.code = code


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)


def _iso(dt: datetime.datetime | None) -> str | None:
    return dt.replace(tzinfo=datetime.timezone.utc).isoformat() if dt else None


def normalize(raw: str) -> str:
    """Canonical form of an organisational ID, or OrgUserIdError(422). Comparison and uniqueness use this form, so
    "dl-0042", " DL-0042 " and "DL-0042" are the same ID."""
    value = (raw or "").strip().upper()
    if not MIN_LEN <= len(value) <= MAX_LEN:
        raise OrgUserIdError(422, f"User ID must be {MIN_LEN}-{MAX_LEN} characters", "ORG_USER_ID_INVALID")
    if value.startswith(RESERVED_PREFIX):
        raise OrgUserIdError(422, f"User IDs may not start with {RESERVED_PREFIX!r}: that prefix is reserved for "
                                  "internal account keys", "ORG_USER_ID_RESERVED")
    if not _PATTERN.fullmatch(value):
        raise OrgUserIdError(422, "User ID does not match the organisation's format (letters, digits and single "
                                  "hyphens; must start and end with a letter or digit)", "ORG_USER_ID_INVALID")
    return value


def _check_reason(reason: str) -> str:
    reason = (reason or "").strip()
    if not REASON_MIN <= len(reason) <= REASON_MAX:
        raise OrgUserIdError(422, f"A reason of {REASON_MIN}-{REASON_MAX} characters is required", "REASON_REQUIRED")
    return reason


def _ensure_available(db: Session, value: str, target: User) -> None:
    """Friendly 409s for the common cases. The unique indexes are the real guarantee (a concurrent allocation of the
    same ID that passes this check still fails at flush, see _flush_or_conflict)."""
    taken = (db.query(OrgUserIdAssignment)
             .filter(OrgUserIdAssignment.org_user_id == value, OrgUserIdAssignment.status.in_(("ACTIVE", "RETIRED")))
             .first())
    if taken is None:
        return
    if taken.status == "ACTIVE" and taken.user_id == target.user_id:
        raise OrgUserIdError(409, "This account already holds that user ID", "ORG_USER_ID_UNCHANGED")
    if taken.status == "ACTIVE":
        raise OrgUserIdError(409, "That user ID is assigned to another account", "ORG_USER_ID_IN_USE")
    raise OrgUserIdError(409, "That user ID was assigned before and cannot be reused", "ORG_USER_ID_RETIRED")


def _flush_or_conflict(db: Session) -> None:
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise OrgUserIdError(409, "That user ID was taken by a concurrent change; reload and try again",
                             "ORG_USER_ID_CONFLICT")


def allocate_at_creation(db: Session, actor: User, new_user: User, raw: str) -> str:
    """Allocate an organisational ID to an account being created (same transaction as the account). The caller has
    already flushed new_user and records the USER_CREATE audit event, which carries the ID."""
    value = normalize(raw)
    _ensure_available(db, value, new_user)
    new_user.org_user_id = value
    db.add(OrgUserIdAssignment(org_user_id=value, user_id=new_user.user_id, status="ACTIVE", assigned_by=actor.user_id,
                               assigned_at=_now(), assign_reason=CREATION_REASON))
    _flush_or_conflict(db)
    return value


def _guard(actor: User, target: User) -> None:
    if actor.user_id == target.user_id:
        raise OrgUserIdError(403, "Another administrator must change your own user ID", "SELF_CHANGE_FORBIDDEN")


def _expect(target: User, expected: str | None) -> str | None:
    """Compare the caller's view of the current ID with the stored one (both canonical)."""
    expected = expected.strip().upper() if expected and expected.strip() else None
    if expected != target.org_user_id:
        raise OrgUserIdError(409, "The user's ID changed since you loaded it; reload and try again",
                             "ORG_USER_ID_STALE")
    return expected


def _cas_user(db: Session, target: User, expected: str | None, new: str | None) -> None:
    """Atomically move users.org_user_id from `expected` to `new`; 409 if someone else changed it first."""
    cond = User.org_user_id.is_(None) if expected is None else (User.org_user_id == expected)
    try:
        res = db.execute(update(User).where(User.user_id == target.user_id, cond).values(org_user_id=new)
                         .execution_options(synchronize_session=False))
    except IntegrityError:
        db.rollback()
        raise OrgUserIdError(409, "That user ID was taken by a concurrent change; reload and try again",
                             "ORG_USER_ID_CONFLICT")
    if res.rowcount != 1:
        db.rollback()
        raise OrgUserIdError(409, "The user's ID changed since you loaded it; reload and try again",
                             "ORG_USER_ID_STALE")


def _end_active(db: Session, target: User, value: str, status: str, actor: User, reason: str, now) -> OrgUserIdAssignment:
    row = (db.query(OrgUserIdAssignment)
           .filter_by(user_id=target.user_id, org_user_id=value, status="ACTIVE").first())
    if row is None:  # users.org_user_id and the registry disagree: refuse rather than guess
        db.rollback()
        raise OrgUserIdError(409, "The user ID registry is inconsistent for this account; contact the system "
                                  "administrator", "ORG_USER_ID_REGISTRY_MISMATCH")
    row.status, row.ended_by, row.ended_at, row.end_reason = status, actor.user_id, now, reason
    return row


def assign(db: Session, actor: User, target: User, raw: str, *, expected: str | None, reason: str,
           correction: bool, trace_id: str) -> dict:
    """Allocate a first ID or replace the current one. The replaced ID is RETIRED (never reusable) or, with
    correction=True and inside the correction window, VOIDED (free again)."""
    _guard(actor, target)
    reason = _check_reason(reason)
    value = normalize(raw)
    previous = _expect(target, expected)
    if previous == value:
        raise OrgUserIdError(409, "This account already holds that user ID", "ORG_USER_ID_UNCHANGED")
    now = _now()
    end_status = "RETIRED"
    if correction:
        if previous is None:
            raise OrgUserIdError(422, "A correction replaces an ID assigned in error; this account has none",
                                 "CORRECTION_NOT_APPLICABLE")
        if config.ORG_USER_ID_CORRECTION_HOURS <= 0:
            raise OrgUserIdError(422, "Corrections are disabled by configuration", "CORRECTION_DISABLED")
        held = (db.query(OrgUserIdAssignment)
                .filter_by(user_id=target.user_id, org_user_id=previous, status="ACTIVE").first())
        if held is not None and now - held.assigned_at > datetime.timedelta(hours=config.ORG_USER_ID_CORRECTION_HOURS):
            raise OrgUserIdError(422, f"The current ID was allocated more than {config.ORG_USER_ID_CORRECTION_HOURS} "
                                      "hours ago, so it can only be retired, not voided", "CORRECTION_WINDOW_PASSED")
        end_status = "VOIDED"
    _ensure_available(db, value, target)

    _cas_user(db, target, previous, value)
    if previous:
        _end_active(db, target, previous, end_status, actor, reason, now)
        _flush_or_conflict(db)  # the old row must leave ACTIVE before the new one may enter it
    db.add(OrgUserIdAssignment(org_user_id=value, user_id=target.user_id, status="ACTIVE", assigned_by=actor.user_id,
                               assigned_at=now, assign_reason=reason))
    _flush_or_conflict(db)
    action = "USER_ID_ASSIGN" if previous is None else ("USER_ID_CORRECT" if correction else "USER_ID_CHANGE")
    record_audit(db, trace_id, actor.user_id, action, "USER", target.user_id,
                 detail={"username": target.username, "org_user_id": value, "previous_org_user_id": previous,
                         "previous_status": end_status if previous else None, "reason": reason})
    db.commit()
    db.refresh(target)
    return {"user_id": target.user_id, "org_user_id": target.org_user_id, "previous_org_user_id": previous,
            "previous_status": end_status if previous else None}


def retire(db: Session, actor: User, target: User, *, expected: str | None, reason: str, trace_id: str) -> dict:
    """Withdraw the current ID without a replacement (e.g. the person left). The ID is RETIRED: never reusable."""
    _guard(actor, target)
    reason = _check_reason(reason)
    previous = _expect(target, expected)
    if previous is None:
        raise OrgUserIdError(409, "This account has no user ID to retire", "ORG_USER_ID_NONE")
    now = _now()
    _cas_user(db, target, previous, None)
    _end_active(db, target, previous, "RETIRED", actor, reason, now)
    _flush_or_conflict(db)
    record_audit(db, trace_id, actor.user_id, "USER_ID_RETIRE", "USER", target.user_id,
                 detail={"username": target.username, "org_user_id": previous, "reason": reason})
    db.commit()
    db.refresh(target)
    return {"user_id": target.user_id, "org_user_id": None, "previous_org_user_id": previous,
            "previous_status": "RETIRED"}


def row_out(row: OrgUserIdAssignment, names: dict[str, str]) -> dict:
    return {"assignment_id": row.assignment_id, "org_user_id": row.org_user_id, "user_id": row.user_id,
            "username": names.get(row.user_id), "status": row.status,
            "assigned_by": row.assigned_by, "assigned_by_username": names.get(row.assigned_by),
            "assigned_at": _iso(row.assigned_at), "assign_reason": row.assign_reason,
            "ended_by": row.ended_by, "ended_by_username": names.get(row.ended_by) if row.ended_by else None,
            "ended_at": _iso(row.ended_at), "end_reason": row.end_reason}


def _names(db: Session, rows: list[OrgUserIdAssignment]) -> dict[str, str]:
    ids = {r.user_id for r in rows} | {r.assigned_by for r in rows} | {r.ended_by for r in rows if r.ended_by}
    return {u.user_id: u.username for u in db.query(User).filter(User.user_id.in_(ids)).all()} if ids else {}


def history_for_user(db: Session, target: User) -> list[dict]:
    rows = (db.query(OrgUserIdAssignment).filter_by(user_id=target.user_id)
            .order_by(OrgUserIdAssignment.assigned_at.desc(), OrgUserIdAssignment.assignment_id.desc()).all())
    names = _names(db, rows)
    return [row_out(r, names) for r in rows]


def lookup(db: Session, raw: str) -> list[dict]:
    """Every allocation of one organisational ID (normally one row; more only if it was voided and re-allocated).
    Answers "who held this ID, and when"."""
    value = (raw or "").strip().upper()
    if not value or len(value) > MAX_LEN:
        return []
    rows = (db.query(OrgUserIdAssignment).filter_by(org_user_id=value)
            .order_by(OrgUserIdAssignment.assigned_at.desc(), OrgUserIdAssignment.assignment_id.desc()).all())
    names = _names(db, rows)
    return [row_out(r, names) for r in rows]
