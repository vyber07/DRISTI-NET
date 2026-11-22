"""User request management (docs/USER_REQUESTS.md, ADR-018).

A signed-in user raises a request; an administrator claims it, approves or rejects it with a reason, and completes it.
Completion either applies the change automatically (case access, role change) or records how it was fulfilled by hand
(temporary permission, data correction, support).

    DRAFT --submit--> PENDING --claim--> UNDER_REVIEW --approve--> APPROVED --complete--> COMPLETED
      |                  |  ^--release--'   |   `--reject--> REJECTED
      `--cancel--> CANCELLED <--cancel------'

Rules enforced here, not in the UI:
- Visibility: the requester sees their own requests; ADMIN and AUDITOR see all (AUDITOR read-only). Anyone else gets
  404, the same answer as for a request that does not exist.
- Only the requester edits (DRAFT only), submits or cancels. Only an ADMIN who is not the requester claims, decides and
  completes. Only the administrator who claimed a request approves or rejects it; any administrator may release a
  claim (with a reason), so a request is never stuck with an absent reviewer.
- Every change names the `version` it was based on. A change based on an older version fails with 409
  VERSION_CONFLICT, enforced by a conditional UPDATE, so concurrent actions cannot both succeed.
- At most one open request per requester and duplicate key: a check before insert, and a unique partial index
  (uix_user_requests_open_dedupe) for concurrent creates.
- Every change writes a user_request_events row (append-only), a signed audit event and notifications, all in the same
  transaction as the change.
"""
from __future__ import annotations

import datetime
import hashlib
import re
from dataclasses import dataclass, field

from fastapi import HTTPException
from sqlalchemy import func, or_, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..models import (ROLES, USER_REQUEST_OPEN_STATUSES, Case, CaseAssignment, Notification, User, UserRequest,
                      UserRequestEvent)
from . import overrides
from .audit import record_audit

PRIORITIES = ("LOW", "NORMAL", "HIGH", "URGENT")
MAX_OPEN_PER_USER = 10
REASON_MIN, REASON_MAX = 10, 2000
REVIEWER_ROLE = "ADMIN"
OVERSIGHT_ROLES = ("ADMIN", "AUDITOR")
_CASE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
_REFERENCE_RE = re.compile(r"^\s*UR-?0*(\d{1,9})\s*$", re.I)


class RequestError(HTTPException):
    """An HTTPException with a stable machine-readable code (the error envelope's `code`)."""

    def __init__(self, status_code: int, detail, code: str):
        super().__init__(status_code, detail)
        self.code = code


def utcnow() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)


def iso(t: datetime.datetime | None) -> str | None:
    return t.isoformat(timespec="seconds") + "Z" if t else None


def reference(request_id: int) -> str:
    return f"UR-{request_id:06d}"


# ------------------------------------------------------------------------------------------------ categories
@dataclass(frozen=True)
class Field:
    name: str
    label: str
    kind: str                      # text | choice | case | integer
    required: bool = True
    choices: tuple[str, ...] = ()
    min: int | None = None
    max: int | None = None
    help: str = ""


@dataclass(frozen=True)
class Category:
    code: str
    label: str
    description: str
    fulfilment: str                # AUTO: applied by the system on completion; MANUAL: an administrator records how
    fulfilment_text: str
    fields: tuple[Field, ...] = field(default_factory=tuple)


_PERMISSION_CHOICES = tuple(sorted(a for a in overrides.OVERRIDABLE if a not in ("caseAccess", "createUserRequest")))

