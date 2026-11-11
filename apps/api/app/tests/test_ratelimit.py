"""Rate limiting and brute-force protection, tested through the real HTTP routes.

Nothing is mocked at the storage layer. The Redis-backed tests run against a real redis-server when one is
reachable (DRISHTI_TEST_REDIS_URL, default 127.0.0.1:6379) and are skipped, not faked, when it is not.
The unreachable-Redis test proves the fallback: counting continues in-process and nothing fails open.
"""
import os
from types import SimpleNamespace

import pytest

from apps.api.app import config
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
    # Every test starts from the default configuration (no Redis) unless it opts in explicitly.
    monkeypatch.setattr(config, "REDIS_URL", "")
    monkeypatch.setattr(ratelimit, "_redis_down_until", 0.0)


def _req(host, forwarded_for=None):
    headers = {"x-forwarded-for": forwarded_for} if forwarded_for is not None else {}
    return SimpleNamespace(client=SimpleNamespace(host=host), headers=headers)


def _login(client, username, password, ip="198.51.100.10"):
    return client.post("/api/v1/auth/login", json={"username": username, "password": password},
                       headers={"X-Test-IP": ip})


@pytest.fixture
def per_test_ip(monkeypatch):
    """Let a test choose the client IP per request via an X-Test-IP header (the TestClient peer is always one host)."""
    original = ratelimit.client_ip

    def fake(request):
        return request.headers.get("x-test-ip") or original(request)

    monkeypatch.setattr(ratelimit, "client_ip", fake)


# ------------------------------------------------------------------ client address
def test_forwarded_for_ignored_from_untrusted_peer():
    assert ratelimit.client_ip(_req("203.0.113.9", "1.2.3.4")) == "203.0.113.9"


def test_forwarded_for_honoured_from_trusted_proxy_and_spoofed_prefix_ignored():
    # nginx appends the real client address to whatever the caller sent, so the rightmost untrusted hop wins.
    req = _req("172.18.0.5", "9.9.9.9, 198.51.100.7")
    assert ratelimit.client_ip(req) == "198.51.100.7"


def test_malformed_rightmost_hop_from_trusted_proxy_falls_back_to_peer():
    # The rightmost hop is the one the trusted proxy itself appended; if it is garbage, the chain is not trusted.
    assert ratelimit.client_ip(_req("127.0.0.1", "198.51.100.7, not-an-ip")) == "127.0.0.1"


def test_malformed_entry_left_of_real_client_is_ignored():
    assert ratelimit.client_ip(_req("127.0.0.1", "not-an-ip, 198.51.100.7")) == "198.51.100.7"


# ------------------------------------------------------------------ account-type policy
def test_policy_is_per_role_with_default_for_unknown_and_other_roles():
    assert ratelimit.user_policy("ADMIN") == (3, 30 * 60)
    assert ratelimit.user_policy("AUDITOR") == (3, 30 * 60)
    assert ratelimit.user_policy("INVESTIGATOR") == ratelimit.user_policy(None)
    assert ratelimit.user_policy(None) == (config.LOGIN_THROTTLE_MAX_ATTEMPTS, config.LOGIN_THROTTLE_WINDOW_S)


def test_admin_locked_after_three_failures_investigator_after_five(client, per_test_ip):
    for _ in range(3):
        assert _login(client, "admin", "wrong").status_code == 401
    blocked = _login(client, "admin", "admin-demo")  # correct password still blocked while locked
    assert blocked.status_code == 429
    assert blocked.headers["Retry-After"] == str(30 * 60)

    for _ in range(5):
        assert _login(client, "investigator", "wrong", ip="198.51.100.11").status_code == 401
    assert _login(client, "investigator", "investigator-demo", ip="198.51.100.11").status_code == 429


def test_unknown_username_gets_default_policy_not_a_distinct_response(client, per_test_ip):
    statuses = [_login(client, "no-such-user", "x", ip="198.51.100.12").status_code for _ in range(config.LOGIN_THROTTLE_MAX_ATTEMPTS)]
    assert statuses == [401] * config.LOGIN_THROTTLE_MAX_ATTEMPTS
    assert _login(client, "no-such-user", "x", ip="198.51.100.12").status_code == 429


# ------------------------------------------------------------------ per-IP spraying defence
def test_password_spraying_across_usernames_hits_the_ip_ceiling(client, per_test_ip, monkeypatch):
    monkeypatch.setattr(config, "LOGIN_IP_MAX_FAILURES", 4)
    ip = "203.0.113.50"
    for name in ("u1", "u2", "u3", "u4"):  # each username stays far below its own ceiling
        assert _login(client, name, "wrong", ip=ip).status_code == 401
    # The attacker's source is now blocked for every account, including one that has never failed.
    assert _login(client, "investigator", "investigator-demo", ip=ip).status_code == 429
    # A different source is unaffected.
    assert _login(client, "investigator", "investigator-demo", ip="203.0.113.51").status_code == 200


