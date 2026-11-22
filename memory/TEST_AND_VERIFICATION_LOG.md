# DRISTI-NET test and verification log

Updated: 2026-11-13

Newest entry first.

## 2026-11-12

- Backend unit suite: 231 passed, 8 skipped, 1 deselected (real-ClamAV scan test, also excluded by `make test`), 0 failed. Run completed after the earlier report.
- Frontend build and type check: both clean.
- Isolated copy of demo data on port 8003 (not the live site): browser walkthrough 16 of 16 passed; page sweep of 96 loads across six roles with no console or API errors; graph 56 entities and 117 relationships; locations view 5 places.
- Isolated copy, access control: audit and user-admin pages denied to wrong roles; unassigned and outsider users denied the case; analysts cannot upload or decide.
- Isolated copy, evidence: upload, hash verification, exact-byte download and context reveal work; EICAR test file detected and quarantined; `.exe` uploads refused.
- Isolated copy, review and integrity: review decisions, entity reveal, timeline, patterns, contradictions, JSON and HTML reports, court PDF, integrity anchor with Merkle proof and tamper detection work. Admin create, edit, reset password, deactivate and reactivate user work; case creation and assignment work.
- Limit found: arbitrary CSV files that match no known layout upload and scan, then fail with "no extractor for record type 'csv-generic'".
- Not exercised: blockchain anchoring. The isolated copy reported anchor status `LOCAL_ONLY`; the live stack has Besu but was not tested without login.
- Open finding: any logged-in user can list all users with their roles. May be intended for the assign dialog; an investigator currently receives the full list.
- Still open: backend suite result is the only item outstanding from the earlier partial report, now closed.

- Login rate limiting (branch `worktree-auth-login-ratelimit`, commit 386ff52, revision 2 of ADR-012): rate-limit suite `test_ratelimit.py` 36 passed, none skipped, against a scratch redis-server, repeated three times with no flakiness. Full API suite 265 passed, 7 skipped, 0 failed. Frontend maps 429 and 401 to fixed messages; oversized login input now returns 422, shown as raw validation text (cosmetic). Not verified on the live Compose stack: nginx `X-Forwarded-For` pass-through, and 429 display in a browser. Per-process counters weaken limits during a Redis outage with multiple workers.

- Audit logging (branch `worktree-auth-login-ratelimit`, commit c74a1cd): full API suite 299 passed, 7 skipped on SQLite; 301 passed, 5 skipped on a disposable PostgreSQL 16 container (throwaway, no volume, removed afterwards). Audit test file 34 passed.
- Alembic chain of 10 revisions applied cleanly on that PostgreSQL container. Downgrade and re-upgrade cycle worked; head `5bcde1234572`. Append-only triggers blocked UPDATE, DELETE and TRUNCATE there, and a signed row still verified afterwards.
- Found and fixed during the run: best-effort reads only flushed and never committed, so audit rows were lost; signing failures could also break reads. Test schema reset created tables without the append-only triggers; a shared installer now adds them for both dialects.
- Not verified: the live Compose stack, browser behaviour of the audit pages, and nginx forwarded-header handling. Open finding carried over: any logged-in user can list all users with roles.

- Audit logging end-to-end check on an isolated instance (branch `worktree-auth-login-ratelimit`, after the fix below): `scripts/audit_e2e_check.py` 24 of 24 HTTP checks passed against a disposable PostgreSQL 16 container, a loopback-only API on port 8011 and a scratch Redis. Covers login client IP, sanitised user agent, ignored spoofed trace ID, password absent from audit rows, role denials, logout and token rejection, 39 signatures verified, digest and CSV export, and Redis-backed lockout. The case trail was empty because the isolated database holds no evidence, so it did not show network fields.
- Found and fixed during that run: token-rejection audit rows had no session ID. The session is now attached once it is confirmed to belong to the user; unknown session IDs are never recorded.
- SQLite suite after that fix: 296 passed, 10 skipped (skips rose because the test Redis was stopped). Not verified on the live Compose stack or in a live browser.

