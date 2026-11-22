"""Case assignment management (ADR-020, docs/CASE_ASSIGNMENT.md).

Who may open a case is decided on every request by auth.authorize_case from two facts this module maintains:
- cases.owner_id: the case's primary (lead) investigator;
- case_assignments: everyone on the case. The primary investigator always has a row; every other row is a
  supporting member (investigator, evidence officer, reviewer or analyst).
ADMIN and AUDITOR see every case by role and are never assigned. Jurisdiction stays mandatory in authorize_case, and a
permission override on "caseAccess" can still deny (or, for a non-member, allow) access.

Because authorization reads these rows on every request, an assignment, removal or handover takes effect on the
person's next request; existing sessions do not keep stale access.

Rules enforced here, not in the UI:
- Assign: an ADMIN, or the case's primary investigator (as before). Remove and change of primary: ADMIN only.
- A reason (5-500 characters) for every change; every change writes a case_assignment_events row (append-only), a
  signed audit event and a notification to the person concerned, all in the same transaction.
- The person must be active, in the case's jurisdiction, and in a role that case assignment governs. The primary
  investigator must be an INVESTIGATOR.
- The primary investigator cannot be removed; hand the case over first.
- Concurrency: every change locks the case row (SELECT ... FOR UPDATE on PostgreSQL; SQLite serialises writers), the
  (case_id, user_id) unique constraint stops duplicate rows, removal is a conditional DELETE, and a handover names the
  primary investigator the caller expects (409 PRIMARY_CHANGED otherwise).
"""
from __future__ import annotations

import datetime
import itertools
import uuid

from fastapi import HTTPException
from sqlalchemy import delete, exists, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..models import Case, CaseAssignment, CaseAssignmentEvent, Notification, User
from . import overrides
from .audit import record_audit

ASSIGNABLE_ROLES = ("INVESTIGATOR", "EVIDENCE_OFFICER", "REVIEWER", "ANALYST")
PRIMARY_ROLE = "INVESTIGATOR"
OVERSIGHT_ROLES = ("ADMIN", "AUDITOR")
REASON_MIN, REASON_MAX = 5, 500
PURPOSE_MAX = 60


class AssignmentError(HTTPException):
    """An HTTPException with a stable machine-readable code (the error envelope's `code`)."""

    def __init__(self, status_code: int, detail: str, code: str):
        super().__init__(status_code, detail)
        self.code = code


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)


def _iso(dt: datetime.datetime | None) -> str | None:
    return dt.replace(tzinfo=datetime.timezone.utc).isoformat() if dt else None


def _reason(reason: str | None) -> str:
    reason = (reason or "").strip()
    if not REASON_MIN <= len(reason) <= REASON_MAX:
        raise AssignmentError(422, f"A reason of {REASON_MIN}-{REASON_MAX} characters is required", "REASON_REQUIRED")
    return reason


def _purpose(purpose: str | None) -> str:
    purpose = " ".join((purpose or "investigation").split())
    if not 1 <= len(purpose) <= PURPOSE_MAX:
        raise AssignmentError(422, f"Purpose must be 1-{PURPOSE_MAX} characters", "PURPOSE_INVALID")
    return purpose


def lock_case(db: Session, case_id: str) -> Case:
    """Re-read the case row with a row lock, so concurrent changes to one case's team are applied one at a time."""
    case = db.execute(select(Case).where(Case.case_id == case_id).with_for_update()
                      .execution_options(populate_existing=True)).scalar_one_or_none()
    if case is None:
        raise AssignmentError(404, "unknown case", "CASE_NOT_FOUND")
    return case


def _row(db: Session, case_id: str, user_id: str) -> CaseAssignment | None:
    return db.query(CaseAssignment).filter_by(case_id=case_id, user_id=user_id).first()


def _eligible(case: Case, target: User, *, primary: bool = False) -> None:
    if not target.active:
        raise AssignmentError(400, "cannot assign a deactivated user", "USER_INACTIVE")
    if target.role in OVERSIGHT_ROLES:
        raise AssignmentError(400, f"{target.role} accounts see every case by role and are not assigned to cases",
                              "ROLE_NOT_ASSIGNABLE")
    if target.role not in ASSIGNABLE_ROLES:
        raise AssignmentError(400, f"role {target.role} cannot be assigned to a case", "ROLE_NOT_ASSIGNABLE")
    if primary and target.role != PRIMARY_ROLE:
        raise AssignmentError(400, "the primary investigator must have the Investigator role", "PRIMARY_ROLE_REQUIRED")
    if target.jurisdiction != case.jurisdiction:
        raise AssignmentError(400, f"user's jurisdiction ({target.jurisdiction!r}) does not match the case's "
                                   f"({case.jurisdiction!r})", "JURISDICTION_MISMATCH")