CATEGORIES: dict[str, Category] = {c.code: c for c in (
    Category("CASE_ACCESS", "Access to a case",
             "Be assigned to a case you cannot open yet.",
             "AUTO", "On completion you are assigned to the case. Your jurisdiction must match the case's.",
             (Field("case_id", "Case ID", "case", help="For example CASE-0002."),
              Field("purpose", "Purpose", "choice", choices=("investigation", "review", "analysis", "oversight")))),
    Category("ROLE_CHANGE", "Change of role",
             "Ask for a different role, for example when your duties change. Administrator access cannot be requested.",
             "AUTO", "On completion your role changes and you are asked to sign in again.",
             (Field("requested_role", "Requested role", "choice", choices=tuple(r for r in ROLES if r != "ADMIN")),)),
    Category("TEMPORARY_PERMISSION", "Temporary permission",
             "Ask for one action your role does not allow, for a limited time, optionally for one case.",
             "MANUAL", "An administrator grants it as a time-limited permission override (which needs a second "
                       "administrator's approval) and records the override ID when completing the request.",
             (Field("action", "Permission", "choice", choices=_PERMISSION_CHOICES),
              Field("case_id", "Case ID (optional)", "case", required=False),
              Field("duration_days", "Duration in days", "integer", min=1, max=overrides.MAX_DURATION_DAYS))),
    Category("DATA_CORRECTION", "Data correction",
             "Report incorrect data in a case you can open, for an administrator to correct.",
             "MANUAL", "An administrator corrects the data and records what was changed.",
             (Field("case_id", "Case ID", "case"),
              Field("item_reference", "Item (evidence ID, entity ID or similar)", "text", required=False, max=120))),
    Category("SUPPORT", "General support",
             "Anything else that needs an administrator: account problems, access questions, errors you see.",
             "MANUAL", "An administrator handles it and records what was done.", ()),
)}


def categories_out() -> list[dict]:
    return [{"code": c.code, "label": c.label, "description": c.description, "fulfilment": c.fulfilment,
             "fulfilment_text": c.fulfilment_text,
             "fields": [{"name": f.name, "label": f.label, "kind": f.kind, "required": f.required, "choices": list(f.choices),
                         "min": f.min, "max": f.max, "help": f.help} for f in c.fields]}
            for c in CATEGORIES.values()]


def _invalid(errors: list[dict]):
    raise RequestError(422, errors, "INVALID_REQUEST")


def clean_details(category: str, raw: dict | None) -> dict:
    """Validate the category's fields. Unknown fields are refused, not silently dropped."""
    cat = CATEGORIES.get(category)
    if cat is None:
        _invalid([{"loc": ["body", "category"], "msg": f"unknown category; one of {', '.join(CATEGORIES)}", "type": "value_error"}])
    raw = raw or {}
    if not isinstance(raw, dict):
        _invalid([{"loc": ["body", "details"], "msg": "must be an object", "type": "type_error"}])
    errors, out = [], {}
    known = {f.name for f in cat.fields}
    for name in sorted(set(raw) - known):
        errors.append({"loc": ["body", "details", name[:40]], "msg": "not a field of this category", "type": "value_error"})
    for f in cat.fields:
        loc = ["body", "details", f.name]
        v = raw.get(f.name)
        if v is None or (isinstance(v, str) and not v.strip()):
            if f.required:
                errors.append({"loc": loc, "msg": f"{f.label} is required", "type": "missing"})
            continue
        if f.kind == "integer":
            if isinstance(v, bool) or not isinstance(v, (int, str)) or not str(v).strip().isdigit():
                errors.append({"loc": loc, "msg": "must be a whole number", "type": "type_error"}); continue
            v = int(v)
            if (f.min is not None and v < f.min) or (f.max is not None and v > f.max):
                errors.append({"loc": loc, "msg": f"must be between {f.min} and {f.max}", "type": "value_error"}); continue
        elif not isinstance(v, str):
            errors.append({"loc": loc, "msg": "must be text", "type": "type_error"}); continue
        else:
            v = v.strip()
            if f.kind == "choice" and v not in f.choices:
                errors.append({"loc": loc, "msg": f"must be one of {', '.join(f.choices)}", "type": "value_error"}); continue
            if f.kind == "case":
                v = v.upper()
                if not _CASE_ID_RE.match(v):
                    errors.append({"loc": loc, "msg": "not a valid case ID", "type": "value_error"}); continue
            if f.max is not None and len(v) > f.max:
                errors.append({"loc": loc, "msg": f"at most {f.max} characters", "type": "value_error"}); continue
        out[f.name] = v
    if errors:
        _invalid(errors)
    return out


