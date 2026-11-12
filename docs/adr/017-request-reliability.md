# ADR-017: Request reliability: connection release, pool sizing, error envelope, client retry and recovery

**Status:** Accepted. Tested (SQLite 453 passed, disposable PostgreSQL 16 455 passed; browser verification 8 of 8;
isolated load tests). Not deployed. The host-nginx part is a recommendation, not applied.
Operations: `docs/TROUBLESHOOTING.md`. Test record: `docs/audit/FAILED_TO_FETCH_TEST_RECORD_2026-11-12.md`.

## Problem

Users of the public demo reported intermittent "Failed to fetch" errors and pages that would not load. The
investigation found three independent causes:

1. **A cross-origin redirect:**
   - Since 2026-11-11, `http://65.0.102.181` answers every request with a 301 to the `nip.io` HTTPS origin.
   - Tabs opened before the switch kept calling the API on the old origin.
   - The browser blocks a cross-origin redirect on `fetch()`, so the page saw only `TypeError: Failed to fetch`.
2. **A pool/thread-pool deadlock under load:**
   - The sync auth dependency held a database connection while the request waited for a second worker thread.
   - With about 50 concurrent users, all 40 threads waited for the 15 connections. Each request then hung for 30 s and
     failed with an unformatted 500.
3. **No client resilience:**
   - The client did not catch fetch errors, had no timeout and no retry, and did not recover when the network came
     back.
   - A raw browser message reached the user.

## Options considered

- **Raise the pool only.** This delays the deadlock but does not remove it: a request still holds a connection while
  it queues for a thread. Rejected on its own.
- **Make every route async with an async driver.** That is the right long-term direction, but it means rewriting all
  70 routes and the services, with high risk. Deferred.
- **Release the connection at the end of the auth dependencies and close sessions when the endpoint returns, plus size
  the pool to the thread pool.** Chosen: small, local and verifiable.
- **CORS for the old origin.** Rejected: the API is same-origin by design (CSP `connect-src 'self'`), and allowing
  credentialed cross-origin calls widens the attack surface. A same-origin 421 the client understands is safer.

## Decision

- **Backend:**
  - **Connection release:** `current_user` and `require_roles` call `release_connection(db)`, a commit, before
    returning.
  - **Sessions closed early:** every `Depends(get_db)` is `scope="function"`, so the session closes when the endpoint
    returns. `get_db` is async, so its cleanup never needs a worker thread.
  - **Pool sizing:** `THREADPOOL_SIZE` 40 (applied at startup), pool 20 + 30 overflow, timeout 10 s, `pool_pre_ping`,
    recycle 1800 s. All are configurable. A startup warning fires when the pool is smaller than the thread pool.
  - **One error envelope** for every error: `{detail, code, request_id}`, plus `trace_id`, and the earlier `error`
    object for domain errors. `detail` keeps its meaning.
    - Pool timeout → `503 BUSY` with `Retry-After: 5`.
    - `OperationalError` → `503 DB_UNAVAILABLE` with `Retry-After: 10`.
    - Unhandled errors → `500 INTERNAL`, with no internals.
  - **Request logging:** one structured log line per API request, at WARNING when it is slow or a 5xx.
  - **Diagnostics:** `GET /api/v1/diagnostics` for ADMIN and AUDITOR, audited, under the overridable action
    `viewDiagnostics`.
  - **SPA serving:** the app shell is served `no-cache`, hashed assets `immutable`, and `HEAD` is allowed.
- **Frontend (`real_client.ts`):**
  - Network failures and timeouts become an `ApiError` with code `NETWORK` or `TIMEOUT` and a plain message.
  - Reads have a 30 s timeout. GET/HEAD are retried three times on NETWORK, TIMEOUT, 502, 503 and 504, honouring
    `Retry-After` and waiting for `online`. Writes are never retried.
  - An `X-Correlation-Id` is sent with each request; the request ID is shown in errors.
  - A 401 redirects once and suppresses parallel error panels.
  - A `421 ORIGIN_MOVED` moves the tab to the canonical origin: https only, never a downgrade.
  - `ErrorState` reloads its data on `online`, and the app shell shows an offline banner.
  - The evidence download goes through the shared client.
- **Host nginx (recommended):** `infrastructure/nginx/canonical-origin.conf`. API calls on the old origin get a JSON
  421; page loads keep the 301.

## Reason

The deadlock was proven by a stack dump (py-spy: 40 of 40 threads in `current_user` waiting on the pool) and removed
by the change: 0 errors at 50 users, where `main` had 12 × 500 with p50 30.6 s.

Closing the session at the end of the endpoint cut the 503s at 150 users from 148 to 80, measured with a new
connection per request.

Retrying only idempotent reads avoids double submission. Uploads are also de-duplicated by hash (ADR-016).

## Trade-offs

- **Retries add load** while the service is saturated. This is bounded by three attempts, back-off and `Retry-After`.
- **The early commit** in the auth dependencies ends their read transaction. Objects stay usable
  (`expire_on_commit=False`), and the dependencies have no pending writes.
- **No lazy streaming from the database:** a route that returns a streaming response reading from the database lazily
  would break with function scope. There are none today, and a reviewer must keep it that way.
- **Connection count:** a pool of 50 per API process counts against PostgreSQL `max_connections`.
- **Error format:** clients that compared whole error bodies will see the added `code` and `request_id` fields.

## Security implications

- Error bodies never include internal messages, stack traces or database errors.
- 422 responses still do not echo input.
- Diagnostics is limited to ADMIN and AUDITOR, every view is audited, and it holds no bodies, tokens or personal data.
- The 421 handling accepts an origin only (no path), https only unless the page itself is http, and never a downgrade.
- No CORS was opened.

## Performance implications

- At most one pool connection per request, held for the duration of the endpoint only.
- Saturation answers within about 10 s instead of hanging for 30 s.
- The single API process still saturates at about 100 active users. That is a capacity ceiling, not a defect;
  follow-up in `docs/TROUBLESHOOTING.md`.

## Migration

None (no schema change). Deploy by rebuilding the API and web images. The host-nginx change is separate and needs
approval.

## Rollback

Revert the commit. The settings can also be tuned through the environment without code changes.