- Features-docs task (branch `worktree-features-docs-update`, commit 0725dc5, not pushed): at commit 6779248, backend suite 221 passed, 7 skipped, 1 deselected; frontend typecheck exit 0; frontend build succeeded; browser workflow 16 passed on a throwaway instance (port 8003, temp DB and storage); secret-scan test over the edited docs passed. Skips are the live PostgreSQL, Neo4j and MinIO tests.
- Main at ac5a57e (checked during the project-report task): backend suite 231 passed, 9 skipped, 1 deselected. Browser run not repeated on that commit.
- Uncommitted changes in the main checkout (upload size bounding, access-audit records on four read routes, entity-card field removal, non-root Docker user): one run gave 224 passed, 6 skipped, 1 deselected. Files changed during the run, so it covers only the upload-size tests. Not verified.

- Masking and reveal policy (branch `worktree-auth-login-ratelimit`, commit 82d40d2): a sweep across case read endpoints and reports, for all roles, found no raw phone or account value in non-reveal responses. A strict full-digit check and a positive control (raw-download route) were added and pass. Before the fix, raw `address` and `dob` values were returned on candidates, graph nodes, claims, evidence claims and matcher signals to every role that could read the case, including ADMIN and AUDITOR. Login 422 bodies echoed the submitted password; input echo is now removed. A migration nullability mismatch was caught by the existing migration test and fixed (PostgreSQL). Frontend type check passes. Not verified in a browser or on the live stack; the review page has no attribute-reveal button yet.

- Masking authorisation review (branch `worktree-auth-login-ratelimit`, commit 82d40d2, re-checked this session without new changes): the session reported 44 authorisation tests (including IDOR and forged role claims), leak sweeps across 8 roles, and error-message tests, all passing on SQLite and PostgreSQL. These counts come from the session summary and were not re-run here. The authorisation model is documented in `docs/MASKING_AUTHORIZATION.md`. Not verified in a browser or on the live stack.

- Permission overrides (branch `worktree-auth-login-ratelimit`, commit b0a452c): 47 override tests covering conflicting permissions, expired and revoked overrides, unauthorized creation, self-approval, cross-case scope, and API and database bypass attempts. Full suite: 400 passed on SQLite; 402 passed on a disposable PostgreSQL 16 container, including a migration downgrade and re-upgrade. Browser check: 16 checks on an isolated instance, covering navigation per role, creator unable to approve, UI override creation, and approval by a second admin. Not verified on the live Compose stack; nothing deployed.

- Upload limits and file validation (branch `worktree-auth-login-ratelimit`, commit 592d0ca): 41 new upload tests in the session summary; full suite 441 passed on SQLite and 443 passed on PostgreSQL. Frontend type-check and build were run; `nginx -t` passes with the repo config. A NUL byte in a rejected file name broke the PostgreSQL audit write (fixed). Not verified in a browser or on the live stack; nothing deployed.

- Live "Failed to fetch" investigation (branch `worktree-auth-login-ratelimit`, commit 3a1efae, pushed to origin; not merged or deployed): SQLite suite 453 passed; PostgreSQL suite 455 passed; the connection-release test fails when the release is disabled. Browser checks 8 of 8 on isolated copies (HTTP-to-HTTPS redirect of open tabs, offline and reconnect, busy server). Load at 50 users: median 30.6 s with 12 failures on the previous code, 2.2 s with no failures on the branch. At 100 and 150 users one API process still returned busy 503 responses (25 and 80). The live site and database were read only. Not verified on the live stack.

- User request module (commit 62a7ee5): 33 request tests passed three times in a row on PostgreSQL 16. Full suite: 486 passed on SQLite; 488 passed, 6 skipped, on PostgreSQL 16. Migration upgrade, downgrade and re-upgrade clean on PostgreSQL. Browser walkthrough 9 of 9 on a rebuilt bundle with reset data. Notifications are in-app only. Not verified on the live Compose stack; nothing deployed.