def dedupe_key(category: str, title: str, details: dict) -> str:
    """What makes two open requests duplicates of each other (per requester)."""
    if category == "CASE_ACCESS":
        return f"CASE_ACCESS:{details['case_id']}"
    if category == "ROLE_CHANGE":
        return "ROLE_CHANGE"   # one role change in progress at a time, whatever the target role
    if category == "TEMPORARY_PERMISSION":
        return f"TEMPORARY_PERMISSION:{details['action']}:{details.get('case_id') or '*'}"
    normalised = " ".join(title.lower().split())
    return f"{category}:{hashlib.sha256(normalised.encode()).hexdigest()[:20]}"


def has_case_access(db: Session, user: User, case_id: str) -> bool:
    case = db.get(Case, case_id)
    if case is None:
        return False
    if user.role in OVERSIGHT_ROLES:
        return True
    assigned = case.owner_id == user.user_id or db.query(CaseAssignment).filter_by(case_id=case_id, user_id=user.user_id).first() is not None
    return assigned and case.jurisdiction == user.jurisdiction


def semantic_checks(db: Session, user: User, category: str, details: dict) -> None:
    """Checks that depend on who is asking. None of them reveals whether a case the user cannot open exists."""
    if category == "CASE_ACCESS":
        if user.role in OVERSIGHT_ROLES:
            _invalid([{"loc": ["body", "category"], "msg": "your role already sees every case", "type": "value_error"}])
        if has_case_access(db, user, details["case_id"]):
            raise RequestError(409, "You already have access to this case.", "ALREADY_GRANTED")
    elif category == "ROLE_CHANGE":
        if details["requested_role"] == user.role:
            _invalid([{"loc": ["body", "details", "requested_role"], "msg": "that is already your role", "type": "value_error"}])
    elif category == "DATA_CORRECTION":
        if not has_case_access(db, user, details["case_id"]):
            # Same answer for a case that does not exist and one the user may not open.
            _invalid([{"loc": ["body", "details", "case_id"], "msg": "you can only report corrections for cases you can open",
                       "type": "value_error"}])


# ------------------------------------------------------------------------------------------------ authorization
def may_view_all(user: User) -> bool:
    return user.role in OVERSIGHT_ROLES


def may_review(user: User) -> bool:
    return user.role == REVIEWER_ROLE and user.active


def get_visible(db: Session, user: User, request_id: int) -> UserRequest:
    row = db.get(UserRequest, request_id)
    if row is None or (row.requester_id != user.user_id and not may_view_all(user)):
        raise RequestError(404, "Request not found.", "NOT_FOUND")
    return row


# action: (statuses it may start from, resulting status)
TRANSITIONS: dict[str, tuple[frozenset[str], str]] = {
    "submit": (frozenset({"DRAFT"}), "PENDING"),
    "cancel": (frozenset({"DRAFT", "PENDING", "UNDER_REVIEW"}), "CANCELLED"),
    "claim": (frozenset({"PENDING"}), "UNDER_REVIEW"),
    "release": (frozenset({"UNDER_REVIEW"}), "PENDING"),
    "approve": (frozenset({"UNDER_REVIEW"}), "APPROVED"),
    "reject": (frozenset({"UNDER_REVIEW"}), "REJECTED"),
    "complete": (frozenset({"APPROVED"}), "COMPLETED"),
}
REQUESTER_ACTIONS = frozenset({"submit", "cancel", "edit"})
REVIEWER_ACTIONS = frozenset({"claim", "release", "approve", "reject", "complete"})


