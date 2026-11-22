"""Masking policy: which roles may request an audited reveal of each kind of masked value.

Authorization model (docs/MASKING_AUTHORIZATION.md):

* Masking is unconditional on every default output path, for every role, including ADMIN and AUDITOR.
* A reveal is a separate, explicit request carrying a reason. It is allowed only when ALL of these hold
  (deny wins on any conflict):
    1. a policy row exists for the kind (missing row -> nobody may reveal: fail closed);
    2. the caller's role is in that row's reveal_roles;
    3. the caller is assigned to, or owns, the case (no ADMIN/AUDITOR bypass for reveals);
    4. the value actually belongs to that case (checked by the calling route).
  Every reveal, allowed or denied, writes an UNMASK audit event.
* Configuring the policy (MASKING_POLICY_UPDATE) is ADMIN-only. Viewing it is ADMIN or AUDITOR.
* Separation of duties: ADMIN can never be placed in any reveal_roles list, so whoever configures the policy cannot
  use it to read raw values.
"""
from __future__ import annotations

import logging

from fastapi import HTTPException, Request
from sqlalchemy.orm import Session

from ..models import ROLES, Case, CaseAssignment, MaskingPolicy, User, utcnow
from .audit import record_audit

logger = logging.getLogger("drishti.masking_policy")

KINDS: dict[str, str] = {
    "PHONE": "Phone-number entity labels and phone attributes",
    "ACCOUNT": "Bank-account entity labels and account attributes",
    "PII_ATTRIBUTE": "Personal attributes of entities: address and date of birth",
    "EVIDENCE_CONTEXT": "Unmasked source lines of an evidence file around a locator",
    "RAW_FILE": "The original uploaded file bytes (raw download)",
}
DEFAULT_REVEAL_ROLES: tuple[str, ...] = ("INVESTIGATOR", "REVIEWER")
FORBIDDEN_REVEAL_ROLES = frozenset({"ADMIN"})  # policy administrators may never hold reveal permission
DENIED_MESSAGE = "You are not permitted to reveal this value"  # deliberately generic: no kind, value or role detail


def ensure_default_policies(db: Session) -> int:
    """Insert the default row for any kind that has none. Never overwrites an administrator's change."""
    added = 0
    for kind in KINDS:
        if db.get(MaskingPolicy, kind) is None:
            db.add(MaskingPolicy(kind=kind, reveal_roles=list(DEFAULT_REVEAL_ROLES), updated_at=utcnow().replace(tzinfo=None),
                                 updated_by=None, reason="default policy"))
            added += 1
    return added


def reveal_roles(db: Session, kind: str) -> frozenset[str]:
    row = db.get(MaskingPolicy, kind)
    if row is None:
        logger.warning("masking policy row missing for kind %s: reveals of this kind are denied", kind)
        return frozenset()
    roles = row.reveal_roles if isinstance(row.reveal_roles, list) else []
    # Defence in depth: even if a forbidden role were written into the table directly, it never takes effect.
    return frozenset(r for r in roles if r in ROLES and r not in FORBIDDEN_REVEAL_ROLES)


def validate_reveal_roles(roles: list[str]) -> list[str]:
    cleaned = sorted(set(roles))
    unknown = [r for r in cleaned if r not in ROLES]
    if unknown:
        raise ValueError("unknown role in reveal_roles")
    if FORBIDDEN_REVEAL_ROLES & set(cleaned):
        raise ValueError("ADMIN may not hold reveal permission (separation of duties)")
    return cleaned


def _case_member(db: Session, user: User, case_id: str) -> bool:
    case = db.get(Case, case_id)
    if case is None:
        return False
    if case.owner_id == user.user_id:
        return True
    return db.query(CaseAssignment).filter_by(case_id=case_id, user_id=user.user_id).first() is not None


def authorize_reveal(db: Session, user: User, kind: str, case_id: str | None, request: Request,
                     target_kind: str, target_id: str, reason: str | None) -> None:
    """Raise 403 (audited) unless the policy and the case assignment both allow this reveal."""
    from . import overrides  # local import: overrides imports this module for effective_capabilities

    trace = getattr(request.state, "trace_id", None)
    why = None
    action = "downloadOriginal" if kind == "RAW_FILE" else "reveal"
    entity_or_evidence = target_id.split(":", 1)[0]
    resource = ("EVIDENCE", entity_or_evidence) if target_kind == "EVIDENCE" else ("ENTITY", entity_or_evidence)
    used = []
    if kind not in KINDS:
        why = "unknown masked kind"
    else:
        # Role: the masking policy is the baseline; a permission override may deny it, or allow it for a non-ADMIN.
        role_decision = overrides.evaluate(db, user, action, baseline=user.role in reveal_roles(db, kind),
                                           case_id=case_id, resource=resource)
        if not role_decision.allowed:
            why = ("denied by permission override" if role_decision.source == "override_deny"
                   else "role not permitted by masking policy")
        elif case_id is None:
            why = "not assigned to the case"
        else:
            # Case membership: assignment or ownership (no ADMIN/AUDITOR bypass), adjusted by caseAccess overrides.
            member_decision = overrides.evaluate(db, user, "caseAccess", baseline=_case_member(db, user, case_id),
                                                 case_id=case_id, resource=("CASE", case_id))
            if not member_decision.allowed:
                why = "denied by permission override" if member_decision.source == "override_deny" else "not assigned to the case"
            used = [(d, a) for d, a in ((role_decision, action), (member_decision, "caseAccess")) if d.source == "override_allow"]
    if why is None:
        for decision, act in used:
            overrides.record_use(db, user, decision, act, case_id)
    if why is not None:
        record_audit(db, trace, user.user_id, "UNMASK", target_kind, target_id, case_id if case_id and db.get(Case, case_id) else None,
                     outcome="DENIED", detail={"reason": why, "masked_kind": kind, "stated_reason": reason})
        db.commit()
        raise HTTPException(403, DENIED_MESSAGE)


def policy_out(row: MaskingPolicy) -> dict:
    return {"kind": row.kind, "description": KINDS.get(row.kind, ""), "reveal_roles": sorted(row.reveal_roles or []),
            "updated_at": row.updated_at.isoformat() if row.updated_at else None, "updated_by": row.updated_by,
            "reason": row.reason}


def update_policy(db: Session, actor: User, kind: str, roles: list[str], reason: str, trace: str | None) -> MaskingPolicy:
    """ADMIN-only change, audited with before and after in the same transaction (fail-closed: the caller commits)."""
    if kind not in KINDS:
        raise LookupError(kind)
    cleaned = validate_reveal_roles(roles)
    row = db.get(MaskingPolicy, kind)
    before = sorted(row.reveal_roles or []) if row else None
    if row is None:
        row = MaskingPolicy(kind=kind)
        db.add(row)
    row.reveal_roles = cleaned
    row.updated_at = utcnow().replace(tzinfo=None)
    row.updated_by = actor.user_id
    row.reason = reason
    record_audit(db, trace, actor.user_id, "MASKING_POLICY_UPDATE", "MASKING_POLICY", kind,
                 detail={"before": before, "after": cleaned, "reason": reason, "created": before is None})
    return row
