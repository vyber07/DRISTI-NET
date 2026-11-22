"""Process-level diagnostics: request outcomes, slow requests, recent server errors, pool and thread-pool state.

Fed by the request-log middleware in main.py; read by GET /api/v1/diagnostics (routes/diagnostics_routes.py). Holds no
request bodies, tokens or personal data: only method, route path, status, duration and the server request ID.
"""
from __future__ import annotations

import datetime
import threading
import time
from collections import Counter, deque

STARTED = time.time()
_lock = threading.Lock()
status_classes: Counter = Counter()
error_codes: Counter = Counter()
slow_requests = 0
total_requests = 0
recent_errors: deque = deque(maxlen=50)   # newest last: 5xx and pool/database failures, for troubleshooting


def record(method: str, path: str, status: int, duration_ms: float, request_id: str, slow_ms: int) -> None:
    global slow_requests, total_requests
    with _lock:
        total_requests += 1
        status_classes[f"{status // 100}xx"] += 1
        if duration_ms >= slow_ms:
            slow_requests += 1
        if status >= 500:
            recent_errors.append({"at": datetime.datetime.utcnow().isoformat() + "Z", "method": method, "path": path[:200],
                                  "status": status, "duration_ms": round(duration_ms), "request_id": request_id})


def note_error_code(code: str) -> None:
    with _lock:
        error_codes[code] += 1


def pool_status(engine) -> dict:
    pool = engine.pool
    out = {"class": type(pool).__name__}
    for name in ("size", "checkedin", "checkedout", "overflow"):
        fn = getattr(pool, name, None)
        if callable(fn):
            try:
                out[name] = fn()
            except Exception:  # pragma: no cover - pool implementations differ
                pass
    out["max_overflow"] = getattr(pool, "_max_overflow", None)
    out["timeout_s"] = getattr(pool, "_timeout", None)
    return out


def threadpool_status() -> dict:
    try:
        from anyio.to_thread import current_default_thread_limiter

        lim = current_default_thread_limiter()
        return {"total": lim.total_tokens, "in_use": lim.borrowed_tokens}
    except Exception:  # outside an event loop
        return {}


def snapshot() -> dict:
    with _lock:
        return {"uptime_s": round(time.time() - STARTED), "requests": total_requests, "by_status": dict(status_classes),
                "slow_requests": slow_requests, "error_codes": dict(error_codes), "recent_server_errors": list(recent_errors)}