def denial(user: User, row: UserRequest, action: str) -> tuple[str, str] | None:
    """Why `user` may not perform `action` on `row` (code, message), or None. Status is checked separately."""
    own = row.requester_id == user.user_id
    if action in REQUESTER_ACTIONS:
        return None if own else ("NOT_REQUESTER", "Only the person who raised the request may do this.")
    if not may_review(user):
        return ("FORBIDDEN", "Only an administrator may review requests.")
    if own:
        return ("SELF_REVIEW", "You cannot review your own request; another administrator must.")
    if action in ("approve", "reject") and row.status == "UNDER_REVIEW" and row.reviewer_id != user.user_id:
        return ("NOT_CLAIMER", "Another administrator is reviewing this request. They must decide it, or release it first.")
    return None


def allowed_actions(user: User, row: UserRequest) -> list[str]:
    out = []
    for action in ("edit", *TRANSITIONS):
        start = frozenset({"DRAFT"}) if action == "edit" else TRANSITIONS[action][0]
        if row.status in start and denial(user, row, action) is None:
            out.append(action)
    return out


# ------------------------------------------------------------------------------------------------ helpers
def _names(db: Session, ids) -> dict[str, User]:
    ids = {i for i in ids if i}
    return {u.user_id: u for u in db.query(User).filter(User.user_id.in_(ids)).all()} if ids else {}


def _person(u: User | None, uid: str | None) -> dict | None:
    if not uid:
        return None
    if u is None:
        return {"user_id": uid, "org_user_id": None, "username": None, "display_name": None, "role": None}
    return {"user_id": u.user_id, "org_user_id": u.org_user_id, "username": u.username, "display_name": u.display_name,
            "role": u.role}


def request_out(db: Session, row: UserRequest, viewer: User, *, with_history: bool = False) -> dict:
    users = _names(db, [row.requester_id, row.reviewer_id, row.completed_by])
    cat = CATEGORIES.get(row.category)
    out = {
        "request_id": row.request_id, "reference": reference(row.request_id), "category": row.category,
        "category_label": cat.label if cat else row.category, "fulfilment": cat.fulfilment if cat else "MANUAL",
        "title": row.title, "justification": row.justification, "details": row.details or {}, "priority": row.priority,
        "status": row.status, "case_id": row.case_id,
        "requester": _person(users.get(row.requester_id), row.requester_id),
        "reviewer": _person(users.get(row.reviewer_id), row.reviewer_id),
        "decision_reason": row.decision_reason, "decided_at": iso(row.decided_at),
        "completed_by": _person(users.get(row.completed_by), row.completed_by), "completed_at": iso(row.completed_at),
        "completion_note": row.completion_note,
        "created_at": iso(row.created_at), "submitted_at": iso(row.submitted_at), "updated_at": iso(row.updated_at),
        "version": row.version, "allowed_actions": allowed_actions(viewer, row),
    }
    if with_history:
        events = db.query(UserRequestEvent).filter_by(request_id=row.request_id).order_by(UserRequestEvent.at, UserRequestEvent.event_id).all()
        actors = _names(db, [e.actor_id for e in events])
        out["history"] = [{"event": e.event, "from_status": e.from_status, "to_status": e.to_status,
                           "actor": _person(actors.get(e.actor_id), e.actor_id), "actor_role": e.actor_role,
                           "at": iso(e.at), "reason": e.reason, "detail": e.detail or {}} for e in events]
        if may_view_all(viewer):
            out["review_context"] = review_context(db, row, users.get(row.requester_id))
    return out


def review_context(db: Session, row: UserRequest, requester: User | None) -> dict:
    """What a reviewer needs to decide: whether the change can actually be applied. Reviewers only."""
    ctx: dict = {"requester_active": bool(requester and requester.active),
                 "requester_role": requester.role if requester else None,
                 "requester_jurisdiction": requester.jurisdiction if requester else None}
    case_id = (row.details or {}).get("case_id")
    if case_id:
        case = db.get(Case, case_id)
        ctx["case"] = None if case is None else {"case_id": case.case_id, "title": case.title, "jurisdiction": case.jurisdiction}
        if row.category == "CASE_ACCESS":
            ctx["can_apply"] = bool(case and requester and requester.active and case.jurisdiction == requester.jurisdiction)
    if row.category == "ROLE_CHANGE":
        ctx["can_apply"] = bool(requester and requester.active and row.details.get("requested_role") != "ADMIN")
    return ctx


