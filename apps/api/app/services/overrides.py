"""Administrator-controlled permission overrides: scoped, time-boxed ALLOW / DENY exceptions to role-based access.

Model (docs/AUTHORIZATION_OVERRIDES.md):

* Every protected check names an ACTION. The baseline decision comes from roles (auth.require_roles), case assignment
  (auth.authorize_case, action "caseAccess") or the masking policy (masking_policy.authorize_reveal, actions "reveal"
  and "downloadOriginal"). `evaluate()` combines the baseline with overrides.
* Deterministic precedence, highest first:
    1. mandatory restrictions -- not overridable at all (NON_OVERRIDABLE actions; authentication and active-account
       checks; jurisdiction; evidence integrity and quarantine; ADMIN can never gain reveal/downloadOriginal);
    2. a matching active DENY override -> deny;
    3. baseline allow -> allow;
    4. a matching active ALLOW override -> allow;
    5. otherwise deny.
  Deny wins regardless of how specific either override is; ties do not depend on ordering.
* An override matches when it is ACTIVE, starts_at <= now < expires_at, the action is equal, the subject is the user
  (USER) or the user's role (ROLE), and each scope it sets (case, resource) equals the request's. An unset scope
  matches everything; a set scope never matches an unknown request scope (fail-safe).
* Governance: only ADMIN creates, approves, rejects and revokes. ALLOW starts PENDING and needs approval by a
  different ADMIN; DENY is active at once. Nobody may create, approve or revoke an override whose subject is
  themselves or their own role. Expiry is mandatory and capped at MAX_DURATION_DAYS.
"""
from __future__ import annotations

import datetime
from dataclasses import dataclass

from sqlalchemy.orm import Session

from ..core import request_context
from ..models import (ROLES, Case, Claim, Entity, Evidence, MatchCandidate, PermissionOverride, PermissionOverrideEvent,
                      User, utcnow)
from .audit import record_audit

# action -> baseline roles (None = decided elsewhere: case assignment or masking policy). Mirrors the frontend's
# capability table (apps/web/src/lib/permissions.ts) for the capabilities it shows.
ACTIONS: dict[str, tuple[str, ...] | None] = {
    "upload": ("EVIDENCE_OFFICER", "INVESTIGATOR", "ADMIN"),
    "decide": ("REVIEWER", "INVESTIGATOR", "ADMIN"),
    "createAnchor": ("INVESTIGATOR", "REVIEWER", "ANALYST", "ADMIN"),
    "listAnchors": ("INVESTIGATOR", "REVIEWER", "ANALYST", "ADMIN", "AUDITOR"),
    "report": ("INVESTIGATOR", "REVIEWER", "ANALYST", "ADMIN"),
    "createCase": ("INVESTIGATOR", "ADMIN"),
    "viewUsers": ("ADMIN", "AUDITOR", "INVESTIGATOR"),
    "caseAccess": None,          # auth.authorize_case: assignment / ownership (ADMIN, AUDITOR see all)
    "reveal": None,              # masking policy (PHONE, ACCOUNT, PII_ATTRIBUTE, EVIDENCE_CONTEXT)
    "downloadOriginal": None,    # masking policy (RAW_FILE)
    # Not overridable (below), listed so require_roles can name them.
    "globalAudit": ("AUDITOR", "ADMIN"),
    "manageUsers": ("ADMIN",),
    "viewMaskingPolicy": ("ADMIN", "AUDITOR"),
    "manageMaskingPolicy": ("ADMIN",),
    "viewOverrides": ("ADMIN", "AUDITOR"),
    "manageOverrides": ("ADMIN",),
    "demoTamper": ("ADMIN",),
    "manageUploadPolicy": ("ADMIN",),
    "viewUploadMetrics": ("ADMIN", "AUDITOR"),
    "viewDiagnostics": ("ADMIN", "AUDITOR"),
    # User requests (services/user_requests.py). Raising a request is open to every role and can be withdrawn from a
    # user by a DENY override; seeing everyone's requests and deciding them are oversight/administration: mandatory.
    "createUserRequest": ("INVESTIGATOR", "EVIDENCE_OFFICER", "REVIEWER", "ANALYST", "AUDITOR", "ADMIN"),
    "viewAllUserRequests": ("ADMIN", "AUDITOR"),
    "reviewUserRequests": ("ADMIN",),
    # Organisational user ID history and lookup (services/org_user_ids.py): oversight, mandatory. Allocation itself is
    # manageUsers.
    "viewUserIdHistory": ("ADMIN", "AUDITOR"),
}
# Mandatory: oversight, account and policy administration, and the override system itself can neither be granted nor
# withdrawn by an override (no self-reinforcing escalation, no locking administrators or auditors out).
NON_OVERRIDABLE = frozenset({"globalAudit", "manageUsers", "viewMaskingPolicy", "manageMaskingPolicy", "viewOverrides",
                             "manageOverrides", "demoTamper", "manageUploadPolicy", "viewUploadMetrics", "viewDiagnostics",
                             "viewAllUserRequests", "reviewUserRequests", "viewUserIdHistory"})
