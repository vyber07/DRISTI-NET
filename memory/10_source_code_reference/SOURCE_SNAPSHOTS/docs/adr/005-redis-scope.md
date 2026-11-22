# ADR-005: Redis limited to one justified use

## Problem

`/auth/login` had no brute-force/credential-stuffing protection at all — an attacker could try unlimited
password guesses against any username with no backoff.

## Options considered

- **No rate limiting** — the prior state; rejected as a real gap once identified.
- **In-memory (per-process) counters** — no external dependency, but doesn't survive a process restart and
  doesn't work across multiple API instances behind a load balancer.
- **Redis-backed counters** — a per-username failed-attempt counter with a TTL window
  (`services/ratelimit.py`), shared correctly across instances/restarts.
- **Redis also used for a job-status cache** — considered and explicitly rejected (see Decision).

## Decision

Redis is used for exactly one thing: per-username login-throttle counters. A job-status cache was
considered and rejected — `Job` rows are already owned by Postgres/SQLite and the query is cheap, so
caching them in Redis would duplicate a source of truth with no demonstrated need.

## Reason

Directive §64 again: justify each specific use before adding a piece of infrastructure, not "add Redis
because the target stack mentions it." Login-throttling is the one place in this codebase where an
in-memory counter genuinely isn't good enough (multi-instance correctness, survives restarts) and where
the feature doesn't already have a home in Postgres.

## Trade-offs

Adds a dependency (and thus a failure mode) to the login path. Mitigated by failing *open*: if Redis is
configured but unreachable, login proceeds without throttling rather than locking out every user over an
optional hardening layer — and that degradation is always audited (`LOGIN_THROTTLE_DEGRADED`), never
silent.

## Security implications

This is itself the security control: `LOGIN_THROTTLE_MAX_ATTEMPTS` (default 5) within
`LOGIN_THROTTLE_WINDOW_S` (default 900s) blocks further attempts on that username — including with the
*correct* password while throttled, which specifically defends against credential-stuffing, not just typo
retries. Fail-open is itself a security trade-off (availability over strict lockout) — accepted because
this is one defense-in-depth layer, not the only one (password hashing, JWT expiry, server-side
authorization all remain in force regardless of Redis's state).

## Performance implications

One Redis round-trip (`INCR`+`EXPIRE`, or a `GET`) per login attempt; negligible compared to the PBKDF2
password hash verification already on that path.

## Migration

N/A — Redis is additive; `DRISHTI_REDIS_URL` empty simply disables throttling (the pre-existing behavior).

## Rollback

Unset `DRISHTI_REDIS_URL`.

## Verification

Live-verified end-to-end against a real Redis instance, twice, in two different environment states
(`TASK_BOARD.md` Phase 4 and Phase 7 — the second one after the first instance's binary was lost to an
environment reset and had to be rebuilt from source): 5 wrong-password attempts → `401` each, 6th → `429`
(including with the correct password, proving the credential-stuffing defense), successful login after
clearing the counter → `200` with a real JWT, and the counter genuinely reaching `0`/absent afterward —
checked directly against Redis with `redis-cli`, not just via the API's response codes. Fail-open verified
by killing the Redis process mid-session: login still succeeded and a real `LOGIN_THROTTLE_DEGRADED` audit
row was found in the database afterward.
