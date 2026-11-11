"""Login rate limiting, account lockout, recovery, enumeration resistance and proxy handling.

Exercised through the real HTTP routes and the real database. Redis-backed tests run against a real
redis-server when one is reachable (DRISHTI_TEST_REDIS_URL, default 127.0.0.1:6379) and are skipped, not
faked, otherwise. The unreachable-Redis test proves the fallback: enforcement continues in-process.

Scenarios: brute-force simulation, distributed attempts, account enumeration, lockout abuse, legitimate-user
recovery (expiry, admin unlock, password reset, operator CLI), proxy-header spoofing, concurrent requests,
input bounds, and that passwords never reach the audit log.
"""
import os
import threading
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from apps.api.app import config, unlock_cli
from apps.api.app.db import SessionLocal
from apps.api.app.main import app
from apps.api.app.models import AuditEvent, User
from apps.api.app.routes import auth_routes
from apps.api.app.services import ratelimit

REAL_REDIS = os.environ.get("DRISHTI_TEST_REDIS_URL", "redis://127.0.0.1:6379/0")
UNREACHABLE_REDIS = "redis://127.0.0.1:1/0"


def _redis_reachable(url: str) -> bool:
    import redis

    try:
        redis.from_url(url, socket_connect_timeout=0.2, socket_timeout=0.2).ping()
        return True
    except Exception:
        return False


_HAS_REDIS = _redis_reachable(REAL_REDIS)


@pytest.fixture(autouse=True)
def _no_redis_by_default(monkeypatch):
    monkeypatch.setattr(config, "REDIS_URL", "")
    monkeypatch.setattr(ratelimit, "_redis_down_until", 0.0)


@pytest.fixture
def per_test_ip(monkeypatch):
    """Choose the client IP per request with an X-Test-IP header (the TestClient peer is always one host)."""
    original = ratelimit.client_ip

    def fake(request):
        return request.headers.get("x-test-ip") or original(request)

    monkeypatch.setattr(ratelimit, "client_ip", fake)


def _login(client, username, password, ip="198.51.100.10", headers=None):
    h = {"X-Test-IP": ip, **(headers or {})}
    return client.post("/api/v1/auth/login", json={"username": username, "password": password}, headers=h)