_SEQ = itertools.count()


def _event(db: Session, case: Case, target_id: str, event: str, actor: User, reason: str, now, purpose=None,
           **detail) -> None:
    # Several events of one change share `now`; the ID sorts in creation order (time, then a per-process counter),
    # so the history reads in the order things happened.
    event_id = f"CAE-{now:%Y%m%d%H%M%S%f}-{next(_SEQ) % 10**8:08d}-{uuid.uuid4().hex[:6]}"
    db.add(CaseAssignmentEvent(event_id=event_id, case_id=case.case_id, user_id=target_id, event=event, purpose=purpose,
                               actor_id=actor.user_id, actor_role=actor.role, at=now, reason=reason, detail=detail))


def _notify(db: Session, user_id: str, case: Case, kind: str, title: str, body: str, link: str | None, now) -> None:
    # Title and body name the case reference only, never case content (same rule as user-request notifications).
    db.add(Notification(user_id=user_id, kind=kind, title=title[:200], body=body[:500], link=link, created_at=now))


def record_creation(db: Session, case: Case, creator: User, now=None) -> None:
    """Called by POST /cases: the creator becomes primary investigator. Writes the history rows for it."""
    now = now or _now()
    row = next((a for a in case.assignments if a.user_id == creator.user_id), None)
    if row is not None:
        row.assigned_by, row.assigned_at, row.reason = creator.user_id, now, "case created"
    _event(db, case, creator.user_id, "ASSIGNED", creator, "case created", now, purpose="owner")
    _event(db, case, creator.user_id, "PRIMARY_SET", creator, "case created", now)


def assign(db: Session, actor: User, case_id: str, target: User, *, purpose: str | None, reason: str | None,
           trace_id: str, via: str | None = None) -> CaseAssignment:
    """Add `target` to the case as a supporting member. 409 ALREADY_ASSIGNED if they are on it."""
    reason, purpose = _reason(reason), _purpose(purpose)
    case = lock_case(db, case_id)
    if actor.role != "ADMIN" and case.owner_id != actor.user_id:
        raise AssignmentError(403, "only the primary investigator or an ADMIN may assign people", "NOT_PERMITTED")
    _eligible(case, target)
    if _row(db, case.case_id, target.user_id) is not None:
        raise AssignmentError(409, "this person is already on the case", "ALREADY_ASSIGNED")
    now = _now()
    row = CaseAssignment(case_id=case.case_id, user_id=target.user_id, purpose=purpose, assigned_by=actor.user_id,
                         assigned_at=now, reason=reason)
    db.add(row)
    try:
        db.flush()
    except IntegrityError:  # a concurrent assignment of the same person won the race
        db.rollback()
        raise AssignmentError(409, "this person is already on the case", "ALREADY_ASSIGNED")
    _event(db, case, target.user_id, "ASSIGNED", actor, reason, now, purpose=purpose, **({"via": via} if via else {}))
    record_audit(db, trace_id, actor.user_id, "CASE_ASSIGN", "USER", target.user_id, case.case_id,
                 detail={"purpose": purpose, "reason": reason, **({"via_request": via} if via else {})})
    _notify(db, target.user_id, case, "CASE_ASSIGNED", f"You were added to {case.case_id}",
            f"Purpose: {purpose}. Reason: {reason}", f"/cases/{case.case_id}", now)
    return row


def remove(db: Session, actor: User, case_id: str, target_id: str, *, reason: str | None, trace_id: str) -> dict:
    """Take a supporting member off the case (ADMIN only; the route enforces the role)."""
    reason = _reason(reason)
    case = lock_case(db, case_id)
    if case.owner_id == target_id:
        raise AssignmentError(409, "the primary investigator cannot be removed; hand the case over first",
                              "PRIMARY_CANNOT_BE_REMOVED")
    row = _row(db, case.case_id, target_id)
    if row is None:
        raise AssignmentError(409, "this person is not on the case", "NOT_ASSIGNED")
    purpose = row.purpose
    # One statement: delete only if the row exists AND the person is not (now) the primary investigator. Atomic on
    # SQLite too, where the row lock above does nothing.
    is_primary = exists().where(Case.case_id == case.case_id, Case.owner_id == target_id)
    res = db.execute(delete(CaseAssignment).where(CaseAssignment.case_id == case.case_id,
                                                  CaseAssignment.user_id == target_id, ~is_primary)
                     .execution_options(synchronize_session=False))
    if res.rowcount != 1:
        db.rollback()
        raise AssignmentError(409, "the case team changed at the same moment; reload and try again", "CONFLICT")
    db.expire_all()
    now = _now()
    _event(db, case, target_id, "REMOVED", actor, reason, now, purpose=purpose)
    record_audit(db, trace_id, actor.user_id, "CASE_UNASSIGN", "USER", target_id, case.case_id,
                 detail={"purpose": purpose, "reason": reason})
    _notify(db, target_id, case, "CASE_REMOVED", f"You were removed from {case.case_id}", f"Reason: {reason}", None, now)
    target = db.get(User, target_id)
    still = bool(target) and overrides.evaluate(db, target, "caseAccess", baseline=False, case_id=case.case_id,
                                                resource=("CASE", case.case_id)).allowed
    return {"case_id": case.case_id, "user_id": target_id, "removed": True,
            # An active ALLOW override on caseAccess still lets this person in; say so rather than imply otherwise.
            "access_remains_via_override": still}


