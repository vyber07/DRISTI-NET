# Troubleshooting: "Failed to fetch", pages that do not load, slow or failing API calls

**Status (2026-11-12):** the fixes are on branch `worktree-auth-login-ratelimit`. Tested and verified on isolated
instances. **Not deployed:** the live demo still runs `main`. The host-nginx change in
`infrastructure/nginx/canonical-origin.conf` is a recommendation and has not been applied to the live host.
ADR: `docs/adr/017-request-reliability.md`. Test record: `docs/audit/FAILED_TO_FETCH_TEST_RECORD_2026-11-12.md`.

## Quick guide: what the user sees, and what it means

| What the user sees (branch build) | Meaning | Where to look |
|---|---|---|
| "Cannot reach the DRISTI-NET server. Check your network connection…" | No HTTP response arrived after 3 retries: network loss, proxy down, API process down, or a cross-origin redirect (cause 1). | Browser devtools Network tab; host nginx error log; `docker compose ps` |
| "You are offline…" banner | The browser reports no network. Pages reload their data when it returns. | Client side only |
| "The server took too long to respond." | A read got no answer in 30 s. | `/api/v1/diagnostics` → `worker_threads`, `database_pool`; slow-request log lines |
| "The service is busy. Please try again in a few seconds." + Request ID | No database connection was free within 10 s (HTTP 503 `BUSY`). The service is saturated. | `/api/v1/diagnostics` → `error_codes.DB_POOL_TIMEOUT`, `database_pool` |
| "The database is temporarily unavailable…" | PostgreSQL refused or dropped the connection (HTTP 503 `DB_UNAVAILABLE`). | `docker compose logs postgres`; `checks.database` |
| "An unexpected error occurred. Quote the request ID…" | Unhandled server error (HTTP 500 `INTERNAL`). | API log: search for the request ID; `recent_server_errors` |
| "Your session expired" on the sign-in page | Token expired or revoked (password change, logout, admin action). Expected. | Audit log `AUTH_REJECTED` |

Every error carries a **Request ID** (`REQ-…`). It is the `X-Request-Id` response header, the `request_id` in the
error body, the `trace_id` on API log lines and the `request_id` of audit events. Ask the user for it, then search the
logs for it.

On the live `main` build, a raw **"Failed to fetch"** under "Could not load this information" means the same as
"Cannot reach the server". That build shows the browser's own message, and it does not retry or recover.

## Root causes found (2026-11-11/12 investigation)

### 1. Cross-origin redirect after the HTTPS switch (confirmed from live logs and reproduced)

- **Evidence (live, read-only):** host nginx began answering `http://65.0.102.181` with
  `301 → https://65.0.102.181.nip.io$request_uri` at about 11:53 on 2026-11-11. At 12:06 the access log shows
  browser calls `GET /api/v1/auth/me` and `GET /api/v1/cases` with `Referer: http://65.0.102.181/command-center`,
  answered `301`. Those tabs were opened before the switch.
- **Mechanism:** `fetch()` follows the 301 to another origin. The API's response has no CORS headers (it is meant to be
  same-origin only), so the browser blocks it. JavaScript receives only `TypeError: Failed to fetch`, which the page
  showed verbatim. A reload fixes it only if the user re-types the address.
- **Reproduced:** with a throwaway nginx switched from proxy to cross-origin 301 while the tab was open, the page showed
  "Could not load this information / Failed to fetch", and the console logged "blocked by CORS policy… (redirected from …)".
- **Fix:**
  - **Server side, recommended, not applied:** `infrastructure/nginx/canonical-origin.conf`. Page loads keep the 301;
    `/api/` on the old address returns a same-origin JSON `421 {"code":"ORIGIN_MOVED","location":"https://…"}`.
  - **Client side, on the branch:** the client moves the tab to that origin. Without the nginx change, the client
    still replaces "Failed to fetch" with a plain message after retrying.

### 2. Database-pool deadlock under concurrent load (confirmed, reproduced, fixed)

- **Evidence:**
  - Measured on `main` code against PostgreSQL: at 50 concurrent users, p50 latency was 30.6 s and 12 requests failed
    with 500 after exactly 30 s.
  - Server log: `QueuePool limit of size 5 overflow 10 reached, connection timed out, timeout 30`.
  - A `py-spy` dump showed all 40 worker threads waiting in `current_user (auth.py)` for a connection.