OVERRIDABLE = frozenset(a for a in ACTIONS if a not in NON_OVERRIDABLE)
# Separation of duties (masking policy): ADMIN may never gain these through an ALLOW override.
SEPARATION_ACTIONS = frozenset({"reveal", "downloadOriginal"})
RESOURCE_TYPES = {"EVIDENCE": Evidence, "CANDIDATE": MatchCandidate, "CLAIM": Claim, "ENTITY": Entity}
MAX_DURATION_DAYS = 90
FRONTEND_CAPABILITIES = ("upload", "downloadOriginal", "reveal", "decide", "createAnchor", "listAnchors", "report",
                         "globalAudit", "createCase", "manageUsers", "viewOverrides", "manageOverrides",
                         "createUserRequest", "viewAllUserRequests", "reviewUserRequests")


@dataclass(frozen=True)
class Decision:
    allowed: bool
    source: str                      # "role" | "override_allow" | "override_deny" | "mandatory"
    override_id: str | None = None


class OverrideError(ValueError):
    """A request to create or change an override that the rules forbid. The message is safe to show the caller."""


def _now() -> datetime.datetime:
    return utcnow().replace(tzinfo=None)


# ------------------------------------------------------------------ evaluation
def _active_for(db: Session, user: User) -> list[PermissionOverride]:
    """Active overrides naming this user or their role, loaded once per request."""
    ctx = request_context.current()
    key = ("overrides", user.user_id, user.role)
    if ctx is not None and key in ctx.cache:
        return ctx.cache[key]
    now = _now()
    rows = (db.query(PermissionOverride)
            .filter(PermissionOverride.status == "ACTIVE", PermissionOverride.starts_at <= now,
                    PermissionOverride.expires_at > now)
            .filter(((PermissionOverride.subject_type == "USER") & (PermissionOverride.subject == user.user_id)) |
                    ((PermissionOverride.subject_type == "ROLE") & (PermissionOverride.subject == user.role)))
            .order_by(PermissionOverride.override_id).all())
    if ctx is not None:
        ctx.cache[key] = rows
    return rows


def scope_from_path(db: Session, path_params: dict) -> tuple[str | None, tuple[str, str] | None]:
    """(case_id, (resource_type, resource_id)) for a request, from its path parameters. The case of a resource is
    read from the database, never from the request."""
    case_id = path_params.get("case_id")
    resource = None
    for param, rtype in (("evidence_id", "EVIDENCE"), ("candidate_id", "CANDIDATE"), ("claim_id", "CLAIM"), ("entity_id", "ENTITY")):
        rid = path_params.get(param)
        if rid:
            resource = (rtype, rid)
            if case_id is None and rtype != "ENTITY":
                row = db.get(RESOURCE_TYPES[rtype], rid)
                case_id = getattr(row, "case_id", None) if row is not None else None
            break
    return case_id, resource


