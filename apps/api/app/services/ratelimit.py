"""Rate limiting and brute-force protection.

Three layers, all built on one counter primitive (`incr` / `count` / `delete`):

1. Login, per username, by account type (role): failed attempts are counted and the account is locked out
   for the role's window once the ceiling is reached (config.LOGIN_THROTTLE_POLICY_BY_ROLE).
2. Login, per client IP across all usernames: defeats password spraying (config.LOGIN_IP_MAX_FAILURES).
3. General API (DoS layer): requests per client IP for every /api/v1 route (middleware in main.py), and
   requests per user by role after the token is verified (auth.current_user).

Storage: Redis when DRISHTI_REDIS_URL is set and reachable -- shared by every API process. If Redis is
configured but unreachable, the counters fall back to per-process memory. The limits therefore keep
working during a Redis outage; they are only weaker in that each worker counts on its own. This replaces
the earlier fail-open behaviour, which removed all brute-force protection whenever Redis was down.

Client IP: `client_ip()` honours X-Forwarded-For only when the direct peer is a trusted proxy
(config.TRUSTED_PROXIES), and walks the chain from the right, so a caller cannot spoof its address.
"""
from __future__ import annotations

import functools
import hashlib
import ipaddress
import threading
import time
from dataclasses import dataclass

import redis

from .. import config

REDIS_RETRY_COOLDOWN_S = 5.0
_MEM_PRUNE_AT = 10_000

_client: redis.Redis | None = None
_client_url: str | None = None
_redis_down_until = 0.0
_mem: dict[str, tuple[int, float]] = {}  # key -> (count, expires at monotonic time)
_mem_lock = threading.Lock()


@dataclass(frozen=True)
class Decision:
    allowed: bool
    retry_after: int  # seconds; 0 when allowed
    degraded: bool    # True when Redis is configured but not in use, so counters are per-process


# ------------------------------------------------------------------ storage backends
def _redis() -> redis.Redis | None:
    """The Redis client, or None when Redis is not configured or is inside its post-failure cooldown."""
    global _client, _client_url
    if not config.REDIS_URL or time.monotonic() < _redis_down_until:
        return None
    if _client is None or _client_url != config.REDIS_URL:
        _client = redis.from_url(config.REDIS_URL, socket_connect_timeout=0.3, socket_timeout=0.3)
        _client_url = config.REDIS_URL
    return _client


def _redis_failed() -> None:
    global _redis_down_until
    _redis_down_until = time.monotonic() + REDIS_RETRY_COOLDOWN_S


def degraded() -> bool:
    """True when Redis is configured but currently unusable -- counters are then process-local."""
    return bool(config.REDIS_URL) and time.monotonic() < _redis_down_until


def _mem_count(key: str) -> int:
    now = time.monotonic()
    with _mem_lock:
        entry = _mem.get(key)
        if entry is None or entry[1] <= now:
            return 0
        return entry[0]


def _mem_incr(key: str, window: int) -> int:
    now = time.monotonic()
    with _mem_lock:
        entry = _mem.get(key)
        if entry is None or entry[1] <= now:
            entry = (0, now + window)
        count = entry[0] + 1
        _mem[key] = (count, entry[1])
        if len(_mem) > _MEM_PRUNE_AT:
            for k in [k for k, (_, exp) in _mem.items() if exp <= now]:
                del _mem[k]
        return count


def incr(key: str, window: int) -> int:
    """Increment a fixed-window counter and return its new value. The window starts at the first increment."""
    client = _redis()
    if client is not None:
        try:
            pipe = client.pipeline()
            pipe.incr(key)
            pipe.expire(key, window, nx=True)
            count, _ = pipe.execute()
            return int(count)
        except redis.RedisError:
            _redis_failed()
    return _mem_incr(key, window)


def count(key: str) -> int:
    client = _redis()
    if client is not None:
        try:
            return int(client.get(key) or 0)
        except redis.RedisError:
            _redis_failed()
    return _mem_count(key)


def delete(key: str) -> None:
    client = _redis()
    if client is not None:
        try:
            client.delete(key)
        except redis.RedisError:
            _redis_failed()
    with _mem_lock:
        _mem.pop(key, None)


def reset_memory() -> None:
    """Clear process-local counters (used by tests)."""
    with _mem_lock:
        _mem.clear()


# ------------------------------------------------------------------ generic limit
def hit(key: str, limit: int, window: int) -> Decision:
    """Count one request against `limit` per `window` seconds and report whether it is allowed."""
    n = incr(key, window)
    allowed = n <= limit
    return Decision(allowed=allowed, retry_after=0 if allowed else window, degraded=degraded())


# ------------------------------------------------------------------ login
def _digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8", "replace")).hexdigest()


def _user_key(username: str) -> str:
    return f"drishti:login_fail:user:{_digest(username)}"


def _ip_key(ip: str) -> str:
    return f"drishti:login_fail:ip:{_digest(ip)}"


def user_policy(role: str | None) -> tuple[int, int]:
    """(max failed attempts, window seconds) for an account of this role. Unknown usernames get DEFAULT."""
    policy = config.LOGIN_THROTTLE_POLICY_BY_ROLE
    return policy.get(role or "DEFAULT", policy["DEFAULT"])


def login_retry_after(username: str, ip: str, role: str | None) -> int:
    """Seconds the caller must wait before another attempt, or 0 when the attempt may proceed."""
    max_user, window_user = user_policy(role)
    if count(_user_key(username)) >= max_user:
        return window_user
    if count(_ip_key(ip)) >= config.LOGIN_IP_MAX_FAILURES:
        return config.LOGIN_IP_WINDOW_S
    return 0


def record_login_failure(username: str, ip: str, role: str | None) -> None:
    _, window_user = user_policy(role)
    incr(_user_key(username), window_user)
    incr(_ip_key(ip), config.LOGIN_IP_WINDOW_S)


def clear_login_failures(username: str) -> None:
    """Called after a successful login. Clears only the username counter; the per-IP counter stays, so an
    attacker cannot reset it by interleaving a login to an account they control."""
    delete(_user_key(username))


# ------------------------------------------------------------------ client address
@functools.lru_cache(maxsize=8)
def _networks(spec: tuple[str, ...]) -> tuple:
    return tuple(ipaddress.ip_network(s, strict=False) for s in spec)


def _parse_ip(text: str):
    try:
        return ipaddress.ip_address(text.strip())
    except ValueError:
        return None


def client_ip(request) -> str:
    peer = request.client.host if request.client else "unknown"
    nets = _networks(tuple(config.TRUSTED_PROXIES))
    peer_ip = _parse_ip(peer)
    if peer_ip is None or not any(peer_ip in n for n in nets):
        return peer  # not behind a trusted proxy: the socket peer is the client
    hops = [h for h in request.headers.get("x-forwarded-for", "").split(",") if h.strip()]
    for hop in reversed(hops):
        ip = _parse_ip(hop)
        if ip is None:
            return peer  # malformed chain from a trusted proxy: ignore it
        if not any(ip in n for n in nets):
            return str(ip)  # rightmost untrusted hop = the real client
    return str(_parse_ip(hops[0])) if hops and _parse_ip(hops[0]) else peer
