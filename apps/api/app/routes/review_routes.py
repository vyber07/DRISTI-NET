from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..auth import authorize_case, current_user, require_roles
from ..db import get_db
from ..models import Claim, Entity, MatchCandidate, Review, User
from ..schemas import DecisionIn
from ..services import pipeline
from ..services.audit import record_audit
from ..services.masking import mask_label, mask_text
from ..services.resolution import _profile

router = APIRouter(tags=["review"])


def entity_summary(db: Session, ent: Entity, case_id: str) -> dict:
    prof = _profile(db, case_id, ent)
    case_attrs = (ent.attributes or {}).get(case_id, {}) if isinstance(ent.attributes, dict) and case_id in (ent.attributes or {}) else (ent.attributes or {})
    return {"entity_id": ent.entity_id, "kind": ent.kind, "label": mask_label(ent.kind, ent.label),
            "attributes": {k: v for k, v in case_attrs.items() if k in ("dob", "address", "person_id", "source_document", "mention_of")},
            "names": sorted(prof["names"]), "aliases": sorted(prof["aliases"]),
            "phones": [mask_label("PHONE", p) for p in sorted(prof["phones"])], "accounts": [mask_label("ACCOUNT", a) for a in sorted(prof["accounts"])],
            "orgs": sorted(prof["orgs"]), "dob": sorted(prof["dob"]), "address": sorted(prof["address"]), "evidence_ids": sorted(prof["evidence"])}


def candidate_out(db: Session, m: MatchCandidate, detailed: bool = True) -> dict:
    left, right = db.get(Entity, m.left_entity_id), db.get(Entity, m.right_entity_id)
    reviews = db.query(Review).filter_by(target_kind="MATCH", target_id=m.candidate_id).order_by(Review.created_at).all()
    d = {"candidate_id": m.candidate_id, "case_id": m.case_id, "state": m.state, "confidence": m.confidence, "matcher_version": m.matcher_version,
         "block_key": m.block_key, "positive_signals": m.positive_signals, "counter_evidence": m.counter_evidence, "conflicts": m.conflicts,
         "missing": m.missing, "evidence_ids": m.evidence_ids, "created_at": m.created_at.isoformat(),
         "left": {"entity_id": left.entity_id, "label": left.label, "kind": left.kind}, "right": {"entity_id": right.entity_id, "label": right.label, "kind": right.kind},
         "reviews": [{"review_id": r.review_id, "decision": r.decision, "reason": r.reason, "reviewer_id": r.reviewer_id, "created_at": r.created_at.isoformat(), "supersedes_id": r.supersedes_id} for r in reviews]}
    if detailed:
        d["left"] = entity_summary(db, left, m.case_id)
        d["right"] = entity_summary(db, right, m.case_id)
    return d


@router.get("/cases/{case_id}/candidates")
def list_candidates(case_id: str, request: Request, state: str | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)):
    authorize_case(db, user, case_id, request, action="REVIEW_QUEUE")
    q = db.query(MatchCandidate).filter_by(case_id=case_id)
    if state:
        q = q.filter(MatchCandidate.state == state)
    return [candidate_out(db, m, detailed=False) for m in q.order_by(MatchCandidate.confidence.desc()).all()]


@router.get("/candidates/{candidate_id}")
def get_candidate(candidate_id: str, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = db.get(MatchCandidate, candidate_id)
    if m is None:
        raise HTTPException(404, "unknown candidate")
    authorize_case(db, user, m.case_id, request, action="REVIEW_VIEW")
    return candidate_out(db, m)


@router.post("/candidates/{candidate_id}/decision")
def decide(candidate_id: str, body: DecisionIn, request: Request, user: User = Depends(require_roles("REVIEWER", "INVESTIGATOR", "ADMIN")), db: Session = Depends(get_db)):
    """Human decision on an identity-match candidate. APPROVE is the only path to a merged node in the projection."""
    m = db.get(MatchCandidate, candidate_id)
    if m is None:
        raise HTTPException(404, "unknown candidate")
    authorize_case(db, user, m.case_id, request, action="REVIEW_DECISION")
    if body.decision == "CONTRADICTORY":
        raise HTTPException(422, "CONTRADICTORY applies to attribute claims, not identity candidates")
    last = db.query(Review).filter_by(target_kind="MATCH", target_id=candidate_id).order_by(Review.created_at.desc()).first()
    if body.decision == "REVERSE":
        if last is None or last.decision in ("REVERSE",):
            raise HTTPException(409, "nothing to reverse")
        m.state = "REVIEW_REQUIRED"
    else:
        m.state = body.decision
    rev = Review(case_id=m.case_id, target_kind="MATCH", target_id=candidate_id, decision=body.decision, reason=body.reason,
                 reviewer_id=user.user_id, supersedes_id=last.review_id if last else None)
    db.add(rev)
    record_audit(db, request.state.trace_id, user.user_id, "REVIEW_DECISION", "MATCH", candidate_id, m.case_id,
                 detail={"decision": body.decision, "reason": body.reason, "new_state": m.state, "supersedes": rev.supersedes_id})
    pipeline.mark_active(db, m.case_id)
    db.commit()
    return candidate_out(db, m)


@router.post("/claims/{claim_id}/decision")
def decide_claim(claim_id: str, body: DecisionIn, request: Request, user: User = Depends(require_roles("REVIEWER", "INVESTIGATOR", "ADMIN")), db: Session = Depends(get_db)):
    """Decisions on individual claims (e.g. resolving or flagging a contradiction, marking a claim STALE)."""
    c = db.get(Claim, claim_id)
    if c is None:
        raise HTTPException(404, "unknown claim")
    authorize_case(db, user, c.case_id, request, action="REVIEW_DECISION")
    last = db.query(Review).filter_by(target_kind="CLAIM", target_id=claim_id).order_by(Review.created_at.desc()).first()
    if body.decision == "REVERSE":
        if last is None:
            raise HTTPException(409, "nothing to reverse")
        c.state = "CONTRADICTORY" if (c.flags or {}).get("contradicts") else "ALLOWED"
    else:
        c.state = body.decision if body.decision != "APPROVE" else "ALLOWED"
    rev = Review(case_id=c.case_id, target_kind="CLAIM", target_id=claim_id, decision=body.decision, reason=body.reason,
                 reviewer_id=user.user_id, supersedes_id=last.review_id if last else None)
    db.add(rev)
    record_audit(db, request.state.trace_id, user.user_id, "REVIEW_DECISION", "CLAIM", claim_id, c.case_id, detail={"decision": body.decision, "reason": body.reason, "new_state": c.state})
    db.commit()
    return {"claim_id": claim_id, "state": c.state, "review_id": rev.review_id}


@router.get("/cases/{case_id}/reviews")
def list_reviews(case_id: str, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    authorize_case(db, user, case_id, request)
    return [{"review_id": r.review_id, "target_kind": r.target_kind, "target_id": r.target_id, "decision": r.decision, "reason": mask_text(r.reason),
             "reviewer_id": r.reviewer_id, "created_at": r.created_at.isoformat(), "supersedes_id": r.supersedes_id}
            for r in db.query(Review).filter_by(case_id=case_id).order_by(Review.created_at.desc()).all()]


@router.get("/cases/{case_id}/contradictions")
def contradictions(case_id: str, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    authorize_case(db, user, case_id, request)
    from .graph_routes import claim_out
    return [claim_out(c, db) for c in db.query(Claim).filter_by(case_id=case_id, state="CONTRADICTORY").all()]