def set_primary(db: Session, actor: User, case_id: str, target: User, *, expected_primary_id: str | None,
                reason: str | None, previous: str, trace_id: str) -> dict:
    """Hand the case to a new primary investigator (ADMIN only). previous = "KEEP" (stays as supporting member) or
    "REMOVE" (taken off the case)."""
    reason = _reason(reason)
    if previous not in ("KEEP", "REMOVE"):
        raise AssignmentError(422, "previous must be KEEP or REMOVE", "INVALID_PREVIOUS")
    case = lock_case(db, case_id)
    if expected_primary_id != case.owner_id:
        raise AssignmentError(409, "the primary investigator changed since you loaded the case; reload and try again",
                              "PRIMARY_CHANGED")
    if target.user_id == case.owner_id:
        raise AssignmentError(409, "this person is already the primary investigator", "ALREADY_PRIMARY")
    _eligible(case, target, primary=True)
    now = _now()
    old_id = case.owner_id
    # Compare-and-set: only one concurrent handover based on the same primary investigator can succeed (atomic on
    # SQLite too, where the row lock above does nothing).
    res = db.execute(update(Case).where(Case.case_id == case.case_id, Case.owner_id == old_id)
                     .values(owner_id=target.user_id).execution_options(synchronize_session=False))
    if res.rowcount != 1:
        db.rollback()
        raise AssignmentError(409, "the primary investigator changed since you loaded the case; reload and try again",
                              "PRIMARY_CHANGED")
    db.expire(case)
    row = _row(db, case.case_id, target.user_id)
    if row is None:
        db.add(CaseAssignment(case_id=case.case_id, user_id=target.user_id, purpose="primary investigator",
                              assigned_by=actor.user_id, assigned_at=now, reason=reason))
        _event(db, case, target.user_id, "ASSIGNED", actor, reason, now, purpose="primary investigator")
    _event(db, case, target.user_id, "PRIMARY_SET", actor, reason, now, previous_primary=old_id)
    _event(db, case, old_id, "PRIMARY_RELEASED", actor, reason, now, new_primary=target.user_id, previous=previous)
    if previous == "REMOVE":
        db.execute(delete(CaseAssignment).where(CaseAssignment.case_id == case.case_id, CaseAssignment.user_id == old_id)
                   .execution_options(synchronize_session=False))
        _event(db, case, old_id, "REMOVED", actor, reason, now, handover_to=target.user_id)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise AssignmentError(409, "the case team changed at the same moment; reload and try again", "CONFLICT")
    record_audit(db, trace_id, actor.user_id, "CASE_PRIMARY_CHANGE", "CASE", case.case_id, case.case_id,
                 detail={"from": old_id, "to": target.user_id, "previous": previous, "reason": reason})
    _notify(db, target.user_id, case, "CASE_PRIMARY", f"You are now primary investigator of {case.case_id}",
            f"Reason: {reason}", f"/cases/{case.case_id}", now)
    if old_id:
        _notify(db, old_id, case, "CASE_PRIMARY", f"{case.case_id} was handed over",
                ("You remain on the case as a supporting member. " if previous == "KEEP" else
                 "You were removed from the case. ") + f"Reason: {reason}",
                f"/cases/{case.case_id}" if previous == "KEEP" else None, now)
    return {"case_id": case.case_id, "primary_id": target.user_id, "previous_primary_id": old_id, "previous": previous}


# ------------------------------------------------------------------------------------------------ read side
def access_status(db: Session, case: Case, user: User | None) -> str:
    """Whether an assigned person can actually open the case right now, in authorize_case's terms."""
    if user is None:
        return "UNKNOWN_USER"
    if not user.active:
        return "DEACTIVATED"
    if user.role in OVERSIGHT_ROLES:
        return "OK"
    if user.jurisdiction != case.jurisdiction:
        return "JURISDICTION_MISMATCH"
    d = overrides.evaluate(db, user, "caseAccess", baseline=True, case_id=case.case_id, resource=("CASE", case.case_id))
    return "OK" if d.allowed else "DENIED_BY_OVERRIDE"


