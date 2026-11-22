"""User requests (services/user_requests.py, docs/USER_REQUESTS.md, ADR-018).

GET   /user-requests/categories            authenticated   categories and their fields (drives the request form)
GET   /user-requests                       authenticated   scope=mine (default) | all (ADMIN, AUDITOR); filters, search, paging
GET   /user-requests/summary               authenticated   counts by status for the same scope
POST  /user-requests                       every role       create a draft, or create and submit (submit=true)
GET   /user-requests/{id}                  requester, ADMIN, AUDITOR   detail with history (others: 404)
PATCH /user-requests/{id}                  requester        edit a draft
POST  /user-requests/{id}/{action}         submit | cancel (requester); claim | release | approve | reject | complete (ADMIN)
"""
import datetime
from typing import Literal

from fastapi import APIRouter, Depends, Query, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import current_user, require_roles
from ..db import get_db
from ..models import USER_REQUEST_STATUSES, User, UserRequest
from ..services import user_requests as svc
from ..services.audit import record_audit_best_effort

router = APIRouter(tags=["user-requests"])

Priority = Literal["LOW", "NORMAL", "HIGH", "URGENT"]


class UserRequestIn(BaseModel):
    category: str = Field(min_length=1, max_length=40)
    title: str = Field(min_length=5, max_length=120)
    justification: str = Field(min_length=20, max_length=2000)
    priority: Priority = "NORMAL"
    details: dict = Field(default_factory=dict)
    submit: bool = False


class UserRequestPatch(BaseModel):
    version: int = Field(ge=1)
    title: str | None = Field(default=None, min_length=5, max_length=120)
    justification: str | None = Field(default=None, min_length=20, max_length=2000)
    priority: Priority | None = None
    details: dict | None = None


class TransitionIn(BaseModel):
    version: int = Field(ge=1)
    reason: str | None = Field(default=None, max_length=svc.REASON_MAX)


def _statuses(raw: str | None) -> list[str]:
    if not raw:
        return []
    out = [s.strip().upper() for s in raw.split(",") if s.strip()]
    bad = [s for s in out if s not in USER_REQUEST_STATUSES]
    if bad:
        raise svc.RequestError(422, [{"loc": ["query", "status"], "msg": f"unknown status; one of {', '.join(USER_REQUEST_STATUSES)}",
                                      "type": "value_error"}], "INVALID_REQUEST")
    return out


def _day(raw: str | None, name: str) -> datetime.datetime | None:
    if not raw:
        return None
    try:
        return datetime.datetime.strptime(raw, "%Y-%m-%d")
    except ValueError:
        raise svc.RequestError(422, [{"loc": ["query", name], "msg": "use YYYY-MM-DD", "type": "value_error"}], "INVALID_REQUEST")


def _scope(user: User, scope: str) -> str:
    if scope == "all" and not svc.may_view_all(user):
        raise svc.RequestError(403, "Only administrators and auditors may see everyone's requests.", "FORBIDDEN")
    return scope


@router.get("/user-requests/categories")
def categories(user: User = Depends(current_user)):
    return {"categories": svc.categories_out(), "priorities": list(svc.PRIORITIES), "statuses": list(USER_REQUEST_STATUSES),
            "max_open_per_user": svc.MAX_OPEN_PER_USER, "reason_min": svc.REASON_MIN}


