# ADR-012: Layered rate limiting and brute-force protection

**Status:** Accepted (unit- and route-tested; not yet verified on the live Compose stack). Partly supersedes the
fail-open outage policy in ADR-005.

## Problem

Before this change, `/auth/login` had one per-username counter (5 failures / 15 min), and it only ran when Redis was
configured. Redis outage meant no brute-force protection at all (fail-open, ADR-005). Nothing limited password
spraying across many usernames from one source, and no API route had any request ceiling, so a single client could
exhaust PBKDF2 CPU on login or flood the API. Audit finding SEC-01 (`DRISTI_NET_SECURITY_AUDIT.md`) recorded this.

## Options considered

1. Keep fail-open (ADR-005 as written). Rejected: a Redis outage removes the only login defence.
2. Fail closed when Redis is down. Rejected: locks out every account during an optional-layer outage.
3. Bounded per-process fallback counters when Redis is unreachable. **Chosen.** It is the remediation SEC-01 suggested.
4. A reverse-proxy limiter (nginx `limit_req`). Not chosen as the only layer: it cannot see the account or role, and
   the app must be protected even when reached directly. It remains a possible extra layer.

## Decision

- **Account type = role.** Failed-login ceiling per username by role (`config.LOGIN_THROTTLE_POLICY_BY_ROLE`):
  ADMIN and AUDITOR 3 failures / 30 min; others and unknown usernames 5 / 15 min. Unknown usernames get the default,
  so probing a name is not distinguishable from a real account.
- **Per-IP login ceiling** across all usernames (30 failures / 15 min), against password spraying.
  A successful login clears only the username counter.
- **General API ceilings:** 600 requests/min per client IP for `/api/v1` (health and ready exempt); per user by role,
  checked after token verification (default 300/min, ADMIN 600/min). Both return 429 with `Retry-After`.
- **Storage:** Redis when reachable (shared across processes). When Redis is configured but down, counters fall back
  to in-process memory for a 5 s cooldown, then retry. Degradation is audited (`LOGIN_THROTTLE_DEGRADED`).
- **Client IP:** `X-Forwarded-For` is honoured only when the direct peer is in `DRISHTI_TRUSTED_PROXIES`
  (default loopback and 172.16.0.0/12, the Docker bridge range). The chain is walked right to left and the first
  untrusted hop is taken, so a caller's own prefix cannot change its apparent address.

## Reason

A lockout keyed only by username is defeated by spraying. A lockout keyed only by IP is defeated by a botnet. Role
scoping puts the strictest limits on the accounts an attacker most wants. Fallback counters keep protection during a
Redis outage. The per-user API limit is checked only after the token is verified, so the key cannot be chosen by a caller.

## Trade-offs

- During an outage, each worker counts separately. Effective limits are up to N× weaker with N workers. This is
  bounded, not absent.
- A shared NAT (office, mobile carrier) shares the per-IP ceilings. Tune `DRISHTI_LOGIN_IP_MAX_FAILURES` and
  `DRISHTI_API_IP_RATE_PER_MIN` if this bites.
- `Retry-After` is the full window, not the exact remaining time (simpler; slightly conservative).
- Per-IP API counting is in the app, so requests that never reach it (nginx-level flood) still cost the proxy CPU.

## Security implications

Login brute force and spraying are limited per account, per role, and per source. API flooding is limited per source and
per account. Counters do not record passwords or tokens. The 429 response reveals no account existence. Limit-denied
logins are audited with the source IP.

## Performance implications

One Redis pipeline (INCR + EXPIRE NX) per limited request. Memory fallback is O(1) with a lock and bounded pruning.

## Migration

None. No schema change. Existing Redis keys under the old `drishti:login_fail:<username>` format are ignored; the new
keys are `drishti:login_fail:{user|ip}:<sha256>` and expire on their own.

## Rollback

Revert commit `dd3831c` on `worktree-auth-login-ratelimit` to restore the previous behaviour, including fail-open.
Without a revert, `DRISHTI_API_IP_RATE_PER_MIN` and `DRISHTI_LOGIN_IP_MAX_FAILURES` can be raised by env var to
relax the IP ceilings. The per-user API limits are set in `config.py`, not by env var.

## Verification

- `apps/api/app/tests/test_ratelimit.py`: 15 tests, all passing, including real redis-server counters and TTL,
  the Redis-unreachable fallback, the role policy, spraying, success-does-not-reset-IP, client-IP trust,
  and the API ceilings through the real routes.
- Full unit suite (`pytest apps/api/app/tests`, clamav live test deselected): 244 passed, 7 skipped.
- Not verified: the live Compose stack, nginx pass-through of `X-Forwarded-For`, and frontend display of 429 messages.
