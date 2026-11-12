"""DRISHTI-NET prototype API. All routes live under /api/v1; the built React app is served from / when present."""
from __future__ import annotations

import logging
import time
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import OperationalError
from sqlalchemy.exc import TimeoutError as SATimeoutError
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import config
from .core import diagnostics, request_context
from .core.exceptions import DristiBaseError
from .core.logging import configure_logging
from .db import engine, init_db
# Import integrity service before init_db so LedgerAnchor is registered with Base.metadata
from .services import integrity as _integrity_svc  # noqa: F401 (side-effect: table registration)
from .routes import (audit_routes, auth_routes, case_routes, demo_routes, evidence_routes, graph_routes, integrity_routes,
                     diagnostics_routes, masking_routes, notification_routes, override_routes, report_routes, review_routes,
                     upload_policy_routes, user_request_routes)
from .services import neo4j_store, ratelimit

configure_logging()
logger = logging.getLogger("drishti.startup")
access_log = logging.getLogger("drishti.http")
if config.DB_POOL_SIZE + config.DB_MAX_OVERFLOW < config.THREADPOOL_SIZE:
    logger.warning("database pool (%d) is smaller than the worker-thread pool (%d): requests can deadlock waiting for "
                   "connections under load; raise DRISHTI_DB_POOL_SIZE/DRISHTI_DB_MAX_OVERFLOW",
                   config.DB_POOL_SIZE + config.DB_MAX_OVERFLOW, config.THREADPOOL_SIZE)
if not config.REDIS_URL:
    # Login lockout and API ceilings are then per-process: fine for one instance, but several instances
    # would each allow the full limit. Multi-instance deployments must set DRISHTI_REDIS_URL.
    logger.warning("DRISHTI_REDIS_URL is not set: rate-limit counters are per-process, not shared across instances")

init_db()
try:
    from .services.upload_policy import cleanup_stale_staging
    cleanup_stale_staging()  # staging files left by a process that died mid-upload
except OSError as exc:
    logger.warning("could not clean the upload staging area: %s", exc)
if neo4j_store.available():
    try:
        neo4j_store.apply_constraints()
    except Exception as exc:
        # Found by failure-injection testing (TASK_BOARD.md Phase 8): a Neo4j outage at boot used to crash
        # the whole process here, taking down login/cases/every other route along with it -- even though
        # Neo4j is documented elsewhere as an optional, degradable dependency (services/graph.py falls back
        # to an in-process build when it's unreachable per-request). Failing to apply constraints at boot
        # must not be fatal to a service that otherwise works without them. Known limitation: there is no
        # automatic retry -- if Neo4j was down at boot, constraints stay unapplied until the next process
        # restart finds it reachable (a manual `pass # neo4j_store.apply_constraints()` call, or a restart, fixes
        # it); this only affects uniqueness/index enforcement inside Neo4j, not read/write availability.
        logger.warning("Neo4j constraints not applied at startup, continuing without them: %s", exc)

app = FastAPI(title="DRISHTI-NET prototype API", version="0.1.0",
              description="Evidence-linked relationship discovery for authorized human review. Synthetic data only. The system proposes; the investigator decides.")


@app.on_event("startup")
async def _size_threadpool() -> None:
    """Pin the worker-thread pool to THREADPOOL_SIZE so it matches the database pool sizing (config.py)."""
    from anyio.to_thread import current_default_thread_limiter

    current_default_thread_limiter().total_tokens = config.THREADPOOL_SIZE


# DoS layer, per client IP: every /api/v1 request, authenticated or not, counts against one ceiling.
# Defined before trace_middleware so that, being added later, trace_middleware wraps this one and the
# 429 below still carries X-Trace-Id. Health probes are exempt so orchestration checks are never throttled.
_RATE_LIMIT_EXEMPT = {"/api/v1/health", "/api/v1/ready"}


@app.middleware("http")
async def api_ip_rate_limit_middleware(request: Request, call_next):
    path = request.url.path
    if path.startswith("/api/v1/") and path not in _RATE_LIMIT_EXEMPT:
        decision = ratelimit.hit(f"drishti:rl:ip:{ratelimit.client_ip(request)}", config.API_IP_RATE_PER_MIN, 60)
        if not decision.allowed:
            return JSONResponse(status_code=429, content={"detail": "Too many requests from this address; try again shortly"},
                                headers={"Retry-After": str(decision.retry_after)})
    return await call_next(request)