def test_successful_login_resets_username_counter_but_not_ip_counter(client, per_test_ip, monkeypatch):
    monkeypatch.setattr(config, "LOGIN_IP_MAX_FAILURES", 3)
    ip = "203.0.113.60"
    assert _login(client, "investigator", "wrong", ip=ip).status_code == 401
    assert _login(client, "investigator", "wrong", ip=ip).status_code == 401
    assert _login(client, "investigator", "investigator-demo", ip=ip).status_code == 200  # clears the username counter
    # Interleaving a success must not reset the source's failure count: the third failure from this IP is still counted.
    assert _login(client, "auditor", "wrong", ip=ip).status_code == 401
    assert _login(client, "reviewer", "wrong", ip=ip).status_code == 429


# ------------------------------------------------------------------ Redis outage: fall back, never fail open
def test_unreachable_redis_still_throttles_and_reports_degraded(client, per_test_ip, monkeypatch):
    monkeypatch.setattr(config, "REDIS_URL", UNREACHABLE_REDIS)
    for _ in range(config.LOGIN_THROTTLE_MAX_ATTEMPTS):
        assert _login(client, "reviewer", "wrong", ip="198.51.100.20").status_code == 401
    assert _login(client, "reviewer", "wrong", ip="198.51.100.20").status_code == 429
    assert ratelimit.degraded()


def test_unreachable_redis_helpers_do_not_raise(monkeypatch):
    monkeypatch.setattr(config, "REDIS_URL", UNREACHABLE_REDIS)
    assert ratelimit.hit("drishti:test:unreachable", 2, 60).allowed
    assert ratelimit.hit("drishti:test:unreachable", 2, 60).allowed
    assert not ratelimit.hit("drishti:test:unreachable", 2, 60).allowed


# ------------------------------------------------------------------ general API (DoS) layer
def test_api_ip_ceiling_returns_429_with_retry_after_and_exempts_health(client, per_test_ip, monkeypatch):
    monkeypatch.setattr(config, "API_IP_RATE_PER_MIN", 3)
    ip = {"X-Test-IP": "203.0.113.70"}
    for _ in range(3):
        assert client.get("/api/v1/auth/me", headers=ip).status_code == 401
    limited = client.get("/api/v1/auth/me", headers=ip)
    assert limited.status_code == 429
    assert limited.headers["Retry-After"] == "60"
    assert limited.headers.get("X-Trace-Id")  # trace id still attached to rate-limited responses
    assert client.get("/api/v1/health", headers=ip).status_code == 200


def test_authenticated_user_limit_depends_on_role(client, per_test_ip, monkeypatch):
    monkeypatch.setattr(config, "API_USER_RATE_PER_MIN_BY_ROLE", {"DEFAULT": 2, "ADMIN": 4})
    investigator = _login(client, "investigator", "investigator-demo").json()["token"]
    admin = _login(client, "admin", "admin-demo", ip="198.51.100.31").json()["token"]

    def me(token):
        return client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}", "X-Test-IP": "198.51.100.30"})

    assert [me(investigator).status_code for _ in range(2)] == [200, 200]
    limited = me(investigator)
    assert limited.status_code == 429 and limited.headers["Retry-After"] == "60"

    assert [me(admin).status_code for _ in range(4)] == [200] * 4
    assert me(admin).status_code == 429


# ------------------------------------------------------------------ real Redis
@pytest.mark.skipif(not _HAS_REDIS, reason=f"no redis-server reachable at {REAL_REDIS}")
def test_real_redis_counter_window_and_clear(monkeypatch):
    monkeypatch.setattr(config, "REDIS_URL", REAL_REDIS)
    key = "drishti:test:window"
    ratelimit.delete(key)
    assert ratelimit.incr(key, 60) == 1
    assert ratelimit.incr(key, 60) == 2
    assert ratelimit.count(key) == 2
    import redis

    assert 0 < redis.from_url(REAL_REDIS).ttl(key) <= 60  # window set once, on the first increment
    ratelimit.delete(key)
    assert ratelimit.count(key) == 0
    assert not ratelimit.degraded()


@pytest.mark.skipif(not _HAS_REDIS, reason=f"no redis-server reachable at {REAL_REDIS}")
def test_login_endpoint_returns_429_with_real_redis(client, per_test_ip, monkeypatch):
    monkeypatch.setattr(config, "REDIS_URL", REAL_REDIS)
    ratelimit.clear_login_failures("auditor")
    try:
        for _ in range(3):  # AUDITOR policy: 3 failures
            assert _login(client, "auditor", "wrong", ip="198.51.100.40").status_code == 401
        blocked = _login(client, "auditor", "auditor-demo", ip="198.51.100.40")
        assert blocked.status_code == 429  # correct password blocked while throttled
        assert not ratelimit.degraded()
    finally:
        ratelimit.clear_login_failures("auditor")
