"""GET /api/v1/diagnostics (ADMIN, AUDITOR): structured state for troubleshooting (docs/TROUBLESHOOTING.md).

Process uptime and request outcomes, slow-request count, recent server errors with their request IDs, database pool and
worker-thread usage, and timed checks of the database, Redis and storage. No request bodies, tokens or personal data.
"""
import os
import time

from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from .. import config
from ..auth import require_roles
from ..core import diagnostics
from ..db import engine, get_db
from ..models import User
from ..services import ratelimit, upload_policy
from ..services.audit import record_audit

router = APIRouter(tags=["diagnostics"])


def _timed(fn) -> dict:
    t0 = time.perf_counter()
    try:
        detail = fn()
        return {"ok": True, "ms": round((time.perf_counter() - t0) * 1000, 1), **({"detail": detail} if detail else {})}
    except Exception as exc:  # report, never raise: this endpoint must work when a dependency does not
        return {"ok": False, "ms": round((time.perf_counter() - t0) * 1000, 1), "error": type(exc).__name__}


def _db_check() -> None:
    with engine.connect() as conn:
        conn.execute(text("select 1"))


def _redis_check():
    if not config.REDIS_URL:
        return "not configured (per-process rate-limit counters)"
    client = ratelimit._redis()
    if client is None:
        return "configured but in cooldown after a failure"
    client.ping()
    return None


def _storage_check():
    return {"free_mb": upload_policy.disk_free_bytes() // (1024 * 1024)}


@router.get("/diagnostics")
def get_diagnostics(request: Request, user: User = Depends(require_roles("ADMIN", "AUDITOR", action="viewDiagnostics")),
                    db: Session = Depends(get_db, scope="function")):
    record_audit(db, request.state.trace_id, user.user_id, "DIAGNOSTICS_VIEW", "SYSTEM", None)
    db.commit()
    return {
        "version": os.environ.get("DRISHTI_BUILD_ID", "unknown"),
        "process": diagnostics.snapshot(),
        "database_pool": {**diagnostics.pool_status(engine), "configured_capacity": config.DB_POOL_SIZE + config.DB_MAX_OVERFLOW},
        "worker_threads": diagnostics.threadpool_status(),
        "checks": {"database": _timed(_db_check), "redis": _timed(_redis_check), "storage": _timed(_storage_check)},
        "limits": {"slow_request_ms": config.SLOW_REQUEST_MS, "db_pool_timeout_s": config.DB_POOL_TIMEOUT_S},
    }