@app.middleware("http")
async def trace_middleware(request: Request, call_next):
    """Creates the per-request audit context. The request ID is server-generated: a client-supplied X-Trace-Id is
    ignored, because it was previously written verbatim into the audit trail. A client's X-Correlation-Id is kept
    only when it matches a safe pattern. The client IP comes from ratelimit.client_ip (trusted proxies only)."""
    ctx = request_context.begin(request_context.RequestContext(
        request_id=request_context.new_request_id(),
        correlation_id=request_context.sanitize_correlation(request.headers.get("x-correlation-id")),
        client_ip=ratelimit.client_ip(request),
        user_agent=request_context.sanitize_user_agent(request.headers.get("user-agent")),
        method=request.method,
        path=request.url.path,
    ))
    request.state.trace_id = ctx.request_id
    started = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        # Unhandled errors are turned into a JSON 500 by unhandled_error() below; record the timing here too.
        _log_request(request, 500, started, ctx.request_id)
        raise
    _log_request(request, response.status_code, started, ctx.request_id)
    response.headers["X-Trace-Id"] = ctx.request_id
    response.headers["X-Request-Id"] = ctx.request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    if request.url.path.startswith("/api/"):
        # Case data, revealed values and audit records must not be kept by browsers or intermediate caches.
        response.headers["Cache-Control"] = "no-store"
        response.headers["Pragma"] = "no-cache"
    return response


def _log_request(request: Request, status_code: int, started: float, request_id: str) -> None:
    """One structured line per request (method, path, status, duration, request ID); slow ones at WARNING."""
    duration_ms = (time.perf_counter() - started) * 1000
    path = request.url.path
    diagnostics.record(request.method, path, status_code, duration_ms, request_id, config.SLOW_REQUEST_MS)
    if path.startswith("/api/"):
        level = logging.WARNING if (status_code >= 500 or duration_ms >= config.SLOW_REQUEST_MS) else logging.INFO
        access_log.log(level, "%s %s -> %s in %.0f ms", request.method, path, status_code, duration_ms,
                       extra={"trace_id": request_id, "action": "HTTP", "outcome": status_code, "resource": path})


def error_body(request: Request, status_code: int, detail, code: str, **extra) -> JSONResponse:
    """The one error envelope every handler uses: {detail, code, request_id}. `detail` keeps its earlier meaning (a
    message, or the 422 list), so existing clients still read it; `code` is stable for programs; `request_id` matches
    the X-Request-Id header and the audit and log records (docs/TROUBLESHOOTING.md)."""
    rid = getattr(request.state, "trace_id", None)
    headers = extra.pop("headers", None) or {}
    if rid:
        headers.setdefault("X-Request-Id", rid)
        headers.setdefault("X-Trace-Id", rid)
    return JSONResponse(status_code=status_code, headers=headers,
                        content={"detail": detail, "code": code, "request_id": rid, "trace_id": rid, **extra})


_HTTP_CODES = {400: "BAD_REQUEST", 401: "UNAUTHENTICATED", 403: "FORBIDDEN", 404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED",
               409: "CONFLICT", 411: "LENGTH_REQUIRED", 413: "TOO_LARGE", 415: "UNSUPPORTED_MEDIA_TYPE", 422: "INVALID_REQUEST",
               429: "RATE_LIMITED", 503: "UNAVAILABLE", 507: "INSUFFICIENT_STORAGE"}


@app.exception_handler(StarletteHTTPException)
async def http_error(request: Request, exc: StarletteHTTPException):
    # An exception may carry its own stable code (services/user_requests.RequestError); otherwise one per status.
    code = getattr(exc, "code", None) or _HTTP_CODES.get(exc.status_code, f"HTTP_{exc.status_code}")
    return error_body(request, exc.status_code, exc.detail, code, headers=dict(exc.headers or {}))


@app.exception_handler(DristiBaseError)
async def domain_error_handler(request: Request, exc: DristiBaseError):
    """Domain exceptions (docs/engineering/ERROR_HANDLING_STANDARD.md). The nested "error" object is kept for existing
    clients; detail/code/request_id give it the same top-level shape as every other error."""
    rid = getattr(request.state, "trace_id", None)
    return error_body(request, exc.http_status, exc.safe_message(), exc.code,
                      error={"code": exc.code, "message": exc.safe_message(), "trace_id": rid, "details": exc.detail})


@app.exception_handler(SATimeoutError)
async def pool_timeout(request: Request, exc: SATimeoutError):
    """No database connection became free within DB_POOL_TIMEOUT_S: the service is saturated. A retryable 503 with
    Retry-After, instead of the earlier 30 s hang and HTTP 500."""
    diagnostics.note_error_code("DB_POOL_TIMEOUT")
    logger.warning("database pool exhausted on %s %s", request.method, request.url.path)
    return error_body(request, 503, "The service is busy. Please try again in a few seconds.", "BUSY", headers={"Retry-After": "5"})


@app.exception_handler(OperationalError)
async def database_unavailable(request: Request, exc: OperationalError):
    diagnostics.note_error_code("DB_UNAVAILABLE")
    logger.error("database unavailable on %s %s: %s", request.method, request.url.path, type(exc.orig).__name__ if exc.orig else "")
    return error_body(request, 503, "The database is temporarily unavailable. Please try again shortly.", "DB_UNAVAILABLE",
                      headers={"Retry-After": "10"})