def _event(db: Session, row: UserRequest, actor: User, event: str, from_status, to_status, reason=None, detail=None):
    db.add(UserRequestEvent(request_id=row.request_id, event=event, from_status=from_status, to_status=to_status,
                            actor_id=actor.user_id, actor_role=actor.role, at=utcnow(), reason=reason, detail=detail or {}))


def _notify(db: Session, user_ids, row: UserRequest, kind: str, title: str, body: str = "") -> None:
    for uid in sorted({u for u in user_ids if u}):
        db.add(Notification(user_id=uid, kind=kind, title=title[:200], body=body[:500], link=f"/requests/{row.request_id}",
                            request_id=row.request_id, created_at=utcnow()))


def _reviewers(db: Session, exclude: str | None) -> list[str]:
    return [u.user_id for u in db.query(User).filter(User.role == REVIEWER_ROLE, User.active.is_(True)).all() if u.user_id != exclude]


def _check_reason(reason: str | None, required: bool, what: str) -> str | None:
    reason = (reason or "").strip()
    if not reason:
        if required:
            _invalid([{"loc": ["body", "reason"], "msg": f"a reason is required to {what}", "type": "missing"}])
        return None
    if len(reason) < REASON_MIN or len(reason) > REASON_MAX:
        _invalid([{"loc": ["body", "reason"], "msg": f"reason must be {REASON_MIN}-{REASON_MAX} characters", "type": "value_error"}])
    return reason


def _deny(db: Session, trace_id: str, user: User, row: UserRequest, action: str, code: str, message: str):
    record_audit(db, trace_id, user.user_id, f"USER_REQUEST_{action.upper()}", "USER_REQUEST", reference(row.request_id),
                 outcome="DENIED", detail={"reason": code, "status": row.status})
    db.commit()
    raise RequestError(403, message, code)


# ------------------------------------------------------------------------------------------------ create / edit
def create(db: Session, user: User, trace_id: str, *, category: str, title: str, justification: str, priority: str,
           details: dict | None, submit: bool) -> UserRequest:
    details = clean_details(category, details)
    semantic_checks(db, user, category, details)
    key = dedupe_key(category, title, details)
    open_q = db.query(UserRequest).filter(UserRequest.requester_id == user.user_id,
                                          UserRequest.status.in_(USER_REQUEST_OPEN_STATUSES))
    existing = open_q.filter(UserRequest.dedupe_key == key).first()
    if existing is not None:
        raise RequestError(409, f"You already have an open request for this ({reference(existing.request_id)}, "
                                f"{existing.status.lower().replace('_', ' ')}).", "DUPLICATE_REQUEST")
    if open_q.count() >= MAX_OPEN_PER_USER:
        raise RequestError(409, f"You have {MAX_OPEN_PER_USER} open requests. Wait for one to be decided or cancel one first.",
                           "TOO_MANY_OPEN")
    now = utcnow()
    row = UserRequest(category=category, title=title.strip(), justification=justification.strip(), details=details,
                      priority=priority, status="PENDING" if submit else "DRAFT", dedupe_key=key, requester_id=user.user_id,
                      case_id=details.get("case_id"), created_at=now, updated_at=now, submitted_at=now if submit else None,
                      version=1)
    db.add(row)
    try:
        db.flush()
    except IntegrityError:
        # A concurrent create with the same duplicate key won the race (uix_user_requests_open_dedupe).
        db.rollback()
        raise RequestError(409, "You already have an open request for this.", "DUPLICATE_REQUEST")
    _event(db, row, user, "CREATED", None, "DRAFT", detail={"category": category})
    if submit:
        _event(db, row, user, "SUBMITTED", "DRAFT", "PENDING")
        _notify(db, _reviewers(db, user.user_id), row, "USER_REQUEST_SUBMITTED",
                f"New request {reference(row.request_id)}: {CATEGORIES[category].label}", f"Raised by {user.display_name}.")
    record_audit(db, trace_id, user.user_id, "USER_REQUEST_CREATE", "USER_REQUEST", reference(row.request_id), row.case_id,
                 detail={"category": category, "status": row.status, "priority": priority})
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise RequestError(409, "You already have an open request for this.", "DUPLICATE_REQUEST")
    return row


