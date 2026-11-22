from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import authorize_case, current_user, require_roles
from ..db import get_db
from ..models import Case, CaseAssignment, Evidence, MatchCandidate, User
from ..schemas import AssignIn, CaseIn, CaseOut, CasePrimaryIn, CaseUnassignIn
from ..services import case_assignments
from ..services.audit import record_audit, record_audit_best_effort, record_read
from .listing import MAX_LIMIT, page, text_filter

router = APIRouter(tags=["cases"])


def case_out(c: Case, db: Session) -> dict:
    return {"case_id": c.case_id, "title": c.title, "jurisdiction": c.jurisdiction, "purpose": c.purpose,
            "authority_reference": c.authority_reference,
            "classification": c.classification, "sensitivity": c.sensitivity, "owner_id": c.owner_id, "opened_at": c.opened_at,
            "assigned": [a.user_id for a in c.assignments],
            # Display names for the people already listed in `assigned`, so the UI can show who is on the case instead of
            # raw user IDs. Only users assigned to this case; never credentials. (Frontend redesign, 2026-11-04.)
            "people": [{"user_id": a.user_id, "org_user_id": u.org_user_id, "display_name": u.display_name, "role": u.role, "purpose": a.purpose,
                        "is_owner": a.user_id == c.owner_id}
                       for a in c.assignments if (u := db.get(User, a.user_id)) is not None],
            "evidence_count": db.query(Evidence).filter_by(case_id=c.case_id).count(),
            "pending_reviews": db.query(MatchCandidate).filter_by(case_id=c.case_id, state="REVIEW_REQUIRED").count()}


@router.get("/cases", response_model=list[CaseOut])
def list_cases(response: Response, q: str | None = Query(None, max_length=200), awaiting_review: bool = False,
               limit: int | None = Query(None, ge=1, le=MAX_LIMIT), offset: int = Query(0, ge=0),
               user: User = Depends(current_user), db: Session = Depends(get_db, scope="function")):
    """Only cases the user is assigned to (ADMIN/AUDITOR see all). Optional search/paging; X-Total-Count = matches."""
    record_read(db, None, user.user_id, "CASE_LIST", search=q,  # request ID comes from the request context
                detail={"awaiting_review": awaiting_review, "limit": limit, "offset": offset})
    query = db.query(Case)
    if user.role not in ("ADMIN", "AUDITOR"):
        ids = [a.case_id for a in db.query(CaseAssignment).filter_by(user_id=user.user_id).all()]
        query = query.filter((Case.case_id.in_(ids)) | (Case.owner_id == user.user_id))
        query = query.filter(Case.jurisdiction == user.jurisdiction)  # DEF-048: same rule as authorize_case
    query = text_filter(query, q, Case.case_id, Case.title, Case.purpose, Case.jurisdiction, Case.authority_reference)
    if awaiting_review:
        query = query.filter(Case.case_id.in_(select(MatchCandidate.case_id).where(MatchCandidate.state == "REVIEW_REQUIRED")))
    return [case_out(c, db) for c in page(query.order_by(Case.case_id), response, limit, offset)]


@router.post("/cases", status_code=201, response_model=CaseOut)
def create_case(body: CaseIn, request: Request, user: User = Depends(require_roles("INVESTIGATOR", "ADMIN", action="createCase")), db: Session = Depends(get_db, scope="function")):
    if db.get(Case, body.case_id):
        raise HTTPException(409, "case_id already exists")
    if body.jurisdiction != user.jurisdiction and user.role != "ADMIN":
        raise HTTPException(403, "cannot create a case outside your jurisdiction")
    c = Case(**body.model_dump(), owner_id=user.user_id)
    c.assignments.append(CaseAssignment(user_id=user.user_id, purpose="owner"))
    db.add(c)
    case_assignments.record_creation(db, c, user)  # creator = primary investigator; history rows
    record_audit(db, request.state.trace_id, user.user_id, "CASE_CREATE", "CASE", c.case_id, c.case_id, detail=body.model_dump())
    db.commit()
    return case_out(c, db)


@router.get("/cases/{case_id}", response_model=CaseOut)
def get_case(case_id: str, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db, scope="function")):
    c = authorize_case(db, user, case_id, request)
    record_audit(db, request.state.trace_id, user.user_id, "CASE_VIEW", "CASE", case_id, case_id)
    db.commit()
    return case_out(c, db)


