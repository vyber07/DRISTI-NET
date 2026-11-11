"""Rate limiting, brute-force protection and account lockout (see docs/adr/012-rate-limiting.md).

Layers:

1. Pair (username, source IP): failed logins from one source against one account. Role-based ceiling
   (config.LOGIN_THROTTLE_POLICY_BY_ROLE). This is the main brute-force control.
2. Account (username, any source): the account is temporarily locked only after failures from several
   DISTINCT source IPs (config.LOGIN_ACCOUNT_SOURCES_BY_ROLE). One source, however many guesses it makes,
   cannot lock an account for everyone else. Lock duration escalates per repeat (base x 2^(level-1), capped).
3. IP: failed logins from one source across all usernames (config.LOGIN_IP_MAX_FAILURES). Defeats spraying.
4. API (DoS): requests per IP (main.py middleware) and per user by role (auth.current_user). See `hit()`.

Concurrency: an attempt reserves an in-flight slot on every scope BEFORE the password is checked, and
counts its failure BEFORE releasing the slot, so N concurrent guesses cannot exceed a ceiling by N.

Recovery: each account carries a generation number. Unlocking bumps it, which makes every pair counter and
lock for that account unreachable without enumerating keys. Password reset also unlocks.

Storage: Redis when DRISHTI_REDIS_URL is set and reachable, shared by every API instance. If Redis is
configured but unreachable, the same primitives use per-process memory for a cooldown period; limits keep
applying, but each process counts on its own. No fail-open.

Client IP: `client_ip()` honours X-Forwarded-For only when the direct peer is a trusted proxy
(config.TRUSTED_PROXIES), walking the chain from the right, so a caller cannot spoof its address.
Only digests of usernames and IPs are stored in keys; no passwords or tokens are stored or logged here.
"""
from __future__ import annotations

import functools
import hashlib
import ipaddress
import math
import threading
import time
from dataclasses import dataclass

import redis

from .. import config

REDIS_RETRY_COOLDOWN_S = 5.0
INFLIGHT_TTL_S = 60          # a crashed request's reservation expires on its own
TRIGGER_GUARD_S = 60         # dedupes concurrent triggers of the same account lock
LOCK_LEVEL_TTL_S = 24 * 3600
_MEM_PRUNE_AT = 10_000

_client: redis.Redis | None = None
_client_url: str | None = None
_redis_down_until = 0.0
_mem: dict[str, list] = {}  # key -> [value, expires_at (monotonic) or None]; value is int, str or set
_mem_lock = threading.RLock()


@dataclass(frozen=True)
class Decision:
    allowed: bool
    retry_after: int  # seconds; 0 when allowed
    degraded: bool    # True when Redis is configured but not in use, so counters are per-process


@dataclass(frozen=True)
class Denied:
    retry_after: int
    scope: str        # "account_lock" | "pair" | "account" | "ip"


@dataclass
class Attempt:
    username: str
    ip: str
    role: str | None
    gen: str
    inflight_keys: list[str]


# ------------------------------------------------------------------ Redis access
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


# ------------------------------------------------------------------ memory fallback (call with _mem_lock held)
def _mem_entry(key: str):
    entry = _mem.get(key)
    if entry is None:
        return None
    if entry[1] is not None and entry[1] <= time.monotonic():
        del _mem[key]
        return None
    return entry


def _mem_prune() -> None:
    if len(_mem) > _MEM_PRUNE_AT:
        now = time.monotonic()
        for k in [k for k, (_, exp) in _mem.items() if exp is not None and exp <= now]:
            del _mem[k]


# ------------------------------------------------------------------ primitives (Redis first, memory fallback)
def incr(key: str, window: int | None = None) -> int:
    """Increment and return the new value. `window` (seconds) is set on the first increment only; None = no expiry."""
    client = _redis()
    if client is not None:
        try:
            pipe = client.pipeline()
            pipe.incr(key)
            if window:
                pipe.expire(key, window, nx=True)
            return int(pipe.execute()[0])
        except redis.RedisError:
            _redis_failed()
    with _mem_lock:
        entry = _mem_entry(key)
        if entry is None:
            entry = [0, time.monotonic() + window if window else None]
            _mem[key] = entry
        entry[0] = int(entry[0]) + 1
        _mem_prune()
        return entry[0]


