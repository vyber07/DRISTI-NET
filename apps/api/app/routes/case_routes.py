from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..auth import authorize_case, current_user, require_roles
from ..db import get_db
from ..models import Case, CaseAssignment, Evidence, MatchCandidate, User
from ..schemas import AssignIn, CaseIn
from ..services.audit import record_audit

router = APIRouter(tags=["cases"])


def case_out(c: Case, db: Session) -> dict:
    return {"case_id": c.case_id, "title": c.title, "jurisdiction": c.jurisdiction, "purpose": c.purpose,
            "authority_reference": c.authority_reference,
            "classification": c.classification, "sensitivity": c.sensitivity, "owner_id": c.owner_id, "opened_at": c.opened_at,
            "assigned": [a.user_id for a in c.assignments],
            "evidence_count": db.query(Evidence).filter_by(case_id=c.case_id).count(),
            "pending_reviews": db.query(MatchCandidate).filter_by(case_id=c.case_id, state="REVIEW_REQUIRED").count()}


@router.get("/cases")
def list_cases(user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Only cases the user is assigned to (ADMIN/AUDITOR see all)."""
    q = db.query(Case)
    if user.role not in ("ADMIN", "AUDITOR"):
        ids = [a.case_id for a in db.query(CaseAssignment).filter_by(user_id=user.user_id).all()]
        q = q.filter((Case.case_id.in_(ids)) | (Case.owner_id == user.user_id))
    return [case_out(c, db) for c in q.order_by(Case.case_id).all()]


@router.post("/cases", status_code=201)
def create_case(body: CaseIn, request: Request, user: User = Depends(require_roles("INVESTIGATOR", "ADMIN")), db: Session = Depends(get_db)):
    if db.get(Case, body.case_id):
        raise HTTPException(409, "case_id already exists")
    if body.jurisdiction != user.jurisdiction and user.role != "ADMIN":
        raise HTTPException(403, "cannot create a case outside your jurisdiction")
    c = Case(**body.model_dump(), owner_id=user.user_id)
    c.assignments.append(CaseAssignment(user_id=user.user_id, purpose="owner"))
    db.add(c)
    record_audit(db, request.state.trace_id, user.user_id, "CASE_CREATE", "CASE", c.case_id, c.case_id, detail=body.model_dump())
    db.commit()
    return case_out(c, db)


@router.get("/cases/{case_id}")
def get_case(case_id: str, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    c = authorize_case(db, user, case_id, request)
    record_audit(db, request.state.trace_id, user.user_id, "CASE_VIEW", "CASE", case_id, case_id)
    db.commit()
    return case_out(c, db)


@router.post("/cases/{case_id}/assign")
def assign(case_id: str, body: AssignIn, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    c = authorize_case(db, user, case_id, request, action="CASE_ASSIGN")
    if user.role != "ADMIN" and c.owner_id != user.user_id:
        raise HTTPException(403, "only the case owner or an ADMIN may assign users")
    target = db.query(User).filter_by(username=body.username).first()
    if target is None:
        raise HTTPException(404, "unknown user")
    if not db.query(CaseAssignment).filter_by(case_id=case_id, user_id=target.user_id).first():
        db.add(CaseAssignment(case_id=case_id, user_id=target.user_id, purpose=body.purpose))
    record_audit(db, request.state.trace_id, user.user_id, "CASE_ASSIGN", "USER", target.user_id, case_id, detail={"purpose": body.purpose})
    db.commit()
    return case_out(db.get(Case, case_id), db)