def edit(db: Session, user: User, trace_id: str, row: UserRequest, *, version: int, title=None, justification=None,
         priority=None, details=None) -> UserRequest:
    if (d := denial(user, row, "edit")) is not None:
        _deny(db, trace_id, user, row, "edit", *d)
    if version != row.version:
        raise RequestError(409, "This request was changed by someone else. Reload it and try again.", "VERSION_CONFLICT")
    if row.status != "DRAFT":
        raise RequestError(409, f"Only a draft can be edited; this request is {row.status.lower().replace('_', ' ')}.",
                           "INVALID_TRANSITION")
    new_title = title.strip() if title is not None else row.title
    new_details = clean_details(row.category, details) if details is not None else row.details
    semantic_checks(db, user, row.category, new_details)
    values = {"title": new_title, "justification": justification.strip() if justification is not None else row.justification,
              "priority": priority or row.priority, "details": new_details, "case_id": new_details.get("case_id"),
              "dedupe_key": dedupe_key(row.category, new_title, new_details)}
    clash = (db.query(UserRequest).filter(UserRequest.requester_id == user.user_id, UserRequest.request_id != row.request_id,
                                          UserRequest.dedupe_key == values["dedupe_key"],
                                          UserRequest.status.in_(USER_REQUEST_OPEN_STATUSES)).first())
    if clash is not None:
        raise RequestError(409, f"You already have an open request for this ({reference(clash.request_id)}).", "DUPLICATE_REQUEST")
    changed = sorted(k for k in ("title", "justification", "priority", "details") if values[k] != getattr(row, k))
    _conditional_update(db, row, version, {**values, "updated_at": utcnow(), "version": version + 1})
    _event(db, row, user, "EDITED", "DRAFT", "DRAFT", detail={"fields": changed})
    record_audit(db, trace_id, user.user_id, "USER_REQUEST_EDIT", "USER_REQUEST", reference(row.request_id), row.case_id,
                 detail={"fields": changed})
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise RequestError(409, "You already have an open request for this.", "DUPLICATE_REQUEST")
    db.refresh(row)
    return row


def _conditional_update(db: Session, row: UserRequest, version: int, values: dict) -> None:
    """The concurrency guard: change the row only if it is still at `version` and in the status we checked."""
    if version != row.version:
        raise RequestError(409, "This request was changed by someone else. Reload it and try again.", "VERSION_CONFLICT")
    try:
        result = db.execute(update(UserRequest)
                            .where(UserRequest.request_id == row.request_id, UserRequest.version == version,
                                   UserRequest.status == row.status)
                            .values(**values).execution_options(synchronize_session=False))
    except IntegrityError:
        # uix_user_requests_open_dedupe: the change would make this a duplicate of another open request.
        db.rollback()
        raise RequestError(409, "You already have an open request for this.", "DUPLICATE_REQUEST")
    if result.rowcount != 1:
        db.rollback()
        raise RequestError(409, "This request was changed by someone else. Reload it and try again.", "VERSION_CONFLICT")


