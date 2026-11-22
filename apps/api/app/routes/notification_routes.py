"""In-app notifications for the signed-in user (the bell in the top bar). Each user sees and changes only their own.

GET  /notifications                 own notifications, newest first (unread_only, limit, offset; X-Total-Count, X-Unread-Count)
GET  /notifications/unread-count    cheap poll for the bell
POST /notifications/{id}/read       mark one as read (someone else's: 404)
POST /notifications/read-all        mark all of one's own as read
"""
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import update
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..models import Notification, User
from ..services.user_requests import RequestError, iso, utcnow

router = APIRouter(tags=["notifications"])


def _out(n: Notification) -> dict:
    return {"notification_id": n.notification_id, "kind": n.kind, "title": n.title, "body": n.body, "link": n.link,
            "request_id": n.request_id, "created_at": iso(n.created_at), "read_at": iso(n.read_at)}


def _unread(db: Session, user: User) -> int:
    return db.query(Notification).filter(Notification.user_id == user.user_id, Notification.read_at.is_(None)).count()


@router.get("/notifications")
def list_notifications(response: Response, user: User = Depends(current_user), db: Session = Depends(get_db, scope="function"),
                       unread_only: bool = False, limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0)):
    query = db.query(Notification).filter(Notification.user_id == user.user_id)
    if unread_only:
        query = query.filter(Notification.read_at.is_(None))
    response.headers["X-Total-Count"] = str(query.count())
    response.headers["X-Unread-Count"] = str(_unread(db, user))
    rows = query.order_by(Notification.created_at.desc(), Notification.notification_id).offset(offset).limit(limit).all()
    return [_out(n) for n in rows]


@router.get("/notifications/unread-count")
def unread_count(user: User = Depends(current_user), db: Session = Depends(get_db, scope="function")):
    return {"unread": _unread(db, user)}


@router.post("/notifications/read-all")
def read_all(user: User = Depends(current_user), db: Session = Depends(get_db, scope="function")):
    result = db.execute(update(Notification).where(Notification.user_id == user.user_id, Notification.read_at.is_(None))
                        .values(read_at=utcnow()).execution_options(synchronize_session=False))
    db.commit()
    return {"marked": result.rowcount, "unread": 0}


@router.post("/notifications/{notification_id}/read")
def read_one(notification_id: str, user: User = Depends(current_user), db: Session = Depends(get_db, scope="function")):
    n = db.get(Notification, notification_id)
    if n is None or n.user_id != user.user_id:
        raise RequestError(404, "Notification not found.", "NOT_FOUND")
    if n.read_at is None:
        n.read_at = utcnow()
        db.commit()
    return {**_out(n), "unread": _unread(db, user)}
