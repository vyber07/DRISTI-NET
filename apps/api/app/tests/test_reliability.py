"""'Failed to fetch' / page-failure fixes (docs/TROUBLESHOOTING.md, ADR-017).

- one error envelope {detail, code, request_id} for every error, matching the X-Request-Id header;
- a saturated pool or unavailable database answers a retryable 503 with Retry-After, never a 30 s hang + 500;
- the auth dependencies give their connection back before the endpoint runs (the root cause of the deadlock);
- the pool is at least as large as the worker-thread pool;
- /diagnostics is ADMIN/AUDITOR only and audited;
- hashed assets are served immutable.
"""
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError
from sqlalchemy.exc import TimeoutError as SATimeoutError
from sqlalchemy.orm import Session

from apps.api.app import config
from apps.api.app.auth import current_user, require_roles
from apps.api.app.db import SessionLocal, engine, get_db
from apps.api.app.main import ImmutableAssets, app
from apps.api.app.models import AuditEvent, User


def _envelope_ok(r, status, code):
    body = r.json()
    assert r.status_code == status, r.text
    assert body["code"] == code
    assert "detail" in body
    assert body["request_id"] and body["request_id"] == r.headers["X-Request-Id"]
    return body


def test_not_found_uses_the_envelope(client, investigator):
    _envelope_ok(client.get("/api/v1/no-such-endpoint", headers=investigator), 404, "NOT_FOUND")


def test_unauthenticated_uses_the_envelope(client):
    _envelope_ok(client.get("/api/v1/cases"), 401, "UNAUTHENTICATED")


def test_validation_error_uses_the_envelope_without_echoing_input(client):
    secret = "x" * 5000
    r = client.post("/api/v1/auth/login", json={"username": "investigator", "password": secret})
    body = _envelope_ok(r, 422, "INVALID_REQUEST")
    assert isinstance(body["detail"], list)
    assert secret not in r.text


def _raising_db(exc):
    async def dep():
        raise exc
        yield  # pragma: no cover
    return dep


@pytest.mark.parametrize("exc, code, retry_after", [
    (SATimeoutError("QueuePool limit of size 5 overflow 10 reached"), "BUSY", "5"),
    (OperationalError("select 1", {}, Exception("connection refused")), "DB_UNAVAILABLE", "10"),
])
def test_database_saturation_or_outage_is_a_retryable_503(client, investigator, exc, code, retry_after):
    app.dependency_overrides[get_db] = _raising_db(exc)
    try:
        r = client.get("/api/v1/cases", headers=investigator)
    finally:
        app.dependency_overrides.pop(get_db, None)
    body = _envelope_ok(r, 503, code)
    assert r.headers["Retry-After"] == retry_after
    assert "QueuePool" not in body["detail"] and "refused" not in body["detail"]  # no internals to the caller


def test_unhandled_error_is_a_json_500_without_internals(investigator):
    app.dependency_overrides[get_db] = _raising_db(RuntimeError("internal secret detail /srv/path"))
    try:
        r = TestClient(app, raise_server_exceptions=False).get("/api/v1/cases", headers=investigator)
    finally:
        app.dependency_overrides.pop(get_db, None)
    _envelope_ok(r, 500, "INTERNAL")
    assert "secret" not in r.text and "/srv/path" not in r.text


def _probe_route(path, dependency):
    def probe(user: User = Depends(dependency), db: Session = Depends(get_db, scope="function")):
        # The same session the auth dependency used; it must hold no connection when the endpoint starts.
        return {"in_transaction": db.in_transaction(), "user": user.username}
    app.add_api_route(path, probe, methods=["GET"])
    route = app.router.routes.pop()
    app.router.routes.insert(0, route)  # ahead of the SPA catch-all
    return route


@pytest.mark.parametrize("dependency", [current_user, require_roles("INVESTIGATOR", action="listAnchors")])
def test_auth_dependencies_release_their_connection_before_the_endpoint(client, investigator, dependency):
    route = _probe_route("/api/v1/_test/connection-probe", dependency)
    try:
        r = client.get("/api/v1/_test/connection-probe", headers=investigator)
    finally:
        app.router.routes.remove(route)
    assert r.status_code == 200, r.text
    assert r.json() == {"in_transaction": False, "user": "investigator"}


def test_pool_is_at_least_as_large_as_the_worker_thread_pool():
    assert config.DB_POOL_SIZE + config.DB_MAX_OVERFLOW >= config.THREADPOOL_SIZE
    if not config.DATABASE_URL.startswith("sqlite"):
        assert engine.pool.size() == config.DB_POOL_SIZE
        assert engine.pool._max_overflow == config.DB_MAX_OVERFLOW
        assert engine.pool._timeout == config.DB_POOL_TIMEOUT_S


def test_diagnostics_is_admin_and_auditor_only_and_audited(client, admin, auditor, investigator, reviewer):
    for headers in (investigator, reviewer):
        _envelope_ok(client.get("/api/v1/diagnostics", headers=headers), 403, "FORBIDDEN")
    for headers in (admin, auditor):
        r = client.get("/api/v1/diagnostics", headers=headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["checks"]["database"]["ok"] is True
        assert body["database_pool"]["configured_capacity"] == config.DB_POOL_SIZE + config.DB_MAX_OVERFLOW
        assert set(body["process"]) >= {"uptime_s", "requests", "by_status", "slow_requests", "recent_server_errors"}
        assert "Authorization" not in r.text and "Bearer" not in r.text
    with SessionLocal() as db:
        assert db.query(AuditEvent).filter(AuditEvent.action == "DIAGNOSTICS_VIEW").count() >= 2


def test_diagnostics_records_server_errors_with_their_request_id(client, admin, investigator):
    app.dependency_overrides[get_db] = _raising_db(SATimeoutError("pool"))
    try:
        rid = client.get("/api/v1/cases", headers=investigator).headers["X-Request-Id"]
    finally:
        app.dependency_overrides.pop(get_db, None)
    body = client.get("/api/v1/diagnostics", headers=admin).json()
    assert any(e["request_id"] == rid and e["status"] == 503 for e in body["process"]["recent_server_errors"])
    assert body["process"]["error_codes"].get("DB_POOL_TIMEOUT", 0) >= 1


def test_hashed_assets_are_served_immutable(tmp_path):
    (tmp_path / "index-abc123.js").write_text("console.log(1)")
    mini = FastAPI()
    mini.mount("/assets", ImmutableAssets(directory=tmp_path), name="assets")
    r = TestClient(mini).get("/assets/index-abc123.js")
    assert r.status_code == 200
    assert r.headers["Cache-Control"] == "public, max-age=31536000, immutable"


@pytest.mark.skipif(not config.WEB_DIST.exists(), reason="no web build; covered by the browser verification (scenario D)")
def test_app_shell_is_revalidated_and_head_is_allowed(client):
    r = client.get("/cases")
    assert r.headers["Cache-Control"] == "no-cache"
    assert client.head("/").status_code == 200
