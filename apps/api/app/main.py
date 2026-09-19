"""DRISHTI-NET prototype API. All routes live under /api/v1; the built React app is served from / when present."""
from __future__ import annotations

import logging
import uuid

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import config
from .db import engine, init_db
# Import integrity service before init_db so LedgerAnchor is registered with Base.metadata
from .services import integrity as _integrity_svc  # noqa: F401 (side-effect: table registration)
from .routes import audit_routes, auth_routes, case_routes, demo_routes, evidence_routes, graph_routes, integrity_routes, report_routes, review_routes
from .services import neo4j_store

logger = logging.getLogger("drishti.startup")

init_db()
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


@app.middleware("http")
async def trace_middleware(request: Request, call_next):
    request.state.trace_id = request.headers.get("X-Trace-Id") or f"TRC-{uuid.uuid4().hex[:12]}"
    response = await call_next(request)
    response.headers["X-Trace-Id"] = request.state.trace_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.exception_handler(ValueError)
async def value_error(request: Request, exc: ValueError):
    return JSONResponse(status_code=409, content={"detail": str(exc), "trace_id": request.state.trace_id})


@app.get("/api/v1/health")
def health():
    return {"status": "ok", "scanner_mode": config.SCANNER_MODE, "graph_bounds": {"max_hops": config.GRAPH_MAX_HOPS, "max_nodes": config.GRAPH_MAX_NODES},
            "storage": str(config.STORAGE_ROOT), "database": config.DATABASE_URL.split("://")[0],
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
        raise HTTPException(503, f"Service unavailable: {exc}")
    return {"ready": True}


routers = [auth_routes, case_routes, evidence_routes, review_routes, graph_routes, audit_routes, report_routes, integrity_routes]
if config.DATABASE_URL.startswith("sqlite"):
    routers.append(demo_routes)

for r in routers:
    app.include_router(r.router, prefix="/api/v1")

if config.WEB_DIST.exists():
    app.mount("/assets", StaticFiles(directory=config.WEB_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/"):  # unknown API paths must 404, never fall through to the app shell
            raise HTTPException(404, "not found")
        target = config.WEB_DIST / path
        if path and target.is_file():
            return FileResponse(target)
        return FileResponse(config.WEB_DIST / "index.html")
# trigger rebuild
