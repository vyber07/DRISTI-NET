# ADR-012: Layered rate limiting, account lockout and brute-force protection

**Status:** Accepted. Unit- and route-tested (265 passed, 7 skipped across the API suite, of which 36 are the
rate-limit file). Not yet verified on the live Compose stack. Partly supersedes the fail-open outage policy in ADR-005.

**Revision history:** first version (commit `dd3831c`): per-username and per-IP counters, API ceilings.
Revision 2 (this record): account lockout by distinct source, in-flight reservations (concurrency), constant-cost
checks for unknown users, admin unlock and an operator CLI, password reset clears locks, bounded input, audit of
lock events. Revision 2 changed behaviour introduced by revision 1, which had not been deployed.

## Problem

Before this work, `/auth/login` had one per-username counter, which only ran when Redis was configured. During a
Redis outage there was no brute-force protection (fail-open, ADR-005). Five guesses from one IP locked a named
account for everyone, so an attacker needed no botnet to lock out any known user (lockout DoS). The check ran before
the failure was recorded, so N concurrent guesses could all pass. Unknown usernames skipped password hashing, so
response time revealed which usernames existed. There was no administrator unlock, and no way out for a sole
locked administrator. The login body had no size bounds. Audit finding SEC-01 recorded the fail-open issue.

## Options considered

1. Keep fail-open (ADR-005 as written). Rejected: a Redis outage removes the only login defence.
2. Fail closed when Redis is down. Rejected: locks out every account during an optional-layer outage.
3. Bounded per-process fallback when Redis is unreachable. **Chosen.** Suggested by SEC-01's remediation.
4. Lock accounts on failures from any source. Rejected: one IP could lock any account (lockout DoS).
5. Lock accounts only per source IP. Rejected: a distributed attacker is never locked, and the per-source counter
   is trivially rotated.
6. **Lock an account only after failures from several distinct source IPs.** **Chosen.** One source can never lock
   an account for others. A distributed attacker must use several sources, each of which is limited separately.
7. Reverse-proxy limits (nginx `limit_req`) only. Rejected as the only layer: they cannot see account or role, and
   the app must be protected even when reached directly. Possible as an extra layer later.

## Decision

**Scopes** (each login attempt is checked against all of them before any password hashing):

| Scope | Key | Ceiling (default) | Effect when reached |
|---|---|---|---|
| Pair | username + source IP | ADMIN and AUDITOR 3 failures / 30 min; others 5 / 15 min (`LOGIN_THROTTLE_POLICY_BY_ROLE`) | 429 for that source only |
| Account | username, all sources | failures from 10 distinct IPs (ADMIN and AUDITOR: 5) within 60 min | account lock: 15 min, doubling per repeat, capped at 4 h |
| IP | source IP, all usernames | 30 failures / 15 min | 429 for that source (password spraying) |
| API | source IP / user | 600 / min per IP; 300 / min per user (ADMIN 600) | 429 on `/api/v1` requests |

Unknown usernames use the DEFAULT policy, so they are limited and locked by the same counters as real accounts.

**Concurrency.** A login reserves an in-flight slot on each scope before the password is checked, and records its
failure before releasing the slot (`begin_attempt` / `finish_attempt`). N concurrent guesses therefore cannot
exceed a ceiling by N. The test `test_concurrent_attempts_never_exceed_the_pair_limit` checks this with 40 threads.

**Constant cost.** An unknown username runs one dummy PBKDF2 (`auth.verify_absent_user`), so a real username and a
non-existent one take the same time to reject. Denied attempts skip hashing entirely, which also makes them cheap.

**Responses.** Unknown, inactive and wrong-password all return `401 "Invalid credentials"`. Every lock or limit
returns `429 "Too many failed login attempts; try again later"` with `Retry-After`, the same body for every account
and for unknown names. Inputs are bounded (username 1–200, password 1–1024 characters) and rejected with 422 before
hashing.

**Recovery.**
- Locks expire on their own. The escalation level is kept for 24 h, so repeated abuse still escalates.
- `POST /users/{id}/unlock` (ADMIN) bumps the account's generation number. Every pair counter and lock for the
  account is keyed by generation, so they become unreachable without enumerating keys. Audited as `USER_UNLOCK`.
- Password reset (ADMIN) also bumps the generation, so guesses cannot outlive the password they targeted.
- `GET /users/{id}/login-status` (ADMIN) shows lock state for deciding whether to unlock.
- `python -m apps.api.app.unlock_cli <username>` (operator, inside the API container) covers a locked sole
  administrator. Without a shared Redis it only affects its own process, so restart the API to clear its counters.

**Audit (no secrets).** Failed logins record the outcome, source IP and reason. Denials record scope and
retry-after. Lock triggers record `ACCOUNT_LOCKED` with escalation level, duration and distinct sources. Passwords,
tokens and password hashes never reach a counter, key, log or audit row. Keys hold SHA-256 digests of usernames and IPs.

**Client IP.** `X-Forwarded-For` is honoured only when the direct peer is in `DRISHTI_TRUSTED_PROXIES` (default
loopback and 172.16.0.0/12). The chain is walked from the right and the first untrusted hop is taken, so a caller's
own prefix cannot change its apparent address. A malformed rightmost hop from a trusted proxy is ignored.

**Storage.** Redis (`DRISHTI_REDIS_URL`) holds the shared counters and is required for a multi-instance deployment.
A startup warning is logged when it is unset. If Redis is configured but unreachable, the same primitives use
per-process memory for a 5-second cooldown and then retry. Limits keep applying, but each process counts separately.