@router.get("/user-requests")
def list_requests(request: Request, response: Response, user: User = Depends(current_user),
                  db: Session = Depends(get_db, scope="function"),
                  scope: Literal["mine", "all"] = "mine", status: str | None = Query(None, max_length=200),
                  category: str | None = Query(None, max_length=40), priority: Priority | None = None,
                  q: str | None = Query(None, max_length=100), requester: str | None = Query(None, max_length=100),
                  assigned_to_me: bool = False, created_from: str | None = None, created_to: str | None = None,
                  sort: Literal["created", "-created", "updated", "-updated", "priority", "-priority", "status", "-status",
                                "reference", "-reference"] = "-updated",
                  limit: int = Query(25, ge=1, le=100), offset: int = Query(0, ge=0)):
    scope = _scope(user, scope)
    if category and category not in svc.CATEGORIES:
        raise svc.RequestError(422, [{"loc": ["query", "category"], "msg": "unknown category", "type": "value_error"}], "INVALID_REQUEST")
    end = _day(created_to, "created_to")
    query = svc.list_query(db, user, scope=scope, statuses=_statuses(status), category=category, priority=priority, q=q,
                           requester=requester, assigned_to_me=assigned_to_me, created_from=_day(created_from, "created_from"),
                           created_to=end + datetime.timedelta(days=1) if end else None)
    response.headers["X-Total-Count"] = str(query.order_by(None).count())
    col = svc.SORTS[sort.lstrip("-")]
    order = col.desc() if sort.startswith("-") else col.asc()
    rows = query.order_by(order, UserRequest.request_id.desc()).offset(offset).limit(limit).all()
    if scope == "all":
        record_audit_best_effort(db, request.state.trace_id, user.user_id, "USER_REQUEST_LIST", "USER_REQUEST", None,
                                 detail={"count": len(rows), "status": status, "category": category})
    return [svc.request_out(db, r, user) for r in rows]


@router.get("/user-requests/summary")
def summary(user: User = Depends(current_user), db: Session = Depends(get_db, scope="function"),
            scope: Literal["mine", "all"] = "mine"):
    scope = _scope(user, scope)
    query = db.query(UserRequest.status, func.count()).group_by(UserRequest.status)
    if scope == "mine":
        query = query.filter(UserRequest.requester_id == user.user_id)
    counts = {s: 0 for s in USER_REQUEST_STATUSES}
    counts.update({s: n for s, n in query.all()})
    mine_to_review = 0
    if svc.may_review(user):
        mine_to_review = db.query(UserRequest).filter(UserRequest.reviewer_id == user.user_id,
                                                      UserRequest.status.in_(("UNDER_REVIEW", "APPROVED"))).count()
    return {"scope": scope, "by_status": counts, "open": sum(counts[s] for s in ("DRAFT", "PENDING", "UNDER_REVIEW", "APPROVED")),
            "assigned_to_me": mine_to_review}


@router.post("/user-requests", status_code=201)
def create_request(body: UserRequestIn, request: Request,
                   user: User = Depends(require_roles(*svc.ROLES, action="createUserRequest")),
                   db: Session = Depends(get_db, scope="function")):
    row = svc.create(db, user, request.state.trace_id, category=body.category, title=body.title,
                     justification=body.justification, priority=body.priority, details=body.details, submit=body.submit)
    return svc.request_out(db, row, user, with_history=True)


@router.get("/user-requests/{request_id}")
def get_request(request_id: int, request: Request, user: User = Depends(current_user),
                db: Session = Depends(get_db, scope="function")):
    row = svc.get_visible(db, user, request_id)
    if row.requester_id != user.user_id:
        record_audit_best_effort(db, request.state.trace_id, user.user_id, "USER_REQUEST_VIEW", "USER_REQUEST",
                                 svc.reference(row.request_id), row.case_id)
    return svc.request_out(db, row, user, with_history=True)


@router.patch("/user-requests/{request_id}")
def edit_request(request_id: int, body: UserRequestPatch, request: Request, user: User = Depends(current_user),
                 db: Session = Depends(get_db, scope="function")):
    row = svc.get_visible(db, user, request_id)
    row = svc.edit(db, user, request.state.trace_id, row, version=body.version, title=body.title,
                   justification=body.justification, priority=body.priority, details=body.details)
    return svc.request_out(db, row, user, with_history=True)


@router.post("/user-requests/{request_id}/{action}")
def act(request_id: int, action: Literal["submit", "cancel", "claim", "release", "approve", "reject", "complete"],
        body: TransitionIn, request: Request, user: User = Depends(current_user),
        db: Session = Depends(get_db, scope="function")):
    row = svc.get_visible(db, user, request_id)
    row = svc.transition(db, user, request.state.trace_id, row, action, version=body.version, reason=body.reason)
    return svc.request_out(db, row, user, with_history=True)