- **Mechanism:**
  - FastAPI runs the sync `current_user` dependency and the endpoint on separate worker threads.
  - `current_user` checked out a pool connection (15 maximum) and kept it while the request queued for a second
    thread.
  - With more requests in flight than connections, every one of the 40 threads waited for a connection, and the
    connections were held by requests waiting for a thread.
  - Nothing moved until the 30 s pool timeout. Each timeout became an unhandled exception, so the response was an
    HTML or plain 500 with no request ID.
  - In the browser: a 30 s spinner, then "Internal Server Error". When the proxy timed out first, "Failed to fetch".
- **Fix (branch):**
  - `current_user` and `require_roles` commit, which returns the connection before the endpoint runs
    (`auth.release_connection`).
  - The session closes when the endpoint returns (`Depends(get_db, scope="function")`) instead of after the response is sent.
  - `get_db` cleanup runs on the event loop, not on a worker thread.
  - Pool sized to the thread pool: 20 + 30 ≥ 40 threads. `pool_pre_ping`, `pool_recycle` 1800 s, `pool_timeout` 10 s.
  - Pool timeouts become `503 BUSY` with `Retry-After: 5`. Database errors become `503 DB_UNAVAILABLE`.
  - A startup warning when the pool is smaller than the thread pool.

### 3. Network loss: no recovery (reproduced, fixed in the client)

- **Before:** going offline while moving between pages showed the raw "Failed to fetch", which stayed after the
  network returned.
- **After:**
  - Reads (GET/HEAD) are retried with back-off and wait for the `online` event.
  - An offline banner is shown.
  - Error panels reload their data when the browser is back online.
  - Writes are never retried automatically, so an upload or a review decision is never sent twice.

### Checked and ruled out

| Hypothesis | Result |
|---|---|
| Session expiry produces "Failed to fetch" | No: revoked sessions went cleanly to "Your session expired". The branch also stops parallel requests from flashing error panels during that redirect. |
| Stale `index.html` after a redeploy (blank page) | Not reproduced in Chromium. Hardened anyway: the app shell is `Cache-Control: no-cache`, and hashed assets are `immutable`. |
| Container restarts or OOM kills | None. All containers had been up since the last deploy, with no OOM events. Swap was full (2 GB), which is worth watching but did not explain the failures. |
| The October "connection refused" flood in the nginx error log | It came from the old host API on port 8000 (15,444 errors on 2026-10-24). That API has since been replaced by the Compose API on 8001, and only 4 such errors were logged on 2026-11-11. Historical. |
| Frontend calling `localhost` | No: the live bundle uses the same-origin `/api/v1`. The two `localhost` strings in the bundle are React Router internals. |
| Request bodies too large | `client_max_body_size 30M` matches the multipart limit. The streaming upload route needs the dedicated location (ADR-016). |

## Diagnosing a live problem

1. **Get the request ID** from the error panel, or from the `X-Request-Id` header in devtools.
2. **API log:** `docker compose logs api | grep REQ-…`. Every API request now logs one line from `drishti.http`:
   method, path, status and duration. Lines at `WARNING` are 5xx responses, or requests slower than
   `DRISHTI_SLOW_REQUEST_MS` (2000 ms).
3. **Diagnostics** (ADMIN or AUDITOR): `GET /api/v1/diagnostics`. Each call is audited as `DIAGNOSTICS_VIEW`. It returns:
   - `process`: uptime, request counts by status class, slow-request count, `error_codes` (`DB_POOL_TIMEOUT`,
     `DB_UNAVAILABLE`, `INTERNAL`) and the last 50 server errors with their request IDs;
   - `database_pool`: `size`, `checkedout`, `overflow` and `configured_capacity`. When `checkedout` stays at
     capacity, the service is saturated;
   - `worker_threads`: `in_use` of `total`;
   - `checks`: database, Redis and storage, each with its latency.
4. **Host nginx:**
   - `sudo tail /var/log/nginx/error.log`: `connect() failed (111)` means the API is down; `upstream timed out` means
     the API is too slow (`proxy_read_timeout 120s`).
   - Access log: a `301` for `/api/` paths means cause 1.