- P1.2 manual user ID allocation (branch `worktree-auth-login-ratelimit`, commit 349f18f): 29 new tests pass, covering concurrent assignment (one winner), retired-ID reuse, corrections, and direct-SQL tampering with history. Full backend suite on SQLite: 510 passed, 12 skipped, 0 failed. Browser check in Chromium: 12 of 12 on an isolated server at port 8003 with a fresh store. Not verified on PostgreSQL in this entry, on the live Compose stack, or after deployment.

- P1.3 admin case assignment (commit 4af28f9, pushed; not merged or deployed): 17 new assignment tests pass, including the exact event order across both handovers; concurrency tests repeated 5 times with stable results. Existing case, request, override and graph assignment tests: 7 of 7 pass. PostgreSQL run: 182 passed, 1 skipped (skip not yet identified in the session). Browser walkthrough 21 of 21 in Chromium on an isolated server with a fresh store. Migration backfill was planned for PostgreSQL but its result is not recorded in the excerpt. Not verified on the live Compose stack.
- Seed-data finding (isolated store): 46 of 48 cases are flagged for primary-jurisdiction mismatch; only CASE-0001 and CASE-0002 are not. Count checked against the store, not estimated from screenshots.

- P1.4 graph loading/rendering (isolated server, disposable Neo4j; live site not touched): live Neo4j tests passed 14/14 three times with no deadlock messages. Graph test file: 39 passed on SQLite and 47 passed against live Neo4j, including exact order equality between Cypher and in-process ranking. New test file has 13 tests (9 run everywhere, 4 against live Neo4j). Layout overlap on CASE-0001 went from 118 pairs to 0. Browser walkthrough script with pass/fail assertions added for populated, small, large, empty and forbidden cases, case switch and list view. Lint: one existing warning in untouched code. Not verified: production deployment, the deployed site's behaviour after this change.

### 2026-11-13: P1.5 graph full-screen (frontend, isolated server on throwaway store)
- Browser verification in Chromium: 27/27 passed. Covered zoom/selection/filter retention, no extra graph requests, control layout at desktop, 820x1180 and 390x844, reveal dialog inside full screen, Esc, F to exit, and browser-window fallback. No page errors.
- Negative check: with the dialog portal fix removed, the reveal dialog opened but was invisible, and the test failed. So the test does catch that regression.
- Regression: P1.4 graph walkthrough 16/16; user-ID dialog 12/12; case-team dialog 21/21.
- Not run: backend suites (no backend change). No deployed or live-host check. Neo4j not used.

### 2026-11-13: P2.1 UI/UX redesign audit and fixes (commit b3ead04, pushed, not deployed)
- Sweep: 42 route views at desktop and phone width via `scripts/reliability/ui_audit_sweep.mjs` on a local server (:8003, same store as baseline). Before to after: axe violations 8 to 0; pages missing a main heading 6 to 0; visible text under 12 px 8,624 to 0; non-standard colours 47 to 0; `window.confirm` pop-ups 3 to 0; horizontal overflow or page errors 0 to 0.
- Walkthroughs: graph 16/16; graph full screen 27/27; user-ID and case-team walkthrough 22/22 on a fresh seeded store.
- Type check passed. Lint of changed frontend files was run; result not shown in the session excerpt.
- Not verified: live host, other browsers, real case data.

### 2026-11-13: P2.2 sidebar improvements (commit 489f286, pushed, not deployed)
- Sidebar check (scripts/reliability/verify_sidebar.mjs): 28/43 before changes, 44/44 after, across six roles at desktop and phone width, including a new icon-contrast assertion (9.8:1 collapsed, 14.8:1 current page).
- Every link opened for every role; open phone menu had no axe violations.
- Regressions passed: audit sweep 42 page views clean, graph 16/16, full screen 27/27, user IDs 12/12, case team 22/22.
- Type check and lint clean for changed files. Not verified on the live host.












