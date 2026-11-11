"""Audit event writer, signer and verifier.

Every event is written in the caller's database transaction, so a sensitive operation and its audit record commit
or roll back together (fail-closed; see docs/AUDIT_LOG_POLICY.md for the per-operation criticality). Read-only
views use `record_audit_best_effort`, which logs a failed write and lets the read continue.

Context (IP, user agent, session, request ID, correlation ID, actor username, role and office) comes from
core/request_context.py and the database, not from the caller, so existing call sites gain it unchanged.

Integrity: each row is signed with HMAC-SHA256 over every field (algorithm "hmac-sha256-json-v2"). Earlier
algorithms stay verifiable, so old rows keep their signatures. Rows are append-only at the database
(triggers in db.py / migration 5bcde1234572). Deletion by a database owner is detectable only against an
exported daily digest (`digest_range`), which is why digests are part of the archival procedure.
"""
from __future__ import annotations

import datetime
import hashlib
import hmac
import json
import logging

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from .. import config
from ..core import request_context
from ..models import AuditEvent, Case, User, new_id, utcnow

logger = logging.getLogger("drishti.audit")

# Key rotation: the signature is "key_id:algorithm:hmac_hex".
CURRENT_AUDIT_KEY_ID = "k1-2026"  # kept for compatibility; the live key id comes from config.CURRENT_AUDIT_KEY_ID


def _ensure_defaults(ev: AuditEvent) -> None:
    if ev.created_at is None:
        ev.created_at = utcnow()
    if ev.audit_id is None:
        ev.audit_id = new_id("AUD")


def _utc_iso(dt: datetime.datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=datetime.timezone.utc)
    return dt.isoformat()


def _compute_hmac(key_bytes: bytes, ev: AuditEvent) -> str:
    """Legacy algorithm 'hmac-sha256' (pipe-joined). Verification only."""
    _ensure_defaults(ev)
    payload = (f"{ev.audit_id}|{ev.trace_id}|{ev.actor_id or ''}|{ev.action}|{ev.target_kind or ''}|{ev.target_id or ''}|"
               f"{ev.case_id or ''}|{ev.outcome}|{_utc_iso(ev.created_at)}|{json.dumps(ev.detail, sort_keys=True)}")
    return hmac.new(key_bytes, payload.encode("utf-8"), hashlib.sha256).hexdigest()