# ------------------------------------------------------------------------------------------------ transitions
def transition(db: Session, user: User, trace_id: str, row: UserRequest, action: str, *, version: int,
               reason: str | None = None) -> UserRequest:
    allowed_from, to_status = TRANSITIONS[action]
    if (d := denial(user, row, action)) is not None:
        _deny(db, trace_id, user, row, action, *d)
    if version != row.version:   # acting on an out-of-date view: say so, rather than describing the new state
        raise RequestError(409, "This request was changed by someone else. Reload it and try again.", "VERSION_CONFLICT")
    if row.status not in allowed_from:
        raise RequestError(409, f"Cannot {action} a request that is {row.status.lower().replace('_', ' ')}.", "INVALID_TRANSITION")
    cat = CATEGORIES[row.category]
    needs_reason = action in ("approve", "reject", "release") or (action == "complete" and cat.fulfilment == "MANUAL")
    reason = _check_reason(reason, needs_reason, action if action != "complete" else "record how it was fulfilled")
    from_status, now = row.status, utcnow()
    values: dict = {"status": to_status, "updated_at": now, "version": version + 1}
    if action == "submit":
        values["submitted_at"] = now
    elif action == "claim":
        values["reviewer_id"] = user.user_id
    elif action == "release":
        values["reviewer_id"] = None
    elif action in ("approve", "reject"):
        values.update(decision_reason=reason, decided_at=now)
    elif action == "complete":
        values.update(completed_by=user.user_id, completed_at=now)
    previous_reviewer = row.reviewer_id
    _conditional_update(db, row, version, values)     # takes the row lock before any side effect below
    db.refresh(row)

    applied = None
    if action == "complete":
        try:
            applied = _fulfil(db, user, trace_id, row)
        except RequestError as exc:
            db.rollback()
            record_audit(db, trace_id, user.user_id, "USER_REQUEST_COMPLETE", "USER_REQUEST", reference(row.request_id),
                         row.case_id, outcome="ERROR", detail={"reason": str(exc.detail)[:200]})
            db.commit()
            raise
        note = reason or applied["note"]
        db.execute(update(UserRequest).where(UserRequest.request_id == row.request_id)
                   .values(completion_note=note).execution_options(synchronize_session=False))

    event = {"submit": "SUBMITTED", "cancel": "CANCELLED", "claim": "CLAIMED", "release": "RELEASED",
             "approve": "APPROVED", "reject": "REJECTED", "complete": "COMPLETED"}[action]
    _event(db, row, user, event, from_status, to_status, reason, detail=applied or {})
    record_audit(db, trace_id, user.user_id, f"USER_REQUEST_{action.upper()}", "USER_REQUEST", reference(row.request_id),
                 row.case_id, detail={"from": from_status, "to": to_status, "category": row.category,
                                      **({"reason": reason[:300]} if reason else {}), **({"applied": applied} if applied else {})})
    ref, label = reference(row.request_id), cat.label
    if action == "submit":
        _notify(db, _reviewers(db, row.requester_id), row, "USER_REQUEST_SUBMITTED", f"New request {ref}: {label}",
                f"Raised by {user.display_name}.")
    elif action == "cancel" and previous_reviewer:
        _notify(db, [previous_reviewer], row, "USER_REQUEST_CANCELLED", f"Request {ref} was withdrawn by the requester")
    elif action in ("claim", "release", "approve", "reject", "complete"):
        words = {"claim": "is now under review", "release": "is back in the queue", "approve": "was approved",
                 "reject": "was rejected", "complete": "was completed"}[action]
        body = {"approve": "Reason: ", "reject": "Reason: ", "complete": ""}.get(action, "")
        _notify(db, [row.requester_id], row, f"USER_REQUEST_{event}", f"Your request {ref} ({label}) {words}",
                (body + reason) if (body and reason) else (applied or {}).get("note", ""))
    db.commit()
    db.refresh(row)
    return row