@app.exception_handler(Exception)
async def unhandled_error(request: Request, exc: Exception):
    """Anything unexpected: a JSON 500 with the request ID (never a stack trace or internal message)."""
    diagnostics.note_error_code("INTERNAL")
    logger.exception("unhandled error on %s %s (request %s)", request.method, request.url.path, getattr(request.state, "trace_id", "-"))
    return error_body(request, 500, "An unexpected error occurred. Quote the request ID if you report it.", "INTERNAL")


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    """422 without the rejected values. FastAPI's default repeats each rejected `input` (and `ctx`), which sent an
    over-long login password straight back in the response body. Location, message and type are enough to fix a
    request; the value itself is never needed and may be a password, token or personal identifier."""
    errors = [{"loc": list(e.get("loc", ())), "msg": e.get("msg", ""), "type": e.get("type", "")} for e in exc.errors()]
    return error_body(request, 422, errors, "INVALID_REQUEST")


@app.exception_handler(ValueError)
async def value_error(request: Request, exc: ValueError):
    # SEC-07: every current `raise ValueError(...)` site in the route/service layer (storage.py,
    # integrity.py, pipeline.py, extract_document.py) uses a deliberately caller-safe message, so
    # echoing it back here is intentional, not an oversight -- it's how those validation failures
    # are surfaced (e.g. "evidence X is Y; extraction requires ACCEPTED"). Logged here too so an
    # unexpected ValueError from somewhere that was never meant to be caller-facing is still caught
    # and visible server-side, not just silently echoed. Any new ValueError raise site must keep its
    # message safe to show an API caller -- never include a path, a stack detail, or a secret.
    logger.warning("ValueError on %s %s: %s", request.method, request.url.path, exc)
    return error_body(request, 409, str(exc), "CONFLICT")


@app.get("/api/v1/health")
def health():
    return {"status": "ok", "scanner_mode": config.SCANNER_MODE, "graph_bounds": {"max_hops": config.GRAPH_MAX_HOPS, "max_nodes": config.GRAPH_MAX_NODES},
            # DEF-074: backend kind only -- this endpoint is unauthenticated and used to return the absolute path.
            "storage": "s3" if config.S3_ENDPOINT_URL else "local", "database": config.DATABASE_URL.split("://")[0],
            "graph_store": "neo4j" if neo4j_store.available() else "in-process"}


@app.get("/api/v1/ready")
def ready():
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            conn.execute(text("select 1"))
        if neo4j_store.available():
            neo4j_store.driver().verify_connectivity()
    except Exception as exc:
        # DEF-074: never echo driver errors (hosts, users, auth failures) to an unauthenticated caller.
        logger.warning("readiness check failed: %s", exc)
        raise HTTPException(503, "Service unavailable: a required dependency is not reachable")
    return {"ready": True}


routers = [auth_routes, case_routes, evidence_routes, review_routes, graph_routes, audit_routes, report_routes, integrity_routes,
           masking_routes, override_routes, upload_policy_routes, diagnostics_routes,
           user_request_routes, notification_routes]
if config.DATABASE_URL.startswith("sqlite"):
    routers.append(demo_routes)

for r in routers:
    app.include_router(r.router, prefix="/api/v1")

def safe_dist_file(dist: Path, path: str) -> Path | None:
    """Return the file under `dist` that `path` names, or None if it is missing or outside `dist`.

    The path parameter arrives percent-decoded, so `/%2e%2e/%2e%2e/.env` reaches here as `../../.env`.
    Before 2026-11-01 (DEF-028) the fallback joined it onto WEB_DIST unchecked and served any readable
    file on the host -- `.env` (JWT signing key), the SQLite database, stored evidence. Resolving both
    sides and requiring containment also rejects symlinks inside dist that point outside it.
    """
    if not path:
        return None
    root = dist.resolve()
    try:
        target = (root / path).resolve()
    except (OSError, RuntimeError, ValueError):
        return None
    if not target.is_relative_to(root) or not target.is_file():
        return None
    return target


class ImmutableAssets(StaticFiles):
    """Hashed build assets never change under the same name, so they may be cached for a year."""

    def file_response(self, *args, **kwargs):
        response = super().file_response(*args, **kwargs)
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response


# The app shell must be revalidated on every load: without Cache-Control a browser may reuse a heuristically cached
# index.html that names JS files removed by a later deploy (a blank page). Not reproduced in testing, so this is
# hardening, not a confirmed cause (docs/TROUBLESHOOTING.md).
_SHELL_HEADERS = {"Cache-Control": "no-cache"}

if config.WEB_DIST.exists():
    app.mount("/assets", ImmutableAssets(directory=config.WEB_DIST / "assets"), name="assets")

    @app.api_route("/{path:path}", methods=["GET", "HEAD"], include_in_schema=False)
    def spa(path: str):
        # HEAD is accepted so uptime monitors can probe the site (it returned 405 before).
        if path.startswith("api/"):  # unknown API paths must 404, never fall through to the app shell
            raise HTTPException(404, "not found")
        target = safe_dist_file(config.WEB_DIST, path)
        if target is not None:
            return FileResponse(target, headers=None if target.name != "index.html" else _SHELL_HEADERS)
        return FileResponse(config.WEB_DIST / "index.html", headers=_SHELL_HEADERS)