@router.post("/cases/{case_id}/assign", response_model=CaseOut)
def assign(case_id: str, body: AssignIn, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db, scope="function")):
    """Add a person to the case as a supporting member: the primary investigator or an ADMIN, with a reason
    (services/case_assignments.py). The caller must be able to open the case."""
    authorize_case(db, user, case_id, request, action="CASE_ASSIGN")
    if bool(body.username) == bool(body.user_id):
        raise HTTPException(422, "name the person by exactly one of username or user_id")
    target = (db.query(User).filter_by(username=body.username).first() if body.username
              else db.get(User, body.user_id))
    if target is None:
        raise HTTPException(404, "unknown user")
    case_assignments.assign(db, user, case_id, target, purpose=body.purpose, reason=body.reason,
                            trace_id=request.state.trace_id)
    db.commit()
    return case_out(db.get(Case, case_id), db)


@router.post("/cases/{case_id}/assignments/{user_id}/remove")
def unassign(case_id: str, user_id: str, body: CaseUnassignIn, request: Request, user: User = Depends(require_roles("ADMIN", action="manageCaseAssignments")), db: Session = Depends(get_db, scope="function")):
    """Take a supporting member off the case. Their access ends on their next request. ADMIN only, reason required.
    The primary investigator cannot be removed (409 PRIMARY_CANNOT_BE_REMOVED): hand the case over first."""
    result = case_assignments.remove(db, user, case_id, user_id, reason=body.reason, trace_id=request.state.trace_id)
    db.commit()
    return result


@router.post("/cases/{case_id}/primary")
def change_primary(case_id: str, body: CasePrimaryIn, request: Request, user: User = Depends(require_roles("ADMIN", action="manageCaseAssignments")), db: Session = Depends(get_db, scope="function")):
    """Hand the case to another investigator (controlled handover). ADMIN only, reason required. 409 PRIMARY_CHANGED
    if expected_primary_id is no longer the primary investigator. previous=KEEP leaves the old primary on the case as a
    supporting member; REMOVE takes them off it."""
    target = db.get(User, body.user_id)
    if target is None:
        raise HTTPException(404, "unknown user")
    result = case_assignments.set_primary(db, user, case_id, target, expected_primary_id=body.expected_primary_id,
                                          reason=body.reason, previous=body.previous, trace_id=request.state.trace_id)
    db.commit()
    return result


@router.get("/cases/{case_id}/assignments")
def case_assignment_detail(case_id: str, request: Request, user: User = Depends(require_roles("ADMIN", "AUDITOR", action="viewCaseAssignments")), db: Session = Depends(get_db, scope="function")):
    """The case team with each person's effective access, and the assignment history (newest first)."""
    case = db.get(Case, case_id)
    if case is None:
        raise HTTPException(404, "unknown case")
    team = case_assignments.members(db, case)
    out = {**case_assignments.case_overview(db, case, team), "members": team,
           "history": case_assignments.history(db, case_id)}
    record_audit_best_effort(db, request.state.trace_id, user.user_id, "CASE_ASSIGNMENTS_VIEW", "CASE", case_id, case_id)
    return out


@router.get("/case-assignments")
def case_assignment_list(response: Response, request: Request, q: str | None = Query(None, max_length=200),
                         jurisdiction: str | None = Query(None, max_length=120), user_id: str | None = Query(None, max_length=64),
                         attention: bool = False, unstaffed: bool = False,
                         limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
                         user: User = Depends(require_roles("ADMIN", "AUDITOR", action="viewCaseAssignments")),
                         db: Session = Depends(get_db, scope="function")):
    """Every case with its primary investigator, team size and problems. attention=true: cases whose primary
    investigator or a member cannot actually open the case. unstaffed=true: no supporting member with access.
    X-Total-Count = matches."""
    rows = case_assignments.list_cases(db, q=q, jurisdiction=jurisdiction, user_id=user_id, attention=attention,
                                       unstaffed=unstaffed)
    response.headers["X-Total-Count"] = str(len(rows))
    record_audit_best_effort(db, request.state.trace_id, user.user_id, "CASE_ASSIGNMENTS_LIST", "CASE", None,
                             detail={"q": q, "attention": attention, "unstaffed": unstaffed, "count": len(rows)})
    return rows[offset:offset + limit]
