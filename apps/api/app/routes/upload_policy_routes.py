"""Upload policy administration and monitoring (docs/UPLOAD_POLICY.md).

GET /upload-policies               authenticated   accepted types and current limits (the upload screen shows them)
PUT /upload-policies/{category}    ADMIN           change max_mb / enabled, with a reason (audited before/after)
GET /upload-policies/metrics       ADMIN, AUDITOR  rejected uploads by reason, resource state, recent audit counts
"""
import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import config
from ..auth import current_user, require_roles
from ..db import get_db
from ..models import AuditEvent, User
from ..services import upload_policy
from ..services.audit import record_audit

router = APIRouter(tags=["upload-policy"])


class UploadPolicyIn(BaseModel):
    max_mb: int = Field(ge=1)
    enabled: bool = True
    reason: str = Field(min_length=10, max_length=500)


@router.get("/upload-policies")
def list_policies(user: User = Depends(current_user), db: Session = Depends(get_db, scope="function")):
    return {"policies": list(upload_policy.effective_policies(db).values()),
            "multipart_max_mb": config.MAX_UPLOAD_MB, "hard_max_mb": config.UPLOAD_HARD_MAX_MB,
            "scanner_max_mb": config.SCAN_MAX_MB,
            "streaming_route": "/api/v1/cases/{case_id}/evidence/stream?filename=..."}


@router.put("/upload-policies/{category}")
def update_policy(category: str, body: UploadPolicyIn, request: Request,
                  user: User = Depends(require_roles("ADMIN", action="manageUploadPolicy")), db: Session = Depends(get_db, scope="function")):
    try:
        upload_policy.update_policy(db, user, category, body.max_mb, body.enabled, body.reason, request.state.trace_id)
    except LookupError:
        raise HTTPException(404, "unknown upload category")
    except ValueError as exc:
        db.rollback()
        record_audit(db, request.state.trace_id, user.user_id, "UPLOAD_POLICY_UPDATE", "UPLOAD_POLICY", category,
                     outcome="DENIED", detail={"reason": str(exc), "requested_max_mb": body.max_mb})
        db.commit()
        raise HTTPException(422, str(exc))
    db.commit()
    return upload_policy.effective_policies(db)[category]


@router.get("/upload-policies/metrics")
def metrics(request: Request, user: User = Depends(require_roles("ADMIN", "AUDITOR", action="viewUploadMetrics")),
            db: Session = Depends(get_db, scope="function")):
    """In-process counters since this API process started, plus durable counts from the audit log (all processes)."""
    since = datetime.datetime.utcnow() - datetime.timedelta(hours=24)
    rows = (db.query(AuditEvent.failure_reason, func.count())
            .filter(AuditEvent.action == "EVIDENCE_UPLOAD", AuditEvent.outcome.in_(["DENIED", "ERROR"]), AuditEvent.created_at >= since)
            .group_by(AuditEvent.failure_reason).all())
    m = upload_policy.METRICS
    free = upload_policy.disk_free_bytes()
    record_audit(db, request.state.trace_id, user.user_id, "UPLOAD_METRICS_VIEW", "UPLOAD_POLICY", None)
    db.commit()
    return {
        "process": {"since": m.started_at, "accepted": m.accepted, "accepted_bytes": m.accepted_bytes,
                    "rejections_by_code": dict(m.rejections), "in_progress": m.in_progress,
                    "peak_in_progress": m.peak_in_progress, "max_concurrent": config.UPLOAD_MAX_CONCURRENT},
        "storage": {"disk_free_mb": free // (1024 * 1024), "min_free_mb": config.UPLOAD_MIN_FREE_MB,
                    "low_disk": free < config.UPLOAD_MIN_FREE_MB * 1024 * 1024 * 2,
                    "staging_in_use_mb": upload_policy.staging_usage_bytes() // (1024 * 1024)},
        "audit_last_24h": {"rejected_or_failed": sum(n for _, n in rows),
                           "by_reason": {(r or "unspecified")[:120]: n for r, n in rows}},
    }
