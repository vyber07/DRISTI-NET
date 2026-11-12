from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.orm import aliased
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .graph_routes import claim_out
from .listing import MAX_LIMIT, like_pattern, page
from ..auth import authorize_case, current_user, require_roles
from ..db import get_db
from ..models import SENSITIVE_KINDS, Claim, Entity, MatchCandidate, Review, User
from ..schemas import DecisionIn
from ..services import pipeline
from ..services.audit import record_audit, record_read
from ..services.masking import (case_attributes, case_pii_values_cached, mask_attribute, mask_attributes, mask_block_key,
                                mask_label, mask_text, redact_structure)
from ..services.resolution import _profile

router = APIRouter(tags=["review"])


def entity_summary(db: Session, ent: Entity, case_id: str) -> dict:
    prof = _profile(db, case_id, ent)
    case_attrs = case_attributes(ent.attributes, case_id)
    return {"entity_id": ent.entity_id, "kind": ent.kind, "label": mask_label(ent.kind, ent.label),
            "attributes": mask_attributes({k: v for k, v in case_attrs.items() if k in ("dob", "address", "person_id", "source_document", "mention_of")}),
            "names": sorted(prof["names"]), "aliases": sorted(prof["aliases"]),
            "phones": [mask_label("PHONE", p) for p in sorted(prof["phones"])], "accounts": [mask_label("ACCOUNT", a) for a in sorted(prof["accounts"])],
            "orgs": sorted(prof["orgs"]),
            # Field-level masking: a reviewer compares candidates on the masked forms (birth year, presence of an
            # address); the raw values come only from the audited attribute-reveal endpoint.
            "dob": sorted({mask_attribute("dob", d) for d in prof["dob"]}),
            "address": sorted({mask_attribute("address", a) for a in prof["address"]}),
            "evidence_ids": sorted(prof["evidence"])}


def candidate_out(db: Session, m: MatchCandidate, detailed: bool = True) -> dict:
    left, right = db.get(Entity, m.left_entity_id), db.get(Entity, m.right_entity_id)
    reviews = db.query(Review).filter_by(target_kind="MATCH", target_id=m.candidate_id).order_by(Review.created_at).all()
    known_pii = case_pii_values_cached(db, m.case_id)
    d = {"candidate_id": m.candidate_id, "case_id": m.case_id, "state": m.state, "confidence": m.confidence, "matcher_version": m.matcher_version,
         # Matcher output quotes the compared values (e.g. both dates of birth): masked like any other output.
         "block_key": mask_block_key(m.block_key),
         "positive_signals": redact_structure(m.positive_signals, known_pii),
         "counter_evidence": redact_structure(m.counter_evidence, known_pii),
         "conflicts": redact_structure(m.conflicts, known_pii),
         "missing": redact_structure(m.missing, known_pii), "evidence_ids": m.evidence_ids, "created_at": m.created_at.isoformat(),
         "assigned_to": m.assigned_to, "assigned_at": m.assigned_at,
         "left": {"entity_id": left.entity_id, "label": mask_label(left.kind, left.label), "kind": left.kind},
         "right": {"entity_id": right.entity_id, "label": mask_label(right.kind, right.label), "kind": right.kind},
         "reviews": [{"review_id": r.review_id, "decision": r.decision, "reason": mask_text(r.reason), "reviewer_id": r.reviewer_id, "created_at": r.created_at.isoformat(), "supersedes_id": r.supersedes_id} for r in reviews]}
    if detailed:
        d["left"] = entity_summary(db, left, m.case_id)
        d["right"] = entity_summary(db, right, m.case_id)
        # DEF-099: evidence about either record that arrived after this candidate's signals were computed. For a
        # decided candidate the signals are the snapshot the reviewer decided on; this tells them what is newer.
        current = set(d["left"]["evidence_ids"]) | set(d["right"]["evidence_ids"])
        d["new_evidence_since_snapshot"] = sorted(current - set(m.evidence_ids or []))
    return d