def evaluate(db: Session, user: User, action: str, *, baseline: bool, case_id: str | None = None,
             resource: tuple[str, str] | None = None) -> Decision:
    if action in NON_OVERRIDABLE or action not in ACTIONS:
        return Decision(baseline, "role" if baseline else "mandatory")
    matches = [o for o in _active_for(db, user)
               if o.action == action
               and (o.case_id is None or o.case_id == case_id)
               and (o.resource_type is None or (resource is not None and (o.resource_type, o.resource_id) == resource))]
    denies = [o for o in matches if o.effect == "DENY"]
    if denies:
        return Decision(False, "override_deny", denies[0].override_id)
    if baseline:
        return Decision(True, "role")
    allows = [o for o in matches if o.effect == "ALLOW"]
    if action in SEPARATION_ACTIONS and user.role == "ADMIN":
        allows = []  # mandatory: configuring masking never comes with reading raw values
    if allows:
        return Decision(True, "override_allow", allows[0].override_id)
    return Decision(False, "role")


def record_use(db: Session, user: User, decision: Decision, action: str, case_id: str | None) -> None:
    """Audit every access that an ALLOW override granted, or that a DENY override refused."""
    if decision.source not in ("override_allow", "override_deny"):
        return
    record_audit(db, None, user.user_id, "OVERRIDE_APPLIED", "PERMISSION_OVERRIDE", decision.override_id, case_id,
                 outcome="OK" if decision.allowed else "DENIED",
                 detail={"action": action, "effect": "ALLOW" if decision.allowed else "DENY",
                         **({} if decision.allowed else {"reason": "denied by permission override"})})


# ------------------------------------------------------------------ administration
def _snapshot(o: PermissionOverride) -> dict:
    return {k: (v.isoformat() if isinstance(v, datetime.datetime) else v) for k, v in {
        "override_id": o.override_id, "effect": o.effect, "action": o.action, "subject_type": o.subject_type,
        "subject": o.subject, "case_id": o.case_id, "resource_type": o.resource_type, "resource_id": o.resource_id,
        "reason": o.reason, "starts_at": o.starts_at, "expires_at": o.expires_at, "status": o.status,
        "created_by": o.created_by, "approved_by": o.approved_by, "revoked_by": o.revoked_by}.items()}


def _event(db: Session, o: PermissionOverride, event: str, actor: User, reason: str | None, trace: str | None) -> None:
    db.add(PermissionOverrideEvent(override_id=o.override_id, event=event, actor_id=actor.user_id, at=_now(),
                                   reason=reason, snapshot=_snapshot(o)))
    record_audit(db, trace, actor.user_id, f"OVERRIDE_{event}", "PERMISSION_OVERRIDE", o.override_id, o.case_id,
                 detail={"effect": o.effect, "action": o.action, "subject_type": o.subject_type, "subject": o.subject,
                         "case_id": o.case_id, "resource": [o.resource_type, o.resource_id] if o.resource_type else None,
                         "reason": reason, "starts_at": o.starts_at.isoformat(), "expires_at": o.expires_at.isoformat(),
                         "created_by": o.created_by, "approved_by": o.approved_by, "revoked_by": o.revoked_by})


def _affects_actor(o_subject_type: str, o_subject: str, actor: User) -> bool:
    return (o_subject_type == "USER" and o_subject == actor.user_id) or (o_subject_type == "ROLE" and o_subject == actor.role)


def effective_status(o: PermissionOverride, now: datetime.datetime | None = None) -> str:
    now = now or _now()
    if o.status != "ACTIVE":
        return o.status
    if now < o.starts_at:
        return "SCHEDULED"
    if now >= o.expires_at:
        return "EXPIRED"
    return "ACTIVE"


