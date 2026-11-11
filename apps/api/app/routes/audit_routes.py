"""Audit log read, export, verification and digest endpoints.

Access (docs/AUDIT_LOG_POLICY.md section 3):
  GET /audit, /audit/export, /audit/verify, /audit/digest   AUDITOR and ADMIN only
  GET /cases/{case_id}/audit   assigned investigators see the case's events WITHOUT network or session details;
                               AUDITOR and ADMIN see everything.
Every read of the audit log is itself audited, fail-closed: if the read cannot be recorded, it is not served.
"""
import csv
import datetime
import io
import json
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session

from .. import config
from ..auth import authorize_case, current_user, require_roles
from ..db import get_db
from ..models import AuditEvent, User
from ..services.audit import digest_range, record_audit, verify_range

router = APIRouter(tags=["audit"])

_NETWORK_FIELDS = ("ip_address", "user_agent", "session_id", "correlation_id")


def _local(dt: datetime.datetime) -> str:
    """Display-only conversion of a stored naive-UTC timestamp to the deployment's display zone."""
    aware = dt.replace(tzinfo=datetime.timezone.utc)
    return aware.astimezone(ZoneInfo(config.AUDIT_DISPLAY_TZ)).isoformat()


def audit_out(a: AuditEvent, *, network: bool = True) -> dict:
    created = a.created_at
    out = {
        "audit_id": a.audit_id,
        "request_id": a.trace_id,
        # Earlier field names, kept so existing clients keep working: trace_id is the request ID.
        "trace_id": a.trace_id,
        "target_kind": a.target_kind,
        "target_id": a.target_id,
        "correlation_id": a.correlation_id,
        "created_at": created.isoformat(),  # earlier name, naive UTC, kept for existing clients
        "occurred_at_utc": created.replace(tzinfo=datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
        "occurred_at_local": _local(created),
        "display_timezone": config.AUDIT_DISPLAY_TZ,
        "actor_id": a.actor_id,
        "actor_username": a.actor_username,
        "actor_role": a.actor_role,
        "office_id": a.office_id,
        "action": a.action,
        "resource_type": a.target_kind,
        "resource_id": a.target_id,
        "case_id": a.case_id,
        "resource_office": a.resource_office,
        "outcome": a.outcome,
        "failure_reason": a.failure_reason,
        "detail": a.detail,
        "signature_present": bool(a.signature),
    }
    if network:
        out.update({"session_id": a.session_id, "ip_address": a.ip_address, "user_agent": a.user_agent})
    return out


def _window(query, start: datetime.datetime | None, end: datetime.datetime | None):
    if start is not None:
        query = query.filter(AuditEvent.created_at >= start)
    if end is not None:
        query = query.filter(AuditEvent.created_at < end)
    return query


def _parse_day(text: str | None, name: str) -> datetime.datetime | None:
    """Parse an ISO-8601 date or datetime into naive UTC (the storage convention). Offsets are converted, not dropped."""
    if not text:
        return None
    try:
        parsed = datetime.datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(422, f"{name} must be an ISO-8601 date or datetime")
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(datetime.timezone.utc).replace(tzinfo=None)
    return parsed


_EXAMPLE_ROW = AuditEvent(audit_id="", trace_id="", action="", outcome="", detail={}, created_at=datetime.datetime(2000, 1, 1))


@router.get("/audit")
def all_audit(request: Request, limit: int = Query(200, ge=1, le=1000), action: str | None = None,
              outcome: str | None = None, actor_id: str | None = None,
              start: str | None = None, end: str | None = None,
              user: User = Depends(require_roles("AUDITOR", "ADMIN")), db: Session = Depends(get_db)):
    q = db.query(AuditEvent)
    if action:
        q = q.filter(AuditEvent.action == action)
    if outcome:
        q = q.filter(AuditEvent.outcome == outcome)
    if actor_id:
        q = q.filter(AuditEvent.actor_id == actor_id)
    q = _window(q, _parse_day(start, "start"), _parse_day(end, "end"))
    rows = q.order_by(AuditEvent.created_at.desc(), AuditEvent.audit_id.desc()).limit(min(limit, 1000)).all()
    record_audit(db, request.state.trace_id, user.user_id, "AUDIT_LOG_VIEW", "AUDIT", None,
                 detail={"filters": {"action": action, "outcome": outcome, "actor_id": actor_id, "start": start, "end": end},
                         "returned": len(rows)})
    db.commit()  # fail-closed: if the read cannot be recorded, it is not served
    return [audit_out(a) for a in rows]


@router.get("/cases/{case_id}/audit")
def case_audit(case_id: str, request: Request, limit: int = Query(200, ge=1, le=1000),
               user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Case-scoped trail. Investigators assigned to the case get the events without IP, user agent or session data,
    because network and session details about colleagues are not needed for case work."""
    authorize_case(db, user, case_id, request, action="AUDIT_VIEW")
    full = user.role in ("AUDITOR", "ADMIN")
    rows = (db.query(AuditEvent).filter_by(case_id=case_id)
            .order_by(AuditEvent.created_at.desc(), AuditEvent.audit_id.desc()).limit(min(limit, 1000)).all())
    record_audit(db, request.state.trace_id, user.user_id, "AUDIT_VIEW", "CASE", case_id, case_id,
                 detail={"returned": len(rows), "network_fields": full})
    db.commit()
    return [audit_out(a, network=full) for a in rows]


@router.get("/audit/export")
def export_audit(request: Request, format: str = Query("csv", pattern="^(csv|json)$"),
                 start: str | None = None, end: str | None = None, limit: int = Query(10000, ge=1, le=50000),
                 user: User = Depends(require_roles("AUDITOR", "ADMIN")), db: Session = Depends(get_db)):
    """Export a time window. The export is itself an audited EXPORT (fail-closed). Timestamps are UTC, with a local
    display column. Exports contain network fields: treat them as restricted."""
    rows = _window(db.query(AuditEvent), _parse_day(start, "start"), _parse_day(end, "end")) \
        .order_by(AuditEvent.created_at, AuditEvent.audit_id).limit(limit).all()
    record_audit(db, request.state.trace_id, user.user_id, "AUDIT_EXPORT", "AUDIT", None,
                 detail={"format": format, "start": start, "end": end, "rows": len(rows)})
    db.commit()
    data = [audit_out(a) for a in rows]
    if format == "json":
        return Response(content=json.dumps(data, ensure_ascii=False, indent=1), media_type="application/json",
                        headers={"Content-Disposition": "attachment; filename=audit-export.json", "Cache-Control": "no-store"})
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=list(audit_out(_EXAMPLE_ROW).keys()))
    writer.writeheader()
    for row in data:
        writer.writerow({k: (json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else v) for k, v in row.items()})
    return Response(content=buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": "attachment; filename=audit-export.csv", "Cache-Control": "no-store"})


@router.get("/audit/verify")
def verify_audit(request: Request, start: str | None = None, end: str | None = None,
                 user: User = Depends(require_roles("AUDITOR", "ADMIN")), db: Session = Depends(get_db)):
    """Recomputes every signature in the window. Reports counts and the IDs of any row that fails."""
    result = verify_range(db, _parse_day(start, "start"), _parse_day(end, "end"))
    record_audit(db, request.state.trace_id, user.user_id, "AUDIT_VERIFY", "AUDIT", None,
                 outcome="OK" if result["invalid"] == 0 else "ERROR",
                 detail={"total": result["total"], "invalid": result["invalid"], "unsigned": result["unsigned"]})
    db.commit()
    return result


@router.get("/audit/digest")
def audit_digest(request: Request, day: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
                 user: User = Depends(require_roles("AUDITOR", "ADMIN")), db: Session = Depends(get_db)):
    """SHA-256 over one UTC day's signatures. Store each day's digest off-host; a later mismatch shows removed or
    altered rows (docs/AUDIT_LOG_POLICY.md section 5)."""
    start = datetime.datetime.strptime(day, "%Y-%m-%d")
    result = digest_range(db, start, start + datetime.timedelta(days=1))
    record_audit(db, request.state.trace_id, user.user_id, "AUDIT_DIGEST", "AUDIT", None,
                 detail={"day": day, "count": result["count"]})
    db.commit()
    return result