def decr(key: str) -> None:
    client = _redis()
    if client is not None:
        try:
            client.decr(key)
            return
        except redis.RedisError:
            _redis_failed()
    with _mem_lock:
        entry = _mem_entry(key)
        if entry is not None:
            entry[0] = max(0, int(entry[0]) - 1)


def count(key: str) -> int:
    client = _redis()
    if client is not None:
        try:
            return max(0, int(client.get(key) or 0))
        except redis.RedisError:
            _redis_failed()
    with _mem_lock:
        entry = _mem_entry(key)
        return max(0, int(entry[0])) if entry else 0


def set_value(key: str, value: str, ttl: int) -> None:
    client = _redis()
    if client is not None:
        try:
            client.set(key, value, ex=ttl)
            return
        except redis.RedisError:
            _redis_failed()
    with _mem_lock:
        _mem[key] = [value, time.monotonic() + ttl]


def ttl(key: str) -> int:
    """Seconds remaining on a key, 0 if absent or expired."""
    client = _redis()
    if client is not None:
        try:
            remaining = client.ttl(key)
            return max(0, int(remaining)) if remaining and remaining > 0 else 0
        except redis.RedisError:
            _redis_failed()
    with _mem_lock:
        entry = _mem_entry(key)
        if entry is None or entry[1] is None:
            return 0
        return max(0, math.ceil(entry[1] - time.monotonic()))


def set_add(key: str, member: str, window: int) -> int:
    """Add a member to a set (window set on creation) and return the set's size."""
    client = _redis()
    if client is not None:
        try:
            pipe = client.pipeline()
            pipe.sadd(key, member)
            pipe.expire(key, window, nx=True)
            pipe.scard(key)
            return int(pipe.execute()[2])
        except redis.RedisError:
            _redis_failed()
    with _mem_lock:
        entry = _mem_entry(key)
        if entry is None:
            entry = [set(), time.monotonic() + window]
            _mem[key] = entry
        entry[0].add(member)
        _mem_prune()
        return len(entry[0])


def set_card(key: str) -> int:
    client = _redis()
    if client is not None:
        try:
            return int(client.scard(key))
        except redis.RedisError:
            _redis_failed()
    with _mem_lock:
        entry = _mem_entry(key)
        return len(entry[0]) if entry else 0


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
    """Clear process-local counters (tests, and the fallback state a restart clears)."""
    with _mem_lock:
        _mem.clear()


# ------------------------------------------------------------------ generic per-key limit (API layer)
def hit(key: str, limit: int, window: int) -> Decision:
    """Count one request against `limit` per `window` seconds and report whether it is allowed."""
    n = incr(key, window)
    allowed = n <= limit
    return Decision(allowed=allowed, retry_after=0 if allowed else window, degraded=degraded())


