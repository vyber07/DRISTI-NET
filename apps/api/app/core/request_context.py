"""Request-scoped context for audit records, and the sanitisers that keep secrets out of the log.

The middleware in main.py creates one RequestContext per HTTP request and stores it in a context variable. The
object is mutable and shared by reference, so dependencies that run in worker threads (for example
auth.current_user) can fill in the authenticated actor, session and office, and the audit writer
(services/audit.py) still sees them. Only server-side or verified values are placed here:

  request_id      server-generated for every request. A client-supplied X-Trace-Id is NOT trusted (it was
                  previously used verbatim, which let callers write arbitrary values into the audit trail).
  correlation_id  the client's X-Correlation-Id, kept only when it matches CORRELATION_RE. It is a hint for
                  joining logs across systems, never used for access decisions.
  client_ip       from services/ratelimit.client_ip(): honours X-Forwarded-For only from a trusted proxy.
  user_agent      sanitised (no control characters, truncated).
  user_id, username, role, office_id, session_id   from the database row of the authenticated user and
                  the server-side session. Never from request headers.
"""
from __future__ import annotations

import contextvars
import hashlib
import re
import secrets
from dataclasses import dataclass, field

CORRELATION_RE = re.compile(r"^[A-Za-z0-9._:-]{8,64}$")
_CONTROL_RE = re.compile(r"[\x00-\x1f\x7f-\x9f]")
_SECRET_KEY_RE = re.compile(
    # "hash" is deliberately absent: evidence SHA-256 values are integrity facts the audit trail must keep.
    r"password|passwd|pwd|secret|token|authorization|api[_-]?key|credential|cookie|private|session_key",
    re.IGNORECASE,
)
_JWT_RE = re.compile(r"eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}")
USER_AGENT_MAX = 256
STRING_MAX = 512
FAILURE_REASON_MAX = 200
REDACTED = "[REDACTED]"


@dataclass
class RequestContext:
    request_id: str
    correlation_id: str | None = None
    client_ip: str | None = None
    user_agent: str | None = None
    method: str = ""
    path: str = ""
    user_id: str | None = None
    username: str | None = None
    role: str | None = None
    office_id: str | None = None
    session_id: str | None = None
    # Per-request memo for expensive lookups (e.g. a case's raw personal values for snippet redaction). Lives and
    # dies with the request; never shared between requests or users.
    cache: dict = field(default_factory=dict)


_current: contextvars.ContextVar[RequestContext | None] = contextvars.ContextVar("drishti_request_context", default=None)


def new_request_id() -> str:
    return f"REQ-{secrets.token_hex(12)}"


def begin(ctx: RequestContext) -> RequestContext:
    _current.set(ctx)
    return ctx


def current() -> RequestContext | None:
    return _current.get()


def set_actor(user, session_id: str | None) -> None:
    """Record the authenticated actor from the database row. Called after a successful login and by current_user."""
    ctx = _current.get()
    if ctx is None:
        return
    ctx.user_id = user.user_id
    ctx.username = user.username
    ctx.role = user.role
    ctx.office_id = getattr(user, "office_id", None)
    ctx.session_id = session_id


def sanitize_user_agent(raw: str | None) -> str | None:
    if not raw:
        return None
    cleaned = " ".join(_CONTROL_RE.sub(" ", raw).split())
    return cleaned[:USER_AGENT_MAX] or None


def sanitize_correlation(raw: str | None) -> str | None:
    if raw and CORRELATION_RE.match(raw):
        return raw
    return None


def sanitize_failure_reason(raw: str | None) -> str | None:
    if not raw:
        return None
    return _CONTROL_RE.sub(" ", str(raw))[:FAILURE_REASON_MAX]


def search_fingerprint(query: str | None) -> dict:
    """Log that a search happened without logging what was searched: a digest and the length. Search text in an
    investigation can name people, so the text itself is not stored."""
    if not query:
        return {}
    normalised = " ".join(query.lower().split())
    return {"search_sha256": hashlib.sha256(normalised.encode("utf-8")).hexdigest()[:16], "search_length": len(query)}


def sanitize_detail(value, depth: int = 0):
    """Return a copy of an audit detail that cannot carry secrets: values under secret-looking keys are replaced,
    JWT-shaped strings are replaced, long strings are truncated, and nesting and list length are bounded.
    Callers must still avoid passing evidence contents; this is a backstop, not the primary control."""
    if depth > 5:
        return "[TRUNCATED]"
    if isinstance(value, dict):
        out = {}
        for key, item in value.items():
            key_text = str(key)[:64]
            out[key_text] = REDACTED if _SECRET_KEY_RE.search(key_text) else sanitize_detail(item, depth + 1)
        return out
    if isinstance(value, (list, tuple)):
        return [sanitize_detail(item, depth + 1) for item in list(value)[:100]]
    if isinstance(value, str):
        if _JWT_RE.search(value):
            return REDACTED
        text = _CONTROL_RE.sub(" ", value)
        return text[:STRING_MAX] + ("...[TRUNCATED]" if len(text) > STRING_MAX else "")
    if value is None or isinstance(value, (bool, int, float)):
        return value
    return sanitize_detail(str(value), depth + 1)