def create(db: Session, actor: User, *, effect: str, action: str, subject_type: str, subject: str, reason: str,
           expires_at: datetime.datetime, starts_at: datetime.datetime | None = None, case_id: str | None = None,
           resource_type: str | None = None, resource_id: str | None = None, trace: str | None = None) -> PermissionOverride:
    if actor.role != "ADMIN":
        raise PermissionError("only administrators may create overrides")
    if effect not in ("ALLOW", "DENY"):
        raise OverrideError("effect must be ALLOW or DENY")
    if action in NON_OVERRIDABLE:
        raise OverrideError(f"'{action}' is a mandatory restriction and cannot be overridden")
    if action not in OVERRIDABLE:
        raise OverrideError("unknown action")
    if subject_type == "USER":
        target = db.get(User, subject)
        if target is None:
            raise OverrideError("unknown user")
        target_role = target.role
    elif subject_type == "ROLE":
        if subject not in ROLES:
            raise OverrideError("unknown role")
        target_role = subject
    else:
        raise OverrideError("subject_type must be USER or ROLE")
    if _affects_actor(subject_type, subject, actor):
        raise OverrideError("you cannot create an override that applies to yourself or your own role")
    if effect == "ALLOW" and target_role == "ADMIN":
        raise OverrideError("ALLOW overrides cannot target administrators (they already pass role checks, and must "
                            "never gain reveal or raw download)")
    if case_id is not None and db.get(Case, case_id) is None:
        raise OverrideError("unknown case")
    if (resource_type is None) != (resource_id is None):
        raise OverrideError("resource_type and resource_id go together")
    if resource_type is not None:
        model = RESOURCE_TYPES.get(resource_type)
        if model is None:
            raise OverrideError("unknown resource type")
        row = db.get(model, resource_id)
        if row is None:
            raise OverrideError("unknown resource")
        row_case = getattr(row, "case_id", None)
        if case_id is not None and row_case is not None and row_case != case_id:
            raise OverrideError("the resource does not belong to that case")
    now = _now()
    start = (starts_at.replace(tzinfo=None) if starts_at.tzinfo is None else
             starts_at.astimezone(datetime.timezone.utc).replace(tzinfo=None)) if starts_at else now
    end = expires_at if expires_at.tzinfo is None else expires_at.astimezone(datetime.timezone.utc).replace(tzinfo=None)
    if start < now - datetime.timedelta(minutes=5):
        raise OverrideError("starts_at cannot be in the past")
    if end <= start:
        raise OverrideError("expires_at must be after starts_at")
    if end - start > datetime.timedelta(days=MAX_DURATION_DAYS):
        raise OverrideError(f"an override may last at most {MAX_DURATION_DAYS} days")
    o = PermissionOverride(effect=effect, action=action, subject_type=subject_type, subject=subject, case_id=case_id,
                           resource_type=resource_type, resource_id=resource_id, reason=reason, starts_at=start,
                           expires_at=end, status="PENDING" if effect == "ALLOW" else "ACTIVE",
                           created_by=actor.user_id, created_at=now)
    db.add(o)
    db.flush()
    _event(db, o, "CREATED", actor, reason, trace)
    return o


def _get(db: Session, override_id: str) -> PermissionOverride:
    o = db.get(PermissionOverride, override_id)
    if o is None:
        raise LookupError(override_id)
    return o


def approve(db: Session, actor: User, override_id: str, note: str | None, trace: str | None) -> PermissionOverride:
    o = _get(db, override_id)
    if actor.role != "ADMIN":
        raise PermissionError("only administrators may approve overrides")
    if o.status != "PENDING":
        raise OverrideError(f"only a PENDING override can be approved (this one is {o.status})")
    if o.created_by == actor.user_id:
        raise OverrideError("the creator of an override cannot approve it")
    if _affects_actor(o.subject_type, o.subject, actor):
        raise OverrideError("you cannot approve an override that applies to yourself or your own role")
    if o.expires_at <= _now():
        raise OverrideError("this override has already expired")
    o.status, o.approved_by, o.approved_at, o.decided_reason = "ACTIVE", actor.user_id, _now(), note
    _event(db, o, "APPROVED", actor, note, trace)
    return o