def _admin_token(client):
    return _login(client, "admin", "admin-demo", ip="198.51.100.1").json()["token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _user_id(username):
    with SessionLocal() as db:
        return db.query(User).filter_by(username=username).one().user_id


def _distributed_failures(client, username, sources):
    """One wrong guess from each of `sources` distinct IPs."""
    return [_login(client, username, "wrong", ip=f"203.0.113.{i}").status_code for i in range(1, sources + 1)]


def _redis_clear(username):
    gen = ratelimit._generation(username)
    for key in (ratelimit._level_key(username), ratelimit._lock_key(username, gen)):
        ratelimit.delete(key)


# ------------------------------------------------------------------ client address and proxy-header spoofing
def test_forwarded_for_ignored_from_untrusted_peer():
    req = SimpleNamespace(client=SimpleNamespace(host="203.0.113.9"), headers={"x-forwarded-for": "1.2.3.4"})
    assert ratelimit.client_ip(req) == "203.0.113.9"


def test_forwarded_for_honoured_from_trusted_proxy_and_spoofed_prefix_ignored():
    # nginx appends the real client address to whatever the caller sent: the rightmost untrusted hop wins.
    req = SimpleNamespace(client=SimpleNamespace(host="172.18.0.5"), headers={"x-forwarded-for": "9.9.9.9, 198.51.100.7"})
    assert ratelimit.client_ip(req) == "198.51.100.7"


def test_malformed_rightmost_hop_from_trusted_proxy_falls_back_to_peer():
    req = SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"), headers={"x-forwarded-for": "198.51.100.7, not-an-ip"})
    assert ratelimit.client_ip(req) == "127.0.0.1"


def test_malformed_entry_left_of_real_client_is_ignored():
    req = SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"), headers={"x-forwarded-for": "not-an-ip, 198.51.100.7"})
    assert ratelimit.client_ip(req) == "198.51.100.7"


def test_header_spoofing_from_direct_caller_cannot_rotate_identity(client, monkeypatch):
    """A direct (untrusted) caller rotating X-Forwarded-For on every request is still one source."""
    monkeypatch.setattr(config, "TRUSTED_PROXIES", ["172.16.0.0/12"])  # testclient peer is not in this range
    limit = ratelimit.user_policy("INVESTIGATOR")[0]
    statuses = []
    for i in range(limit + 2):
        r = client.post("/api/v1/auth/login", json={"username": "reviewer", "password": "wrong"},
                        headers={"X-Forwarded-For": f"198.51.100.{i + 1}"})
        statuses.append(r.status_code)
    assert statuses[:limit] == [401] * limit
    assert statuses[limit:] == [429] * 2


def test_trusted_proxy_chain_is_honoured_end_to_end(monkeypatch):
    """Through the real client_ip(): a trusted peer's chain identifies the real client, so each real client has its own pair."""
    proxy_client = TestClient(app, client=("172.18.0.5", 4000))
    limit = ratelimit.user_policy("INVESTIGATOR")[0]
    for _ in range(limit):
        r = proxy_client.post("/api/v1/auth/login", json={"username": "reviewer", "password": "wrong"},
                              headers={"X-Forwarded-For": "198.51.100.77"})
        assert r.status_code == 401
    assert proxy_client.post("/api/v1/auth/login", json={"username": "reviewer", "password": "wrong"},
                             headers={"X-Forwarded-For": "198.51.100.77"}).status_code == 429
    other = proxy_client.post("/api/v1/auth/login", json={"username": "reviewer", "password": "wrong"},
                              headers={"X-Forwarded-For": "198.51.100.78"})
    assert other.status_code == 401  # a different real client behind the same proxy is not locked


# ------------------------------------------------------------------ policy and brute-force simulation
def test_policy_values_by_account_type():
    assert ratelimit.user_policy("ADMIN") == (3, 30 * 60)
    assert ratelimit.user_policy("AUDITOR") == (3, 30 * 60)
    assert ratelimit.user_policy("INVESTIGATOR") == ratelimit.user_policy(None)
    assert ratelimit.account_source_limit("ADMIN") == 5
    assert ratelimit.account_source_limit("INVESTIGATOR") == 10


def test_brute_force_from_one_source_stops_at_policy_limit_and_never_hashes_more(client, per_test_ip, monkeypatch):
    """200 guesses from one source against ADMIN: exactly 3 password checks run, then every attempt is refused
    before hashing -- including the correct password."""
    calls = []
    real = auth_routes.verify_password

    def counting(password, stored):
        calls.append(password)
        return real(password, stored)

    monkeypatch.setattr(auth_routes, "verify_password", counting)
    statuses = [_login(client, "admin", f"guess-{i}", ip="198.51.100.50").status_code for i in range(200)]
    assert statuses[:3] == [401, 401, 401]
    assert set(statuses[3:]) == {429}
    assert len(calls) == 3
    blocked = _login(client, "admin", "admin-demo", ip="198.51.100.50")
    assert blocked.status_code == 429 and blocked.headers["Retry-After"] == "1800"
    assert len(calls) == 3


def test_investigator_pair_limit_then_block(client, per_test_ip):
    for _ in range(5):
        assert _login(client, "investigator", "wrong", ip="198.51.100.11").status_code == 401
    assert _login(client, "investigator", "investigator-demo", ip="198.51.100.11").status_code == 429


# ------------------------------------------------------------------ distributed attempts
def test_distributed_guessing_locks_the_account_for_all_sources(client, per_test_ip):
    statuses = _distributed_failures(client, "reviewer", ratelimit.account_source_limit("REVIEWER"))
    assert statuses == [401] * len(statuses)  # each source made one guess, under every ceiling
    # The account lock is now active: a brand-new source is refused, even with the correct password.
    denied = _login(client, "reviewer", "reviewer-demo", ip="198.51.100.90")
    assert denied.status_code == 429
    assert denied.headers["Retry-After"] == str(config.LOGIN_ACCOUNT_LOCK_BASE_S)
    status = client.get(f"/api/v1/users/{_user_id('reviewer')}/login-status", headers=_auth(_admin_token(client)))
    assert status.json()["locked"] is True and status.json()["escalation_level"] == 1


def test_distributed_guessing_below_source_limit_does_not_lock(client, per_test_ip):
    limit = ratelimit.account_source_limit("REVIEWER")
    _distributed_failures(client, "analyst", limit - 1)
    assert _login(client, "analyst", "analyst-demo", ip="198.51.100.91").status_code == 200


def test_lock_escalates_on_repeat(client, per_test_ip, monkeypatch):
    admin = _admin_token(client)
    _distributed_failures(client, "analyst", ratelimit.account_source_limit("ANALYST"))
    assert client.post(f"/api/v1/users/{_user_id('analyst')}/unlock", headers=_auth(admin)).status_code == 200
    _distributed_failures(client, "analyst", ratelimit.account_source_limit("ANALYST"))
    status = client.get(f"/api/v1/users/{_user_id('analyst')}/login-status", headers=_auth(admin)).json()
    assert status["escalation_level"] == 2
    assert _login(client, "analyst", "analyst-demo", ip="198.51.100.92").headers["Retry-After"] == str(2 * config.LOGIN_ACCOUNT_LOCK_BASE_S)


# ------------------------------------------------------------------ lockout abuse (must not be easy)
def test_single_source_cannot_lock_a_victim_out(client, per_test_ip):
    """One attacker IP makes 60 guesses against a victim: the victim, from their own IP, still signs in."""
    for _ in range(60):
        _login(client, "investigator", "wrong", ip="198.51.100.200")
    assert _login(client, "investigator", "investigator-demo", ip="198.51.100.201").status_code == 200
    status = client.get(f"/api/v1/users/{_user_id('investigator')}/login-status",
                        headers=_auth(_admin_token(client))).json()
    assert status["locked"] is False and status["distinct_failing_sources"] == 1


def test_victim_own_failures_do_not_lock_out_others(client, per_test_ip):
    """A success from one source clears that source's pair counter only; other sources keep their own state."""
    for _ in range(4):
        _login(client, "reviewer", "wrong", ip="198.51.100.210")
    assert _login(client, "reviewer", "reviewer-demo", ip="198.51.100.210").status_code == 200
    assert _login(client, "reviewer", "wrong", ip="198.51.100.210").status_code == 401  # counter restarted from zero


# ------------------------------------------------------------------ account enumeration
def test_unknown_and_wrong_password_responses_are_identical(client, per_test_ip):
    known = _login(client, "reviewer", "wrong-password", ip="198.51.100.220")
    unknown = _login(client, "no-such-person", "wrong-password", ip="198.51.100.221")
    assert known.status_code == unknown.status_code == 401
    assert known.json() == unknown.json()


def test_locked_responses_are_identical_for_known_and_unknown(client, per_test_ip):
    _distributed_failures(client, "reviewer", ratelimit.account_source_limit("REVIEWER"))
    known = _login(client, "reviewer", "x", ip="198.51.100.230")
    # Unknown names are locked by the same counters once they receive the same guesses, so the responses match.
    for i in range(ratelimit.account_source_limit("DEFAULT")):
        _login(client, "nobody-here", "x", ip=f"203.0.113.{120 + i}")
    unknown = _login(client, "nobody-here", "x", ip="198.51.100.231")
    assert known.status_code == unknown.status_code == 429
    assert known.json() == unknown.json()


def test_inactive_account_gives_the_same_answer_as_wrong_password(client, per_test_ip):
    admin = _admin_token(client)
    created = client.post("/api/v1/users", headers=_auth(admin), json={
        "username": "enum-dormant", "display_name": "Dormant User", "role": "REVIEWER",
        "jurisdiction": "Demo District A", "password": "dormant-pass-1"})
    assert created.status_code == 201
    client.post(f"/api/v1/users/{created.json()['user_id']}/deactivate", headers=_auth(admin))
    inactive = _login(client, "enum-dormant", "dormant-pass-1", ip="198.51.100.240")
    wrong = _login(client, "reviewer", "wrong-password", ip="198.51.100.241")
    assert inactive.status_code == wrong.status_code == 401
    assert inactive.json() == wrong.json()


def test_unknown_username_pays_the_same_hashing_cost(client, per_test_ip, monkeypatch):
    dummy_calls = []
    real = auth_routes.verify_absent_user

    def counting(password):
        dummy_calls.append(password)
        return real(password)

    monkeypatch.setattr(auth_routes, "verify_absent_user", counting)
    _login(client, "definitely-not-a-user", "pw", ip="198.51.100.250")
    assert len(dummy_calls) == 1  # a real username would run verify_password here instead


# ------------------------------------------------------------------ input bounds
def test_oversized_password_rejected_before_hashing(client, per_test_ip, monkeypatch):
    calls = []
    monkeypatch.setattr(auth_routes, "verify_password", lambda *a: calls.append(a) or False)
    r = _login(client, "reviewer", "x" * (config.LOGIN_PASSWORD_MAX_LEN + 1), ip="198.51.100.260")
    assert r.status_code == 422 and calls == []


def test_empty_or_oversized_username_rejected(client, per_test_ip):
    assert _login(client, "", "pw", ip="198.51.100.261").status_code == 422
    assert _login(client, "u" * (config.LOGIN_USERNAME_MAX_LEN + 1), "pw", ip="198.51.100.262").status_code == 422


# ------------------------------------------------------------------ legitimate-user recovery
def test_lock_expires_and_the_legitimate_user_recovers(client, per_test_ip, monkeypatch):
    monkeypatch.setattr(config, "LOGIN_ACCOUNT_LOCK_BASE_S", 1)
    _distributed_failures(client, "reviewer", ratelimit.account_source_limit("REVIEWER"))
    assert _login(client, "reviewer", "reviewer-demo", ip="198.51.100.270").status_code == 429
    import time

    time.sleep(1.2)
    assert _login(client, "reviewer", "reviewer-demo", ip="198.51.100.270").status_code == 200


def test_admin_unlock_restores_access_and_is_audited(client, per_test_ip):
    admin = _admin_token(client)
    _distributed_failures(client, "reviewer", ratelimit.account_source_limit("REVIEWER"))
    assert _login(client, "reviewer", "reviewer-demo", ip="198.51.100.280").status_code == 429
    unlock = client.post(f"/api/v1/users/{_user_id('reviewer')}/unlock", headers=_auth(admin))
    assert unlock.status_code == 200 and unlock.json()["was_locked"] is True
    assert _login(client, "reviewer", "reviewer-demo", ip="198.51.100.280").status_code == 200
    with SessionLocal() as db:
        events = db.query(AuditEvent).filter_by(action="USER_UNLOCK", target_id=_user_id("reviewer")).all()
        assert events and events[-1].detail["was_locked"] is True


def test_unlock_requires_admin(client, per_test_ip):
    investigator = _login(client, "investigator", "investigator-demo", ip="198.51.100.290").json()["token"]
    r = client.post(f"/api/v1/users/{_user_id('reviewer')}/unlock", headers=_auth(investigator))
    assert r.status_code == 403
    assert client.get(f"/api/v1/users/{_user_id('reviewer')}/login-status", headers=_auth(investigator)).status_code == 403


def test_password_reset_also_clears_the_lock(client, per_test_ip):
    # A dedicated account: this test changes a password, and the database is shared across the session.
    admin = _admin_token(client)
    created = client.post("/api/v1/users", headers=_auth(admin), json={
        "username": "reset-target", "display_name": "Reset Target", "role": "REVIEWER",
        "jurisdiction": "Demo District A", "password": "reset-target-1"})
    assert created.status_code == 201
    target_id = created.json()["user_id"]
    _distributed_failures(client, "reset-target", ratelimit.account_source_limit("REVIEWER"))
    assert _login(client, "reset-target", "reset-target-1", ip="198.51.100.300").status_code == 429
    reset = client.post(f"/api/v1/users/{target_id}/reset-password", headers=_auth(admin),
                        json={"new_password": "reset-target-2"})
    assert reset.status_code == 200
    assert _login(client, "reset-target", "reset-target-2", ip="198.51.100.300").status_code == 200
    assert _login(client, "reset-target", "reset-target-1", ip="198.51.100.300").status_code == 401  # old password gone


def test_operator_cli_unlock(client, per_test_ip, capsys):
    _distributed_failures(client, "reviewer", ratelimit.account_source_limit("REVIEWER"))
    assert _login(client, "reviewer", "reviewer-demo", ip="198.51.100.310").status_code == 429
    assert unlock_cli.main(["reviewer"]) == 0
    assert "unlocked reviewer (was_locked=True)" in capsys.readouterr().out
    assert _login(client, "reviewer", "reviewer-demo", ip="198.51.100.310").status_code == 200
    assert unlock_cli.main(["no-such-user"]) == 1


# ------------------------------------------------------------------ concurrency
def test_concurrent_attempts_never_exceed_the_pair_limit():
    """Service level, many threads at once: the reservation makes the granted count exact, not 'limit + threads'."""
    for _ in range(5):
        ratelimit.reset_memory()
        granted = []
        lock = threading.Lock()

        def attempt():
            res = ratelimit.begin_attempt("concurrent-target", "198.51.100.320", "ADMIN")
            if isinstance(res, ratelimit.Attempt):
                with lock:
                    granted.append(1)
                ratelimit.finish_attempt(res, success=False)

        with ThreadPoolExecutor(max_workers=40) as pool:
            for _ in range(40):
                pool.submit(attempt)
        assert len(granted) == ratelimit.user_policy("ADMIN")[0]
        assert ratelimit.count(ratelimit._pair_key("concurrent-target", ratelimit._generation("concurrent-target"),
                                                   "198.51.100.320")) == len(granted)


def test_concurrent_http_logins_respect_the_limit(monkeypatch, per_test_ip):
    """HTTP level: concurrent wrong-password logins from one source against one account."""
    limit = ratelimit.user_policy("INVESTIGATOR")[0]

    def one(_):
        c = TestClient(app)
        return _login(c, "investigator", "wrong", ip="198.51.100.330").status_code

    with ThreadPoolExecutor(max_workers=12) as pool:
        codes = list(pool.map(one, range(12)))
    assert codes.count(401) == limit
    assert codes.count(429) == 12 - limit


# ------------------------------------------------------------------ audit hygiene
def test_passwords_never_reach_the_audit_log(client, per_test_ip):
    secret = "SentinelPassword-7f3a9c"
    _login(client, "reviewer", secret, ip="198.51.100.340")
    with SessionLocal() as db:
        rows = db.query(AuditEvent).filter(AuditEvent.action == "LOGIN").all()
        assert rows, "failed logins must be audited"
        for row in rows:
            assert secret not in str(row.detail) and secret not in str(row.target_id)


def test_denials_are_audited_with_scope_and_source(client, per_test_ip):
    _distributed_failures(client, "reviewer", ratelimit.account_source_limit("REVIEWER"))
    _login(client, "reviewer", "x", ip="198.51.100.350")
    with SessionLocal() as db:
        lock_events = db.query(AuditEvent).filter_by(action="ACCOUNT_LOCKED").all()
        denied = db.query(AuditEvent).filter_by(action="LOGIN", outcome="DENIED").filter(
            AuditEvent.detail["scope"].as_string() == "account_lock").all()
        assert lock_events and lock_events[-1].detail["escalation_level"] >= 1
        assert denied and denied[-1].detail["ip"] == "198.51.100.350"


# ------------------------------------------------------------------ Redis: shared state, outage fallback
def test_unreachable_redis_still_enforces_and_reports_degraded(client, per_test_ip, monkeypatch):
    monkeypatch.setattr(config, "REDIS_URL", UNREACHABLE_REDIS)
    for _ in range(5):
        assert _login(client, "reviewer", "wrong", ip="198.51.100.360").status_code == 401
    assert _login(client, "reviewer", "wrong", ip="198.51.100.360").status_code == 429
    assert ratelimit.degraded()


def test_unreachable_redis_helpers_do_not_raise(monkeypatch):
    monkeypatch.setattr(config, "REDIS_URL", UNREACHABLE_REDIS)
    assert ratelimit.hit("drishti:test:unreachable", 2, 60).allowed
    assert ratelimit.hit("drishti:test:unreachable", 2, 60).allowed
    assert not ratelimit.hit("drishti:test:unreachable", 2, 60).allowed


@pytest.mark.skipif(not _HAS_REDIS, reason=f"no redis-server reachable at {REAL_REDIS}")
def test_real_redis_counter_window_and_clear(monkeypatch):
    monkeypatch.setattr(config, "REDIS_URL", REAL_REDIS)
    key = "drishti:test:window"
    ratelimit.delete(key)
    assert ratelimit.incr(key, 60) == 1
    assert ratelimit.incr(key, 60) == 2
    assert ratelimit.count(key) == 2
    import redis

    assert 0 < redis.from_url(REAL_REDIS).ttl(key) <= 60
    ratelimit.delete(key)
    assert ratelimit.count(key) == 0
    assert not ratelimit.degraded()


@pytest.mark.skipif(not _HAS_REDIS, reason=f"no redis-server reachable at {REAL_REDIS}")
def test_two_instances_share_redis_state(monkeypatch):
    """Instance A records failures; instance B (a fresh client, as in another process) sees them and refuses."""
    monkeypatch.setattr(config, "REDIS_URL", REAL_REDIS)
    user = "shared-state-user"
    _redis_clear(user)
    try:
        for _ in range(ratelimit.user_policy("INVESTIGATOR")[0]):
            res = ratelimit.begin_attempt(user, "198.51.100.370", "INVESTIGATOR")
            assert isinstance(res, ratelimit.Attempt)
            ratelimit.finish_attempt(res, success=False)
        monkeypatch.setattr(ratelimit, "_client", None)  # simulate instance B starting its own connection
        monkeypatch.setattr(ratelimit, "_client_url", None)
        denied = ratelimit.begin_attempt(user, "198.51.100.370", "INVESTIGATOR")
        assert isinstance(denied, ratelimit.Denied) and denied.scope == "pair"
    finally:
        _redis_clear(user)
        ratelimit.delete(ratelimit._pair_key(user, ratelimit._generation(user), "198.51.100.370"))


@pytest.mark.skipif(not _HAS_REDIS, reason=f"no redis-server reachable at {REAL_REDIS}")
def test_real_redis_account_lock_via_http(client, per_test_ip, monkeypatch):
    monkeypatch.setattr(config, "REDIS_URL", REAL_REDIS)
    _redis_clear("auditor")
    try:
        _distributed_failures(client, "auditor", ratelimit.account_source_limit("AUDITOR"))
        assert _login(client, "auditor", "auditor-demo", ip="198.51.100.380").status_code == 429
        assert not ratelimit.degraded()
    finally:
        _redis_clear("auditor")
        client.post(f"/api/v1/users/{_user_id('auditor')}/unlock", headers=_auth(_admin_token(client)))


# ------------------------------------------------------------------ general API (DoS) layer
def test_api_ip_ceiling_returns_429_with_retry_after_and_exempts_health(client, per_test_ip, monkeypatch):
    monkeypatch.setattr(config, "API_IP_RATE_PER_MIN", 3)
    ip = {"X-Test-IP": "203.0.113.70"}
    for _ in range(3):
        assert client.get("/api/v1/auth/me", headers=ip).status_code == 401
    limited = client.get("/api/v1/auth/me", headers=ip)
    assert limited.status_code == 429
    assert limited.headers["Retry-After"] == "60"
    assert limited.headers.get("X-Trace-Id")
    assert client.get("/api/v1/health", headers=ip).status_code == 200


def test_authenticated_user_limit_depends_on_role(client, per_test_ip, monkeypatch):
    monkeypatch.setattr(config, "API_USER_RATE_PER_MIN_BY_ROLE", {"DEFAULT": 2, "ADMIN": 4})
    investigator = _login(client, "investigator", "investigator-demo").json()["token"]
    admin = _login(client, "admin", "admin-demo", ip="198.51.100.31").json()["token"]

    def me(token):
        return client.get("/api/v1/auth/me", headers={**_auth(token), "X-Test-IP": "198.51.100.30"})

    assert [me(investigator).status_code for _ in range(2)] == [200, 200]
    limited = me(investigator)
    assert limited.status_code == 429 and limited.headers["Retry-After"] == "60"
    assert [me(admin).status_code for _ in range(4)] == [200] * 4
    assert me(admin).status_code == 429