def _person(u: User | None, uid: str) -> dict:
    if u is None:
        return {"user_id": uid, "org_user_id": None, "username": None, "display_name": None, "role": None,
                "jurisdiction": None, "active": False}
    return {"user_id": u.user_id, "org_user_id": u.org_user_id, "username": u.username, "display_name": u.display_name,
            "role": u.role, "jurisdiction": u.jurisdiction, "active": u.active}


def members(db: Session, case: Case) -> list[dict]:
    rows = db.query(CaseAssignment).filter_by(case_id=case.case_id).order_by(CaseAssignment.id).all()
    ids = {r.user_id for r in rows} | {r.assigned_by for r in rows if r.assigned_by}
    users = {u.user_id: u for u in db.query(User).filter(User.user_id.in_(ids)).all()} if ids else {}
    out = []
    for r in rows:
        u = users.get(r.user_id)
        by = users.get(r.assigned_by) if r.assigned_by else None
        out.append({**_person(u, r.user_id), "purpose": r.purpose, "is_primary": r.user_id == case.owner_id,
                    "assigned_by": r.assigned_by, "assigned_by_username": by.username if by else None,
                    "assigned_at": _iso(r.assigned_at), "reason": r.reason, "access": access_status(db, case, u)})
    out.sort(key=lambda m: (not m["is_primary"], (m["display_name"] or "").lower()))
    return out


def history(db: Session, case_id: str, limit: int = 200) -> list[dict]:
    rows = (db.query(CaseAssignmentEvent).filter_by(case_id=case_id)
            .order_by(CaseAssignmentEvent.at.desc(), CaseAssignmentEvent.event_id.desc()).limit(limit).all())
    ids = {r.user_id for r in rows} | {r.actor_id for r in rows}
    users = {u.user_id: u for u in db.query(User).filter(User.user_id.in_(ids)).all()} if ids else {}
    return [{"event_id": r.event_id, "event": r.event, "user": _person(users.get(r.user_id), r.user_id),
             "purpose": r.purpose, "actor_id": r.actor_id,
             "actor_username": users[r.actor_id].username if r.actor_id in users else None,
             "actor_role": r.actor_role, "at": _iso(r.at), "reason": r.reason, "detail": r.detail} for r in rows]


def case_overview(db: Session, case: Case, team: list[dict] | None = None) -> dict:
    team = team if team is not None else members(db, case)
    primary = next((m for m in team if m["is_primary"]), None)
    issues = []
    if primary is None:
        issues.append("NO_PRIMARY")
    elif primary["access"] != "OK":
        issues.append(f"PRIMARY_{primary['access']}")
    if primary is not None and primary["role"] != PRIMARY_ROLE:
        issues.append("PRIMARY_NOT_INVESTIGATOR")  # e.g. a case an administrator created: hand it to an investigator
    blocked = [m for m in team if not m["is_primary"] and m["access"] != "OK"]
    if blocked:
        issues.append("MEMBER_ACCESS_BLOCKED")
    if not any(m for m in team if not m["is_primary"] and m["access"] == "OK"):
        issues.append("NO_SUPPORTING_MEMBERS")
    return {"case_id": case.case_id, "title": case.title, "jurisdiction": case.jurisdiction, "primary": primary,
            "member_count": len(team), "blocked_count": len(blocked), "issues": issues}


ATTENTION_ISSUES = {"NO_PRIMARY", "PRIMARY_DEACTIVATED", "PRIMARY_JURISDICTION_MISMATCH", "PRIMARY_DENIED_BY_OVERRIDE",
                    "PRIMARY_UNKNOWN_USER", "PRIMARY_NOT_INVESTIGATOR", "MEMBER_ACCESS_BLOCKED"}


def list_cases(db: Session, *, q: str | None, jurisdiction: str | None, user_id: str | None, attention: bool,
               unstaffed: bool) -> list[dict]:
    """Every case with its primary investigator, team size and problems. Filtering on computed state happens here,
    so the caller pages the returned list."""
    from ..routes.listing import text_filter  # LIKE wildcards in q are escaped there

    query = text_filter(db.query(Case), q, Case.case_id, Case.title)
    if jurisdiction:
        query = query.filter(Case.jurisdiction == jurisdiction)
    if user_id:
        query = query.filter(Case.case_id.in_(select(CaseAssignment.case_id).where(CaseAssignment.user_id == user_id)))
    out = []
    for case in query.order_by(Case.case_id).all():
        o = case_overview(db, case)
        if attention and not (set(o["issues"]) & ATTENTION_ISSUES):
            continue
        if unstaffed and "NO_SUPPORTING_MEMBERS" not in o["issues"]:
            continue
        out.append(o)
    return out
