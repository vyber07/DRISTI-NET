"""Redis-backed login-throttle counters.

Scope, deliberately narrow (TASK_BOARD.md Phase 4 / directive Sec.64 -- justify before adding tech):
`/auth/login` had no brute-force protection at all. This module adds exactly one thing: a per-username
failed-attempt counter with a TTL window. It is the only Redis use in this codebase. A job-status cache
was considered and rejected -- Postgres/SQLite already owns `Job` rows cheaply, so caching it in Redis
would duplicate a source of truth without a demonstrated need.

Fails OPEN: if Redis is configured but unreachable, login proceeds without throttling rather than
locking every user out over an optional hardening layer going down. That degradation is never silent --
`is_login_throttled` raises `RateLimiterUnavailable` so the caller (routes/auth_routes.py) can audit it.
The write-path helpers (`record_failed_login`, `clear_login_throttle`) swallow the same failure instead
of raising, because a lost counter update must not turn into a 500 on every login attempt.
"""
from __future__ import annotations

import redis

from .. import config

_client: redis.Redis | None = None
_client_url: str | None = None


class RateLimiterUnavailable(Exception):
    """Redis is configured (DRISHTI_REDIS_URL set) but not reachable right now."""


def _get_client() -> redis.Redis:
    global _client, _client_url
    if not config.REDIS_URL:
        raise RateLimiterUnavailable("DRISHTI_REDIS_URL not configured")
    if _client is None or _client_url != config.REDIS_URL:
        _client = redis.from_url(config.REDIS_URL, socket_connect_timeout=0.3, socket_timeout=0.3)
        _client_url = config.REDIS_URL
    return _client


def _key(username: str) -> str:
    return f"drishti:login_fail:{username}"


def is_login_throttled(username: str) -> bool:
    """True if this username has hit the failed-attempt ceiling.

    Raises RateLimiterUnavailable if Redis is configured but unreachable -- callers must handle
    this explicitly (fail open + audit), never swallow it silently.
    """
    client = _get_client()
    try:
        count = client.get(_key(username))
    except redis.RedisError as exc:
        raise RateLimiterUnavailable(str(exc)) from exc
    return count is not None and int(count) >= config.LOGIN_THROTTLE_MAX_ATTEMPTS


def record_failed_login(username: str) -> None:
    """Best-effort increment. Degrades silently (no throttle recorded) if Redis is unreachable --
    the read-path failure is what gets audited, not every write."""
    if not config.REDIS_URL:
        return
    try:
        client = _get_client()
        key = _key(username)
        pipe = client.pipeline()
        pipe.incr(key)
        pipe.expire(key, config.LOGIN_THROTTLE_WINDOW_S)
        pipe.execute()
    except (RateLimiterUnavailable, redis.RedisError):
        return


def clear_login_throttle(username: str) -> None:
    if not config.REDIS_URL:
        return
    try:
        _get_client().delete(_key(username))
    except (RateLimiterUnavailable, redis.RedisError):
        return