5. **PostgreSQL connections:** `select count(*), state from pg_stat_activity group by state;`.

## Settings

| Variable | Default | Notes |
|---|---|---|
| `DRISHTI_THREADPOOL_SIZE` | 40 | Worker threads for sync endpoints and dependencies (set at startup). |
| `DRISHTI_DB_POOL_SIZE` | 20 | Persistent connections per API process. |
| `DRISHTI_DB_MAX_OVERFLOW` | 30 | Extra connections under load. Keep size + overflow ≥ thread pool. |
| `DRISHTI_DB_POOL_TIMEOUT_S` | 10 | Wait for a connection before answering 503 `BUSY`. |
| `DRISHTI_DB_POOL_RECYCLE_S` | 1800 | Replace connections older than this. |
| `DRISHTI_SLOW_REQUEST_MS` | 2000 | Log threshold for slow requests. |

Capacity check: (API processes × 50) + worker connections must stay below PostgreSQL `max_connections` (default 100).
Scale API processes only with that in mind, or put PgBouncer in front.

## Load-test results (isolated, PostgreSQL 16, same data and load generator)

Each virtual user loads pages the way the browser does: a page's API calls in parallel, then a short pause, for 30 s.

| Users | `main` (live code) | Branch, intermediate (keep-alive client) | Branch, final (new connection per request) |
|---|---|---|---|
| 10 | p50 0.15 s, no errors | p50 0.15 s, no errors | — |
| 25 | p50 0.65 s, p95 2.4 s, no errors | p50 0.76 s, p95 3.2 s, no errors | — |
| 50 | **p50 30.6 s, 12 × 500** (pool deadlock) | p50 2.5 s, p95 5.8 s, no errors | p50 2.2 s, p95 5.9 s, **no errors** |
| 100 | not run on `main`. `main` + connection release only: p50 7.6 s, p95 39.9 s, 26 × 500 | p50 7.1 s, 1 connection reset | p50 6.4 s, p95 15.8 s, 25 × 503 `BUSY` (retryable) |
| 150 | not run | p50 10.8 s, 14 connection errors | p50 25.4 s, 80 × 503 `BUSY`, max 40 s |

**Columns:**
- "Intermediate" is the branch before sessions were closed at the end of the endpoint (`scope="function"`).
- "Final" is the committed code, measured with a new TCP connection per request (`FF_NO_KEEPALIVE=1`), which is
  closer to many separate browsers.
- `main` was measured with keep-alive.
- The `403`s in the raw output are expected: some synthetic roles may not list integrity anchors.

**What this does and does not show:**
- The deadlock is gone. Overload now degrades into fast, retryable 503s, which the client retries and then explains,
  instead of 30 s hangs and 500s.
- The single API process still saturates at around 100 concurrent active users. Raising that ceiling needs more API
  processes and connection planning, or faster heavy endpoints (`/graph`, `/analysis`, `/evidence/summary`, the slowest
  in the logs). That is capacity work, not a defect fix, and is recorded as a follow-up.

## Reproducing

Every script refuses non-loopback targets (`scripts/reliability/_guard.py`).
- **Load:**
  1. Start an API on a disposable PostgreSQL with rate limits lifted:
     `scripts/reliability/run_api_without_rate_limits.py PORT`.
  2. Run `FF_LEVELS=10,25,50,100 FF_NO_KEEPALIVE=1 python scripts/reliability/load_test.py http://127.0.0.1:PORT data/synthetic/golden`.
- **Browser scenarios:**
  1. Run a throwaway `nginx` container on port 8020, using the configs in `scripts/reliability/nginx/`
     (`active.conf` is the one in use).
  2. Run the API on 8016 with `DRISHTI_WEB_DIST` pointing at a fresh build.
  3. Run `python scripts/reliability/repro_failed_to_fetch.py …` against the live code (`main`), or
     `verify_failed_to_fetch.py` against the branch.

## Follow-ups (not done)

- Apply `infrastructure/nginx/canonical-origin.conf` on the host. This needs approval and a host nginx reload.
- Deploy the branch: rebuild the API and web images. No new migration in this change.
- Capacity: more API processes with PgBouncer, or profile and optimise `/graph`, `/analysis` and `/evidence/summary`.
- Swap on the host is full: review memory headroom.
