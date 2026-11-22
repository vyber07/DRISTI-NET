# Test record: "Failed to fetch" and page-failure investigation (2026-11-11 to 2026-11-12)

Branch `worktree-auth-login-ratelimit`. Every test ran on isolated ports with disposable stores. The live demo, its
database and its nginx were only read (logs, headers, bundle), never changed or restarted.

## 1. Live evidence (read-only)

| Check | Observation |
|---|---|
| Containers | Healthy; no restarts and no OOM kills. Swap 2043/2047 MB used; about 3.2 GB RAM available. |
| Host nginx config | Port 80 sends `301 https://65.0.102.181.nip.io$request_uri` (added about 11:53, 2026-11-11). The 443 nip.io server proxies to 127.0.0.1:8001 with `proxy_read_timeout 120s` and CSP `connect-src 'self'`. The bare-IP 443 default server is another application. |
| nginx access log, 2026-11-11 12:06 | `GET /api/v1/auth/me` and `GET /api/v1/cases` with `Referer: http://65.0.102.181/command-center` received `301`. These are tabs from before the switch. |
| nginx error log | 16,760 `connect() failed (111)` against the old host API on :8000 in October (15,444 of them on 2026-10-24); 4 on 2026-11-11. Historical. |
| Access log, last 2 days | No DRISTI 5xx (low traffic, so the load-related failure was not triggered). |
| Live bundle | `index-DyCrdnNy.js`, API base `/api/v1`. `index.html` has no `Cache-Control`. `HEAD /` returns 405. |

## 2. Browser reproduction with the live code (`main`, bundle byte-identical to live)

Script `scripts/reliability/repro_failed_to_fetch.py`, Playwright Chromium, throwaway nginx on 8020.

| Scenario | Result |
|---|---|
| A: origin switched to a cross-origin 301 while the tab is open | **Reproduced:** "Could not load this information / Failed to fetch". Console: "blocked by CORS policy (redirected from …)". |
| B: session revoked during a multi-request page | Not a cause: clean redirect to "Your session expired". |
| C: offline during navigation, then back online | **Reproduced:** raw "Failed to fetch", no recovery after reconnecting. |
| D: stale `index.html` after a redeploy | Not reproduced. |

## 3. Load reproduction and root-cause proof

Script `scripts/reliability/load_test.py`, PostgreSQL 16 container, synthetic evidence ingested, 30 s per step.

- **`main`:**
  - 10 users: p50 0.15 s.
  - 25 users: p50 0.65 s, p95 2.4 s.
  - **50 users: p50 30.6 s, 12 × 500.**
  - Log: `QueuePool limit of size 5 overflow 10 reached, connection timed out, timeout 30`.
- **Hypothesis 1, refuted:** "the sync `get_db` teardown starves the thread pool". With an async `get_db` alone there
  were still 34 × 500 and 39 read timeouts.
- **py-spy dump** during the stall: all 40 worker threads in `Condition.wait` under `current_user (auth.py:55)`,
  waiting on the pool.
- **Experiment 2 (`main` + commit at the end of `current_user`):**
  - 50 users: p50 1.99 s, no 500s. The collapse is gone, which confirms the cause.
  - 100 users: 26 × 500. The pool was still undersized, with a 30 s timeout.

## 4. Branch verification

**Unit and integration tests**
- `apps/api/app/tests/test_reliability.py`: 12 passed, 1 skipped (SPA shell test: no web build in the test
  environment, covered by browser scenario D).
- The connection-release test was checked by running it with `release_connection` disabled. It then sees an open
  transaction, so it would catch a regression.
- Full suite: SQLite **453 passed**, 8 skipped. Disposable PostgreSQL 16 **455 passed**, 6 skipped. 1 deselected:
  the real-ClamAV test, which needs clamd.
- Three login-equality tests in `test_ratelimit.py` now compare bodies without the per-request IDs. Those IDs must
  differ between responses, and the tests still assert that every other field is identical.
- Frontend: `tsc -b --noEmit` clean; `vite build` succeeds.

**Browser** (`scripts/reliability/verify_failed_to_fetch.py`, branch API and bundle on 8016, nginx on 8020): **8 of 8 passed**

| Scenario | Result |
|---|---|
| A1: cross-origin 301, client fix alone | "Cannot reach the DRISTI-NET server…", no raw "Failed to fetch" |
| A2: with the recommended nginx 421 | The tab moves to the canonical origin's sign-in page; no error |
| B: revoked session | `/login?expired=1&next=/command-center`; 0 error panels seen during the redirect |
| C1: offline | Offline banner and a plain message |
| C2: back online, no user action | Evidence list loads by itself; no error text left |
| E: two transient 503s on the case list | Loads after 3 attempts; no error shown |
| F: persistent 503 | "The service is busy…" with "Request ID: REQ-busy-demo" |
| D: caching | Shell `no-cache`; assets `public, max-age=31536000, immutable`; `HEAD /` returns 200 |

**Load (branch, PostgreSQL 16)**

| Users | Intermediate (keep-alive client) | Final code (new connection per request) |
|---|---|---|
| 10 | p50 0.15 s, no errors | — |
| 25 | p50 0.76 s, no errors | — |
| 50 | p50 2.5 s, no errors | p50 2.2 s, p95 5.9 s, no errors |
| 100 | p50 7.1 s, 1 connection reset | p50 6.4 s, 25 × 503 `BUSY` |
| 150 | p50 10.8 s, 14 connection errors | p50 25.4 s, 80 × 503 `BUSY` (148 × 503 before function-scoped sessions) |

Server log for the final run: 0 pool deadlocks and 0 unhandled 500s. Every overload response was a 503 with
`Retry-After`, logged with its request ID.

## 5. Not verified

- **Not deployed:** behaviour on the live host is inferred from the identical bundle, the logs and the isolated runs.
- **Host-nginx 421:** tested only in a throwaway nginx, not on the host.
- **Capacity:** about 100 concurrent active users per API process is the measured ceiling. More processes were not
  tested.