def reject(db: Session, actor: User, override_id: str, note: str, trace: str | None) -> PermissionOverride:
    o = _get(db, override_id)
    if actor.role != "ADMIN":
        raise PermissionError("only administrators may reject overrides")
    if o.status != "PENDING":
        raise OverrideError(f"only a PENDING override can be rejected (this one is {o.status})")
    o.status, o.approved_by, o.approved_at, o.decided_reason = "REJECTED", actor.user_id, _now(), note
    _event(db, o, "REJECTED", actor, note, trace)
    return o


def revoke(db: Session, actor: User, override_id: str, reason: str, trace: str | None) -> PermissionOverride:
    o = _get(db, override_id)
    if actor.role != "ADMIN":
        raise PermissionError("only administrators may revoke overrides")
    if o.status not in ("PENDING", "ACTIVE"):
        raise OverrideError(f"this override is already {o.status}")
    if _affects_actor(o.subject_type, o.subject, actor):
        # Otherwise an administrator restricted by a DENY could lift it themselves.
        raise OverrideError("you cannot revoke an override that applies to yourself or your own role")
    o.status, o.revoked_by, o.revoked_at, o.revoke_reason = "REVOKED", actor.user_id, _now(), reason
    _event(db, o, "REVOKED", actor, reason, trace)
    return o


def override_out(o: PermissionOverride, db: Session) -> dict:
    users = {u.user_id: u.username for u in db.query(User).filter(User.user_id.in_(
        [x for x in (o.created_by, o.approved_by, o.revoked_by, o.subject if o.subject_type == "USER" else None) if x])).all()}
    iso = lambda d: d.isoformat() + "Z" if d else None  # noqa: E731
    return {"override_id": o.override_id, "effect": o.effect, "action": o.action, "subject_type": o.subject_type,
            "subject": o.subject, "subject_username": users.get(o.subject) if o.subject_type == "USER" else None,
            "case_id": o.case_id, "resource_type": o.resource_type, "resource_id": o.resource_id, "reason": o.reason,
            "starts_at": iso(o.starts_at), "expires_at": iso(o.expires_at), "status": o.status,
            "effective_status": effective_status(o), "created_by": o.created_by, "created_by_username": users.get(o.created_by),
            "created_at": iso(o.created_at), "approved_by": o.approved_by, "approved_by_username": users.get(o.approved_by),
            "approved_at": iso(o.approved_at), "decided_reason": o.decided_reason, "revoked_by": o.revoked_by,
            "revoked_by_username": users.get(o.revoked_by), "revoked_at": iso(o.revoked_at), "revoke_reason": o.revoke_reason}


def effective_capabilities(db: Session, user: User, case_id: str | None) -> dict:
    """What the server would decide for this user, for each capability the frontend presents. For reveal and
    downloadOriginal the baseline is the masking policy (any kind for reveal)."""
    from . import masking_policy

    def baseline(cap: str) -> bool:
        if cap == "reveal":
            return any(user.role in masking_policy.reveal_roles(db, k) for k in ("PHONE", "ACCOUNT", "PII_ATTRIBUTE", "EVIDENCE_CONTEXT"))
        if cap == "downloadOriginal":
            return user.role in masking_policy.reveal_roles(db, "RAW_FILE")
        roles = ACTIONS.get(cap) or ()
        return user.role in roles or (user.role == "ADMIN" and cap not in SEPARATION_ACTIONS)

    out = {}
    for cap in FRONTEND_CAPABILITIES:
        d = evaluate(db, user, cap, baseline=baseline(cap), case_id=case_id)
        out[cap] = {"allowed": d.allowed, "source": d.source}
    return out