# ------------------------------------------------------------------ policy
def _h(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8", "replace")).hexdigest()


def user_policy(role: str | None) -> tuple[int, int]:
    """Pair ceiling for an account of this role: (max failed attempts from one source, window seconds)."""
    policy = config.LOGIN_THROTTLE_POLICY_BY_ROLE
    return policy.get(role or "DEFAULT", policy["DEFAULT"])


def account_source_limit(role: str | None) -> int:
    """Distinct failing source IPs (within config.LOGIN_ACCOUNT_WINDOW_S) that lock an account."""
    limits = config.LOGIN_ACCOUNT_SOURCES_BY_ROLE
    return limits.get(role or "DEFAULT", limits["DEFAULT"])


def _gen_key(username: str) -> str:
    return f"drishti:login:gen:{_h(username)}"


def _generation(username: str) -> str:
    return str(count(_gen_key(username)))


def _lock_key(username: str, gen: str) -> str:
    return f"drishti:login:lock:{_h(username)}:{gen}"


def _level_key(username: str) -> str:
    return f"drishti:login:level:{_h(username)}"


def _pair_key(username: str, gen: str, ip: str) -> str:
    return f"drishti:login:pair:{_h(username)}:{gen}:{_h(ip)}"


def _pair_inflight_key(username: str, gen: str, ip: str) -> str:
    return f"drishti:login:pairinflight:{_h(username)}:{gen}:{_h(ip)}"


def _sources_key(username: str, gen: str) -> str:
    return f"drishti:login:sources:{_h(username)}:{gen}"


def _sources_inflight_key(username: str, gen: str) -> str:
    return f"drishti:login:srcinflight:{_h(username)}:{gen}"


def _trigger_key(username: str, gen: str) -> str:
    return f"drishti:login:trigger:{_h(username)}:{gen}"


def _ip_key(ip: str) -> str:
    return f"drishti:login:ip:{_h(ip)}"


def _ip_inflight_key(ip: str) -> str:
    return f"drishti:login:ipinflight:{_h(ip)}"


def account_lock_seconds(level: int) -> int:
    return min(config.LOGIN_ACCOUNT_LOCK_BASE_S * (2 ** max(0, level - 1)), config.LOGIN_ACCOUNT_LOCK_MAX_S)


# ------------------------------------------------------------------ attempt lifecycle
def begin_attempt(username: str, ip: str, role: str | None) -> Attempt | Denied:
    """Reserve this attempt against every scope BEFORE the password is checked. A Denied result means no
    password check should run, and carries how long to wait."""
    gen = _generation(username)
    lock_wait = ttl(_lock_key(username, gen))
    if lock_wait:
        return Denied(retry_after=lock_wait, scope="account_lock")

    max_pair, window_pair = user_policy(role)
    source_limit = account_source_limit(role)
    scopes = [
        ("pair", _pair_key(username, gen, ip), _pair_inflight_key(username, gen, ip), max_pair, window_pair,
         lambda: count(_pair_key(username, gen, ip))),
        ("account", _sources_key(username, gen), _sources_inflight_key(username, gen), source_limit,
         config.LOGIN_ACCOUNT_WINDOW_S, lambda: set_card(_sources_key(username, gen))),
        ("ip", _ip_key(ip), _ip_inflight_key(ip), config.LOGIN_IP_MAX_FAILURES, config.LOGIN_IP_WINDOW_S,
         lambda: count(_ip_key(ip))),
    ]
    reserved: list[str] = []
    for scope, _fail_key, inflight_key, limit, window, used in scopes:
        n = incr(inflight_key, INFLIGHT_TTL_S)
        reserved.append(inflight_key)
        if used() + n > limit:
            for k in reserved:
                decr(k)
            return Denied(retry_after=window, scope=scope)
    return Attempt(username=username, ip=ip, role=role, gen=gen, inflight_keys=reserved)


def finish_attempt(att: Attempt, success: bool) -> dict | None:
    """Settle a reservation. Records the failure BEFORE releasing the in-flight slot, so a concurrent
    attempt never sees a window where a counted failure is missing. Returns lock info if this call
    triggered an account lock, else None."""
    max_pair, window_pair = user_policy(att.role)
    triggered = None
    if success:
        delete(_pair_key(att.username, att.gen, att.ip))
    else:
        incr(_pair_key(att.username, att.gen, att.ip), window_pair)
        sources = set_add(_sources_key(att.username, att.gen), _h(att.ip), config.LOGIN_ACCOUNT_WINDOW_S)
        incr(_ip_key(att.ip), config.LOGIN_IP_WINDOW_S)
        if sources >= account_source_limit(att.role) and incr(_trigger_key(att.username, att.gen), TRIGGER_GUARD_S) == 1:
            level = incr(_level_key(att.username), LOCK_LEVEL_TTL_S)
            duration = account_lock_seconds(level)
            set_value(_lock_key(att.username, att.gen), "1", duration)
            delete(_sources_key(att.username, att.gen))
            triggered = {"level": level, "duration_s": duration, "sources": sources}
    for k in att.inflight_keys:
        decr(k)
    return triggered


def unlock_account(username: str) -> None:
    """Administrator unlock / password reset: every pair counter and lock for this account becomes unreachable.
    The escalation level is kept (it expires after LOCK_LEVEL_TTL_S), so repeated abuse still escalates."""
    incr(_gen_key(username))  # no expiry: the generation must outlive any counter it invalidates


def account_status(username: str, role: str | None) -> dict:
    gen = _generation(username)
    return {
        "locked": ttl(_lock_key(username, gen)) > 0,
        "retry_after": ttl(_lock_key(username, gen)),
        "distinct_failing_sources": set_card(_sources_key(username, gen)),
        "source_limit": account_source_limit(role),
        "escalation_level": count(_level_key(username)),
    }


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
    first = _parse_ip(hops[0]) if hops else None
    return str(first) if first is not None else peer