def _compute_hmac_json(key_bytes: bytes, ev: AuditEvent) -> str:
    """Algorithm 'hmac-sha256-json' (DEF-091: JSON array keeps field boundaries). Verification only for new rows."""
    _ensure_defaults(ev)
    fields = [ev.audit_id, ev.trace_id, ev.actor_id or "", ev.action, ev.target_kind or "", ev.target_id or "",
              ev.case_id or "", ev.outcome, _utc_iso(ev.created_at), ev.detail]
    payload = json.dumps(fields, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hmac.new(key_bytes, payload.encode("utf-8"), hashlib.sha256).hexdigest()


def _compute_hmac_v2(key_bytes: bytes, ev: AuditEvent) -> str:
    """Algorithm 'hmac-sha256-json-v2': every stored field, in a fixed order. Adding or changing any field in a
    row invalidates its signature."""
    _ensure_defaults(ev)
    fields = [ev.audit_id, ev.trace_id, ev.actor_id or "", ev.action, ev.target_kind or "", ev.target_id or "",
              ev.case_id or "", ev.outcome, _utc_iso(ev.created_at), ev.detail or {},
              ev.actor_username or "", ev.actor_role or "", ev.office_id or "", ev.resource_office or "",
              ev.session_id or "", ev.ip_address or "", ev.user_agent or "", ev.correlation_id or "",
              ev.failure_reason or ""]
    payload = json.dumps(fields, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hmac.new(key_bytes, payload.encode("utf-8"), hashlib.sha256).hexdigest()


_ALGORITHMS = {"hmac-sha256": _compute_hmac, "hmac-sha256-json": _compute_hmac_json, "hmac-sha256-json-v2": _compute_hmac_v2}
CURRENT_ALGORITHM = "hmac-sha256-json-v2"


def sign_audit_event(ev: AuditEvent) -> str:
    key_bytes = config.AUDIT_KEYS[config.CURRENT_AUDIT_KEY_ID].encode("utf-8")
    sig_hex = _ALGORITHMS[CURRENT_ALGORITHM](key_bytes, ev)
    return f"{config.CURRENT_AUDIT_KEY_ID}:{CURRENT_ALGORITHM}:{sig_hex}"


def verify_audit_event(ev: AuditEvent) -> bool:
    if not ev.signature:
        return False  # unsigned legacy row or missing signature
    parts = ev.signature.split(":")
    if len(parts) != 3:
        return False
    key_id, algo, sig_hex = parts
    if key_id not in config.AUDIT_KEYS:
        return False  # cannot verify with an unknown key
    compute = _ALGORITHMS.get(algo)
    if compute is None:
        return False
    expected_hex = compute(config.AUDIT_KEYS[key_id].encode("utf-8"), ev)
    return hmac.compare_digest(expected_hex, sig_hex)


def _attach_actor(db: Session, ev: AuditEvent, ctx) -> None:
    """Fill the actor's username, role, office and session from the database row (or the authenticated request)."""
    if ctx is not None and ctx.user_id and (ev.actor_id is None or ev.actor_id == ctx.user_id):
        if ev.actor_id is None:
            ev.actor_id = ctx.user_id
        ev.actor_username, ev.actor_role = ctx.username, ctx.role
        ev.office_id, ev.session_id = ctx.office_id, ctx.session_id
    elif ev.actor_id:
        user = db.get(User, ev.actor_id)
        if user is not None:
            ev.actor_username, ev.actor_role, ev.office_id = user.username, user.role, user.office_id


def _case_office(db: Session, case_id: str | None) -> str | None:
    if not case_id:
        return None
    case = db.get(Case, case_id)
    return case.jurisdiction if case is not None else None


def record_audit(db: Session, trace_id: str | None, actor_id: str | None, action: str, target_kind: str | None = None,
                 target_id: str | None = None, case_id: str | None = None, outcome: str = "OK", detail: dict | None = None,
                 *, failure_reason: str | None = None) -> AuditEvent:
    """Create a signed audit event in the caller's transaction. It is written when the caller commits; if the commit
    fails, the operation it records does not happen either (fail-closed)."""
    ctx = request_context.current()
    # The request ID is server-generated and comes from the context. The argument is used only outside a request
    # (background jobs), where the caller supplies its own identifier.
    effective_trace = ctx.request_id if ctx is not None else (trace_id or request_context.new_request_id())
    raw_detail = detail or {}
    ev = AuditEvent(trace_id=effective_trace, actor_id=actor_id, action=action, target_kind=target_kind,
                    target_id=target_id, case_id=case_id, outcome=outcome,
                    detail=request_context.sanitize_detail(raw_detail))
    ev.audit_id = new_id("AUD")
    ev.created_at = utcnow()
    _attach_actor(db, ev, ctx)
    if ctx is not None:
        ev.ip_address = ctx.client_ip
        ev.user_agent = ctx.user_agent
        ev.correlation_id = ctx.correlation_id
    ev.resource_office = _case_office(db, case_id)
    if outcome != "OK":
        ev.failure_reason = request_context.sanitize_failure_reason(failure_reason or raw_detail.get("reason"))
    ev.signature = sign_audit_event(ev)
    db.add(ev)
    return ev


def record_audit_best_effort(db: Session, *args, **kwargs) -> AuditEvent | None:
    """For read-only views only. The event is committed on its own; if anything fails (database or signing) the
    failure is logged without request data and the read is still served. Safe because a read has no pending writes
    of its own. Never use this for a state change: those use record_audit and fail closed."""
    action = kwargs.get("action") or (args[2] if len(args) > 2 else "?")
    try:
        ev = record_audit(db, *args, **kwargs)
        db.commit()
        return ev
    except Exception as exc:  # noqa: BLE001 -- deliberately broad for a best-effort path
        db.rollback()
        # Log the action and exception type only: SQL error text can echo bound parameters (search text, identifiers).
        logger.error("audit write failed for best-effort read %s (%s); the read was served", action, type(exc).__name__)
        return None


def digest_range(db: Session, start: datetime.datetime, end: datetime.datetime) -> dict:
    """SHA-256 over the ordered signatures of every event in [start, end). Export this daily; if a stored digest
    later differs from a recomputed one, rows were removed or altered. Times are naive UTC."""
    rows = (db.query(AuditEvent.audit_id, AuditEvent.created_at, AuditEvent.signature)
            .filter(AuditEvent.created_at >= start, AuditEvent.created_at < end)
            .order_by(AuditEvent.created_at, AuditEvent.audit_id).all())
    h = hashlib.sha256()
    for audit_id, created_at, signature in rows:
        h.update(f"{audit_id}|{_utc_iso(created_at)}|{signature or ''}\n".encode("utf-8"))
    return {"count": len(rows), "sha256": h.hexdigest(), "from": start.isoformat() + "Z", "to": end.isoformat() + "Z"}


def verify_range(db: Session, start: datetime.datetime | None = None, end: datetime.datetime | None = None, sample_limit: int = 100) -> dict:
    """Recompute every signature in the range. Returns counts and up to `sample_limit` failing audit IDs."""
    q = db.query(AuditEvent)
    if start is not None:
        q = q.filter(AuditEvent.created_at >= start)
    if end is not None:
        q = q.filter(AuditEvent.created_at < end)
    total = valid = unsigned = 0
    bad: list[str] = []
    for ev in q.order_by(AuditEvent.created_at, AuditEvent.audit_id).yield_per(500):
        total += 1
        if not ev.signature:
            unsigned += 1
        elif verify_audit_event(ev):
            valid += 1
        elif len(bad) < sample_limit:
            bad.append(ev.audit_id)
    return {"total": total, "valid": valid, "unsigned": unsigned, "invalid": total - valid - unsigned, "invalid_audit_ids": bad}


def record_read(db: Session, trace_id: str | None, actor_id: str | None, action: str, *, case_id: str | None = None,
                target_kind: str | None = None, target_id: str | None = None, detail: dict | None = None,
                search: str | None = None, sensitive: bool = False) -> None:
    """Audit a read-only view. Criticality (docs/AUDIT_LOG_POLICY.md section 2):
      - a search, or a view marked `sensitive` (case-contents views), is FAIL-CLOSED: it is committed before the data
        is returned, and if the record cannot be written the request fails;
      - other list and summary views are BEST-EFFORT: a failed write is logged and the view is still served.
    A search is logged as a digest and length (request_context.search_fingerprint), never as the text searched."""
    body = dict(detail or {})
    if search is not None:
        body.update(request_context.search_fingerprint(search))
    if search is not None or sensitive:
        record_audit(db, trace_id, actor_id, action, target_kind, target_id, case_id, detail=body)
        db.commit()
    else:
        record_audit_best_effort(db, trace_id, actor_id, action, target_kind, target_id, case_id, detail=body)
