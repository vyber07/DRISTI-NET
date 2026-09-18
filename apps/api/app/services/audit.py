from __future__ import annotations

from sqlalchemy.orm import Session

from ..models import AuditEvent

import hmac
import hashlib
import json
from .. import config

# P1-3: Key rotation strategy
# We prepend the key_id and algorithm to the signature.
# Format: "key_id:algorithm:hmac_hex"
CURRENT_AUDIT_KEY_ID = "k1-2026"

def _compute_hmac(key_bytes: bytes, ev: AuditEvent) -> str:
    # P1-2: Include audit_id and created_at
    # Ensure created_at has a canonical string representation (e.g. isoformat)
    # Note: When initially created, ev.created_at might be None because it's a default=utcnow.
    # We must assign it explicitly before signing.
    if ev.created_at is None:
        from ..models import utcnow
        ev.created_at = utcnow()
    
    # We must also ensure audit_id is assigned (it usually has a default).
    if ev.audit_id is None:
        from ..models import new_id
        ev.audit_id = new_id("AUD")

    dt = ev.created_at
    if dt.tzinfo is None:
        import datetime
        dt = dt.replace(tzinfo=datetime.timezone.utc)
    dt_str = dt.isoformat()
    payload = f"{ev.audit_id}|{ev.trace_id}|{ev.actor_id or ''}|{ev.action}|{ev.target_kind or ''}|{ev.target_id or ''}|{ev.case_id or ''}|{ev.outcome}|{dt_str}|{json.dumps(ev.detail, sort_keys=True)}"
    return hmac.new(key_bytes, payload.encode('utf-8'), hashlib.sha256).hexdigest()

def sign_audit_event(ev: AuditEvent) -> str:
    key_bytes = config.AUDIT_KEYS[config.CURRENT_AUDIT_KEY_ID].encode('utf-8')
    sig_hex = _compute_hmac(key_bytes, ev)
    return f"{config.CURRENT_AUDIT_KEY_ID}:hmac-sha256:{sig_hex}"

# P1-1: Add HMAC verification
def verify_audit_event(ev: AuditEvent) -> bool:
    if not ev.signature:
        return False # Legacy or missing
    
    parts = ev.signature.split(":")
    if len(parts) != 3:
        return False
    
    key_id, algo, sig_hex = parts
    
    # Check the key registry
    if key_id not in config.AUDIT_KEYS:
        # Cannot verify with unknown key
        return False
        
    if algo != "hmac-sha256":
        return False
        
    key_bytes = config.AUDIT_KEYS[key_id].encode('utf-8')
    expected_hex = _compute_hmac(key_bytes, ev)
    return hmac.compare_digest(expected_hex, sig_hex)

def record_audit(db: Session, trace_id: str, actor_id: str | None, action: str, target_kind: str | None = None,
                 target_id: str | None = None, case_id: str | None = None, outcome: str = "OK", detail: dict | None = None) -> AuditEvent:
    ev = AuditEvent(trace_id=trace_id, actor_id=actor_id, action=action, target_kind=target_kind,
                    target_id=target_id, case_id=case_id, outcome=outcome, detail=detail or {})
    # Initialize defaults so we can sign them
    from ..models import new_id, utcnow
    ev.audit_id = new_id("AUD")
    ev.created_at = utcnow()
    
    ev.signature = sign_audit_event(ev)
    db.add(ev)
    return ev