## Reason

Source-scoped counters stop a single attacker from locking anyone else out, and distinct-source account locking still
slows a distributed attacker. Reserving slots before checking closes the concurrency bypass. The constant-cost path
and identical responses remove the two enumeration signals. Generation-based unlock lets an administrator clear
everything for one account without enumerating keys, and makes password reset a complete recovery.

## Trade-offs and residual risks

- **Lockout DoS is reduced, not removed.** An attacker with about 10 distinct source IPs (5 for ADMIN and AUDITOR)
  can still lock a named account for escalating periods, up to 4 h. This is the price of protecting against
  distributed guessing. Mitigations: escalation cap, administrator unlock, the audit trail and `ACCOUNT_LOCKED` events.
  Not yet implemented: a challenge (CAPTCHA) or an allow-list of trusted networks.
- **A shared NAT shares the per-IP ceilings.** An office or carrier NAT can hit the 30 / 15 min IP ceiling together.
  Tune `DRISHTI_LOGIN_IP_MAX_FAILURES`.
- **A lock affects the legitimate user too.** While an account is locked, its owner is refused from every source
  until the lock expires or is unlocked. This is intentional, and it is why distinct-source locking needs several sources.
- **Outage degradation.** During a Redis outage each process counts separately, so effective limits are up to N
  times weaker with N workers. This is bounded, not absent.
- **Sole-admin recovery** needs shell access to the API container. There is no out-of-band reset.
- **No MFA, no CAPTCHA, no account-recovery email.** Recovery is administrator-controlled.
- **`Retry-After` is the full window**, not the exact remaining time.
- **Per-IP API counting is in the app.** Floods that never reach it still cost the proxy CPU.

## Security implications

Brute force and password spraying are limited per account, per role, per source and across sources. Enumeration is
resisted through identical responses and identical hashing cost. Concurrent guessing is bounded exactly. Lock and unlock
events are audited. Secrets never enter counters, keys or logs.

## Performance implications

Each login issues several Redis commands across the three scopes (reserve, read, then settle). These are not pipelined
across scopes, so this is measured overhead, not a constant. Denied attempts skip PBKDF2 entirely, so a flood is cheaper than a normal login. The memory fallback is O(1) per
key under a lock, with bounded pruning.

## Migration

None. There is no schema change. Revision 1 keys (`drishti:login_fail:*`) are ignored and expire on their own. Revision 2
keys live under `drishti:login:*`, with per-account generation keys that do not expire.

## Rollback

Revert the branch's commits (revision 1 `dd3831c`, revision 2 on top of it) to restore the earlier behaviour.
Relaxing the limits without a revert: `DRISHTI_LOGIN_IP_MAX_FAILURES` and `DRISHTI_API_IP_RATE_PER_MIN` can be raised by
environment variable. The role policies, the account-source counts and the per-user API limits are set in `config.py`.

## Configuration

| Setting | Env var | Default |
|---|---|---|
| Pair ceiling, by role | (config) `LOGIN_THROTTLE_POLICY_BY_ROLE` | DEFAULT 5/15 min; ADMIN and AUDITOR 3/30 min |
| Default pair ceiling | `DRISHTI_LOGIN_THROTTLE_MAX_ATTEMPTS`, `DRISHTI_LOGIN_THROTTLE_WINDOW_S` | 5, 900 |
| Account distinct-source count | (config) `LOGIN_ACCOUNT_SOURCES_BY_ROLE` | DEFAULT 10; ADMIN and AUDITOR 5 |
| Account source window | `DRISHTI_LOGIN_ACCOUNT_WINDOW_S` | 3600 |
| Account lock base / cap | `DRISHTI_LOGIN_ACCOUNT_LOCK_BASE_S` / `_MAX_S` | 900 / 14400 |
| IP failure ceiling | `DRISHTI_LOGIN_IP_MAX_FAILURES`, `DRISHTI_LOGIN_IP_WINDOW_S` | 30, 900 |
| API per IP / per user | `DRISHTI_API_IP_RATE_PER_MIN` (config) `API_USER_RATE_PER_MIN_BY_ROLE` | 600; 300 (ADMIN 600) |
| Trusted proxies | `DRISHTI_TRUSTED_PROXIES` | 127.0.0.1/32, ::1/128, 172.16.0.0/12 |
| Shared counters | `DRISHTI_REDIS_URL` | unset (per-process, with a warning) |

## Verification

- `apps/api/app/tests/test_ratelimit.py`: 36 tests, all passing against a scratch redis-server, with none skipped. They cover:
  - brute force from one source, with exactly 3 password checks for ADMIN;
  - distributed guessing and escalation;
  - single-source lockout abuse, which must fail;
  - enumeration: identical 401, 429 and inactive responses, and a dummy hash for unknown names;
  - recovery: lock expiry, admin unlock, password reset, operator CLI, and admin-only access to these routes;
  - proxy-header spoofing, both from a direct caller and through a trusted proxy;
  - concurrency: 40 service threads and 12 HTTP requests, with granted counts exact;
  - input bounds, audit hygiene (a sentinel password never reaches the audit log), and two Redis instances sharing state.
- Full API suite: 265 passed, 7 skipped (the live ClamAV test deselected).
- Not verified: the live Compose stack, nginx pass-through of `X-Forwarded-For`, frontend display of the 422 detail text,
  and multi-instance behaviour with more than one API process (the shared-Redis test uses two clients in one process).