@router.get("/cases/{case_id}/candidates")
def list_candidates(case_id: str, request: Request, response: Response, state: str | None = None,
                    q: str | None = Query(None, max_length=200), limit: int | None = Query(None, ge=1, le=MAX_LIMIT),
                    offset: int = Query(0, ge=0), user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Optional name search and paging; X-Total-Count = matches. The search never matches masked kinds (phone,
    account): matching their raw labels would reveal whether a hidden number exists in the case."""
    authorize_case(db, user, case_id, request, action="REVIEW_QUEUE")
    record_read(db, None, user.user_id, "CANDIDATE_LIST", case_id=case_id, search=q,
                detail={"state": state, "limit": limit, "offset": offset})
    query = db.query(MatchCandidate).filter_by(case_id=case_id)
    if state:  # one state, or several separated by commas (e.g. "APPROVE,REJECT" for the "Decided" filter)
        query = query.filter(MatchCandidate.state.in_([x.strip() for x in state.split(",") if x.strip()]))
    if q and q.strip():
        L, R = aliased(Entity), aliased(Entity)
        pat = like_pattern(q)
        query = (query.join(L, MatchCandidate.left_entity_id == L.entity_id).join(R, MatchCandidate.right_entity_id == R.entity_id)
                 .filter(((L.label.ilike(pat, escape="\\")) & L.kind.notin_(SENSITIVE_KINDS))
                         | ((R.label.ilike(pat, escape="\\")) & R.kind.notin_(SENSITIVE_KINDS))
                         | MatchCandidate.candidate_id.ilike(pat, escape="\\")))
    rows = page(query.order_by(MatchCandidate.confidence.desc(), MatchCandidate.candidate_id), response, limit, offset)
    return [candidate_out(db, m, detailed=False) for m in rows]


@router.get("/cases/{case_id}/candidates/summary")
def candidates_summary(case_id: str, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Counts by review state for any case member (GET /stats is limited to roles that may decide)."""
    authorize_case(db, user, case_id, request, action="REVIEW_QUEUE")
    record_read(db, None, user.user_id, "CANDIDATE_SUMMARY", case_id=case_id)
    rows = db.query(MatchCandidate.state, func.count()).filter_by(case_id=case_id).group_by(MatchCandidate.state).all()
    return {"case_id": case_id, "total": sum(n for _, n in rows), "by_state": {s: n for s, n in rows}}


@router.get("/candidates/{candidate_id}")
def get_candidate(candidate_id: str, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = db.get(MatchCandidate, candidate_id)
    if m is None:
        raise HTTPException(404, "unknown candidate")
    authorize_case(db, user, m.case_id, request, action="REVIEW_VIEW")
    record_read(db, None, user.user_id, "CANDIDATE_VIEW", case_id=m.case_id, target_kind="CANDIDATE", target_id=m.candidate_id,
                sensitive=True)
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


@router.post("/candidates/{candidate_id}/assign")
def assign_candidate(candidate_id: str, request: Request, user: User = Depends(require_roles("REVIEWER", "INVESTIGATOR", "ADMIN")), db: Session = Depends(get_db)):
    """Assign a candidate to the current user."""
    m = db.get(MatchCandidate, candidate_id)
    if m is None:
        raise HTTPException(404, "unknown candidate")
    # DEF-031: role alone is not enough -- the candidate's case must be authorized for this user.
    authorize_case(db, user, m.case_id, request, action="HITL_TASK_ASSIGN")

    import datetime
    m.assigned_to = user.user_id
    m.assigned_at = datetime.datetime.now(datetime.UTC).isoformat()
    record_audit(db, request.state.trace_id, user.user_id, "HITL_TASK_ASSIGNED", "MATCH_CANDIDATE", candidate_id, m.case_id)
    db.commit()
    return candidate_out(db, m)  # DEF-032: was candidate_out(m) -> TypeError -> HTTP 500 after the commit

@router.get("/cases/{case_id}/stats")
def hitl_stats(case_id: str, request: Request, user: User = Depends(require_roles("REVIEWER", "INVESTIGATOR", "ADMIN")), db: Session = Depends(get_db)):
    """Returns HITL statistics for a case."""
    authorize_case(db, user, case_id, request, action="HITL_STATS")  # DEF-031
    record_read(db, None, user.user_id, "HITL_STATS_VIEW", case_id=case_id)
    cands = db.scalars(select(MatchCandidate).where(MatchCandidate.case_id == case_id)).all()
    total = len(cands)
    pending = sum(1 for c in cands if c.state == "REVIEW_REQUIRED")
    resolved = sum(1 for c in cands if c.state in ("APPROVE", "REJECT"))
    contradictions = sum(1 for c in cands if c.conflicts)
    active_analysts = len(set(c.assigned_to for c in cands if getattr(c, "assigned_to", None) is not None))
    in_review = sum(1 for c in cands if c.state == "REVIEW_REQUIRED" and getattr(c, "assigned_to", None) is not None)
    
    return {
        "totalTasks": total,
        "pendingCount": pending,
        "criticalCount": contradictions,
        "identityMergesCount": sum(1 for c in cands if c.state == "APPROVE"),
        "resolvedCount": resolved,
        "activeAnalysts": active_analysts,
        "inReviewCount": in_review,
        "contradictionsCount": contradictions
    }

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
    record_read(db, None, user.user_id, "REVIEW_LIST", case_id=case_id)
    return [{"review_id": r.review_id, "target_kind": r.target_kind, "target_id": r.target_id, "decision": r.decision, "reason": mask_text(r.reason),
             "reviewer_id": r.reviewer_id, "created_at": r.created_at.isoformat(), "supersedes_id": r.supersedes_id}
            for r in db.query(Review).filter_by(case_id=case_id).order_by(Review.created_at.desc()).all()]


@router.get("/cases/{case_id}/contradictions")
def contradictions(case_id: str, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    authorize_case(db, user, case_id, request)
    record_read(db, None, user.user_id, "CONTRADICTION_LIST", case_id=case_id)
    return [claim_out(c, db) for c in db.query(Claim).filter_by(case_id=case_id, state="CONTRADICTORY").all()]
