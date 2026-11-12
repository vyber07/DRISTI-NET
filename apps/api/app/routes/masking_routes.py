"""Masking-policy administration.

GET  /masking-policies          ADMIN, AUDITOR   view who may reveal each kind (audited: MASKING_POLICY_VIEW)
PUT  /masking-policies/{kind}   ADMIN only       change reveal_roles, with a reason (audited: MASKING_POLICY_UPDATE)

Configuring a policy never grants the configurer access to raw values: ADMIN cannot be placed in reveal_roles.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..auth import require_roles
from ..db import get_db
from ..models import MaskingPolicy, User
from ..services import masking_policy
from ..services.audit import record_audit

router = APIRouter(tags=["masking"])


class MaskingPolicyIn(BaseModel):
    reveal_roles: list[str] = Field(max_length=10)
    reason: str = Field(min_length=10, max_length=500)


def _require_admin_exactly(user: User) -> None:
    # require_roles lets ADMIN through every gate; here ADMIN is the only role allowed at all, so this is explicit.
    if user.role != "ADMIN":
        raise HTTPException(403, "Only administrators may change masking policy")


@router.get("/masking-policies")
def list_policies(request: Request, user: User = Depends(require_roles("ADMIN", "AUDITOR", action="viewMaskingPolicy")), db: Session = Depends(get_db, scope="function")):
    rows = db.query(MaskingPolicy).order_by(MaskingPolicy.kind).all()
    record_audit(db, request.state.trace_id, user.user_id, "MASKING_POLICY_VIEW", "MASKING_POLICY", None,
                 detail={"kinds": [r.kind for r in rows]})
    db.commit()
    known = {r.kind for r in rows}
    missing = [k for k in masking_policy.KINDS if k not in known]
    return {"policies": [masking_policy.policy_out(r) for r in rows],
            "missing_kinds": missing,  # a missing kind is fail-closed: nobody may reveal it
            "forbidden_reveal_roles": sorted(masking_policy.FORBIDDEN_REVEAL_ROLES)}


@router.put("/masking-policies/{kind}")
def update_policy(kind: str, body: MaskingPolicyIn, request: Request, user: User = Depends(require_roles("ADMIN", action="manageMaskingPolicy")),
                  db: Session = Depends(get_db, scope="function")):
    _require_admin_exactly(user)
    try:
        row = masking_policy.update_policy(db, user, kind, body.reveal_roles, body.reason, request.state.trace_id)
    except LookupError:
        record_audit(db, request.state.trace_id, user.user_id, "MASKING_POLICY_UPDATE", "MASKING_POLICY", kind[:40],
                     outcome="DENIED", detail={"reason": "unknown masked kind"})
        db.commit()
        raise HTTPException(404, "unknown masked kind")
    except ValueError as exc:
        db.rollback()
        record_audit(db, request.state.trace_id, user.user_id, "MASKING_POLICY_UPDATE", "MASKING_POLICY", kind,
                     outcome="DENIED", detail={"reason": str(exc), "requested_roles": sorted(set(body.reveal_roles))[:10]})
        db.commit()
        raise HTTPException(422, str(exc))
    db.commit()
    return masking_policy.policy_out(row)
