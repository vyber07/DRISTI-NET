"""Redis login-throttle: real service round-trip, plus the unreachable-Redis failure path.

Both are tested for real, not mocked (directive Sec.39/42 -- test real failure paths, never let a
failure silently become success):

1. Not configured (DRISHTI_REDIS_URL unset) -- the default -- is a normal disabled state, not a failure.
2. Configured and reachable -- exercised against an actual local redis-server if one is running on
   127.0.0.1:6379 (skipped, not faked, when none is available).
3. Configured but unreachable -- proves the module raises rather than pretending success, and that the
   write-path helpers degrade without raising.
"""
import os

import pytest

from apps.api.app import config
from apps.api.app.services import ratelimit

# Defaults to the zero-install local Redis; override with DRISHTI_TEST_REDIS_URL on hosts where Redis is
# only reachable by container address (e.g. a Docker Compose stack that doesn't publish 6379 to the host)
# -- without this, these two tests silently skip on such a host even though a real Redis is running.
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


def test_throttle_disabled_when_not_configured(monkeypatch):
    monkeypatch.setattr(config, "REDIS_URL", "")
    with pytest.raises(ratelimit.RateLimiterUnavailable):
        ratelimit.is_login_throttled("nobody")
    # write-path helpers no-op (not "fail") when the feature is simply off
    ratelimit.record_failed_login("nobody")
    ratelimit.clear_login_throttle("nobody")


@pytest.mark.skipif(not _HAS_REDIS, reason=f"no redis-server reachable at {REAL_REDIS}")
def test_real_redis_throttles_after_max_attempts_and_resets_on_clear(monkeypatch):
    monkeypatch.setattr(config, "REDIS_URL", REAL_REDIS)
    user = "throttle-test-user"
    ratelimit.clear_login_throttle(user)
    for _ in range(config.LOGIN_THROTTLE_MAX_ATTEMPTS):
        assert not ratelimit.is_login_throttled(user)
        ratelimit.record_failed_login(user)
    assert ratelimit.is_login_throttled(user)
    ratelimit.clear_login_throttle(user)
    assert not ratelimit.is_login_throttled(user)


def test_unreachable_redis_raises_not_silently_ok(monkeypatch):
    monkeypatch.setattr(config, "REDIS_URL", UNREACHABLE_REDIS)
    with pytest.raises(ratelimit.RateLimiterUnavailable):
        ratelimit.is_login_throttled("someone")
    # write-path helpers degrade (fail open): must not raise and must not crash the login flow
    ratelimit.record_failed_login("someone")
    ratelimit.clear_login_throttle("someone")


@pytest.mark.skipif(not _HAS_REDIS, reason=f"no redis-server reachable at {REAL_REDIS}")
def test_login_endpoint_returns_429_after_real_throttle(client, monkeypatch):
    monkeypatch.setattr(config, "REDIS_URL", REAL_REDIS)
    ratelimit.clear_login_throttle("officer")
    try:
        for _ in range(config.LOGIN_THROTTLE_MAX_ATTEMPTS):
            r = client.post("/api/v1/auth/login", json={"username": "officer", "password": "wrong"})
            assert r.status_code == 401
        r = client.post("/api/v1/auth/login", json={"username": "officer", "password": "wrong"})
        assert r.status_code == 429
        # correct password is still blocked while throttled -- this protects against credential stuffing
        r = client.post("/api/v1/auth/login", json={"username": "officer", "password": "officer-demo"})
        assert r.status_code == 429
    finally:
        ratelimit.clear_login_throttle("officer")