def _fulfil(db: Session, actor: User, trace_id: str, row: UserRequest) -> dict | None:
    """Apply an approved request. Raises RequestError(409, FULFILMENT_FAILED) when it cannot be applied as asked."""
    cat = CATEGORIES[row.category]
    if cat.fulfilment == "MANUAL":
        return None
    target = db.get(User, row.requester_id)
    if target is None or not target.active:
        raise RequestError(409, "The requester's account is deactivated; the request cannot be applied.", "FULFILMENT_FAILED")
    if row.category == "CASE_ACCESS":
        case = db.get(Case, row.details["case_id"])
        if case is None:
            raise RequestError(409, "The case does not exist; reject the request instead.", "FULFILMENT_FAILED")
        if case.jurisdiction != target.jurisdiction:
            raise RequestError(409, f"The requester's jurisdiction ({target.jurisdiction}) does not match the case's "
                                    f"({case.jurisdiction}); reject the request instead.", "FULFILMENT_FAILED")
        purpose = row.details.get("purpose", "investigation")
        if db.query(CaseAssignment).filter_by(case_id=case.case_id, user_id=target.user_id).first() is not None:
            return {"note": f"Already assigned to {case.case_id}; nothing to change.", "case_id": case.case_id}
        from . import case_assignments  # same rules, history, audit and notification as an administrator's assignment
        try:
            case_assignments.assign(db, actor, case.case_id, target, purpose=purpose,
                                    reason=f"Approved request {reference(row.request_id)}", trace_id=trace_id,
                                    via=reference(row.request_id))
        except case_assignments.AssignmentError as exc:
            raise RequestError(409, f"The assignment cannot be applied: {exc.detail}; reject the request instead.",
                               "FULFILMENT_FAILED")
        return {"note": f"Assigned to {case.case_id} for {purpose}.", "case_id": case.case_id}
    if row.category == "ROLE_CHANGE":
        new_role = row.details["requested_role"]
        if new_role not in ROLES or new_role == "ADMIN":
            raise RequestError(409, "That role cannot be granted through a request.", "FULFILMENT_FAILED")
        before = target.role
        target.role = new_role
        target.token_version = (target.token_version or 0) + 1   # sign in again, so the new permissions load cleanly
        record_audit(db, trace_id, actor.user_id, "USER_UPDATE", "USER", target.user_id,
                     detail={"before": {"role": before}, "after": {"role": new_role}, "via_request": reference(row.request_id)})
        return {"note": f"Role changed from {before} to {new_role}; the user must sign in again.", "from_role": before,
                "to_role": new_role}
    return None


# ------------------------------------------------------------------------------------------------ listing
SORTS = {"created": UserRequest.created_at, "updated": UserRequest.updated_at, "priority": UserRequest.priority,
         "status": UserRequest.status, "reference": UserRequest.request_id}


def list_query(db: Session, user: User, *, scope: str, statuses: list[str], category: str | None, priority: str | None,
               q: str | None, requester: str | None, assigned_to_me: bool, created_from: datetime.datetime | None,
               created_to: datetime.datetime | None):
    query = db.query(UserRequest)
    if scope == "mine":
        query = query.filter(UserRequest.requester_id == user.user_id)
    if statuses:
        query = query.filter(UserRequest.status.in_(statuses))
    if category:
        query = query.filter(UserRequest.category == category)
    if priority:
        query = query.filter(UserRequest.priority == priority)
    if assigned_to_me:
        query = query.filter(UserRequest.reviewer_id == user.user_id)
    if created_from:
        query = query.filter(UserRequest.created_at >= created_from)
    if created_to:
        query = query.filter(UserRequest.created_at < created_to)
    if requester and scope == "all":
        pat = _like(requester)
        ids = [u.user_id for u in db.query(User).filter(or_(func.lower(User.username).like(pat, escape="\\"),
                                                            func.lower(User.display_name).like(pat, escape="\\"))).all()]
        query = query.filter(UserRequest.requester_id.in_(ids or ["-"]))
    if q and q.strip():
        m = _REFERENCE_RE.match(q)
        pat = _like(q)
        conds = [func.lower(UserRequest.title).like(pat, escape="\\"), func.lower(UserRequest.justification).like(pat, escape="\\"),
                 func.lower(func.coalesce(UserRequest.case_id, "")).like(pat, escape="\\")]
        if m:
            conds.append(UserRequest.request_id == int(m.group(1)))
        query = query.filter(or_(*conds))
    return query


def _like(q: str) -> str:
    esc = q.strip().lower().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{esc}%"
