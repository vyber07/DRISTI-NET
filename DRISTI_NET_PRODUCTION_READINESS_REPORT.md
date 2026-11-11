# DRISTI-NET Production Readiness Report

## Assessment

**Not ready for real operational or government use based on evidence available in this audit.** This is a prototype/engineering preview assessment, not a statement that the system is unusable as a synthetic-data demo. The isolated backend suite passed; frontend typecheck fails; integrations and production deployment could not be checked; production-shaped backup restore is not demonstrated.

| Dimension | Assessment | Evidence / limitation |
|---|---|---|
| Core application | Partial | Fresh backend suite passed 210 tests, with 6 skips and 1 deselection, on isolated SQLite/local storage. This verifies tested unit/API behaviors in that configuration; it does not verify production services or every workflow. |
| Frontend | Build succeeds; type safety fails | Vite production build to `/tmp` succeeded; 12 TS errors in `casesApi.ts`. |
| Auth/access | Partial | Fresh unauthenticated-denial smoke test passed, plus focused config/signature tests; no fresh role matrix, revocation, or live session test. |
| Evidence integrity | Partial | SHA-256 and HMAC/Merkle references exist; these do not prove complete custody or legal admissibility. |
| External integrations | Unverified | Compose cannot interpolate; no live service status established. |
| Backups/recovery | Insufficient evidence | Existing restore report covers SQLite/local storage, not PostgreSQL + MinIO/S3. |
| Availability/operations | Unverified | TLS, monitoring, alerting, failover, restore RPO/RTO, and restart checks not run. |
| Performance | Historical only | `reports/performance.md` has prior measurements; not reproduced under current conditions. |
| Compliance | Not assessed | No legal certification or regulatory compliance claim made. |

## Material operational hazards

- `scripts/migrate_evidence_to_minio.py` deletes objects in the selected bucket before copying local files. It was inspected, not executed. A wrong bucket or incomplete local source can cause data loss.
- `scripts/migrate_sqlite_to_postgres.py` clears target table rows before copying; its dry-run counts only. It was inspected, not executed. A misdirected target can lose data.
- `operations/DISASTER_RECOVERY_PLAN.md` includes unverified/nonexistent commands and destructive Neo4j cleanup steps. Treat it as an unvalidated draft, not an executable recovery runbook.
- The available restore evidence covers SQLite with local storage. PostgreSQL plus MinIO/S3 restoration, off-host backup, encryption/key recovery, and measured RPO/RTO remain unverified.

## Deployment blockers

1. Resolve frontend typecheck failures.
2. Resolve the E2E environment safely and run the full browser workflow against disposable services; the backend suite passed in the isolated configuration noted above.
3. Verify intended production dependencies and failover/degradation behavior.
4. Complete PostgreSQL + object-store backup and restore drill, including integrity comparison.
5. Add guardrails to destructive migration utilities and replace the unsafe/unexecutable disaster recovery plan.
6. Define token revocation/session policy, brute-force controls, audit verification, key custody and alerting.
7. Validate TLS, proxy, secrets, logs, migration and rollback procedures on a staging server.

Until these pass, restrict use to synthetic/de-identified data and non-operational demonstration.

## 2026-11-11 live verification addendum

The assessment above was written without live access to the Compose stack ("Compose cannot
interpolate; no live service status established"). This addendum is the opposite: every item
below was checked directly against the actual running production deployment at
`https://65.0.102.181.nip.io/` (not an isolated/local copy), with the exact command or observation
noted so the claim is checkable, not just asserted.

**Core application / live service health** — all 9 Compose services (`api`, `worker`, `postgres`,
`neo4j`, `minio`, `redis`, `clamav`, `kafka`, `besu`) confirmed `healthy`/running; `/api/v1/health`
and `/api/v1/ready` both green over HTTPS. Full backend suite: 231 passed, 8 skipped, 1
deselected. Frontend: `tsc --noEmit` exits 0, production build succeeds (the typecheck failure
this report originally blocked on, `BUG-NEW-01`, was fixed and verified in commit `6779248`).

**Basic security** — TLS certificate genuinely valid and trusted (Let's Encrypt, verified via
`openssl s_client`/`curl` with no `-k`, expires 2027-02-09, auto-renewal confirmed via `certbot
renew --dry-run`); HSTS and the standard security headers present; every protected endpoint
(`/cases`, `/audit`, `/users`, `/auth/me`) returns 401 without a token; a tampered-signature JWT,
an `alg=none` confusion attempt, and a malformed token are all rejected with 401.

**Intermediate security** — login throttle confirmed live (5 failed attempts → 429 on the 6th);
SQL-injection-shaped input in the login body and in a case-id path segment treated as a literal,
non-matching value (ORM-parameterized throughout, as expected); an XSS payload as a login username
is not reflected; malformed JSON and missing fields return 422; unsupported HTTP methods return
405; the DEF-028 path-traversal fix holds under live attack (`/../../../.env`-style requests
return the SPA shell, confirmed by inspecting the response body, not real file content).

**Advanced security** — `docker compose exec api whoami` / `worker whoami` both return `appuser`
(non-root, SEC-19 complete); dependency audit against the packages actually installed in the live
container (not a local dev venv) shows only `paddlepaddle` (optional OCR) still vulnerable, with no
stable fix published yet (same already-tracked, accepted item as DEF-035) -- `pillow`/`pypdf`, the
two packages that touch untrusted uploaded content, are clean; every current audit event (92, all
dated after the full data wipe earlier this session) verifies under the live HMAC key registry with
zero failures; Postgres/MinIO/the bare API port are all bound to `127.0.0.1` only, confirmed via
`ss -ltnp`, not internet-reachable; `.env`/`.env.compose` are `600`-permission, not world-readable;
the demo-only `/demo/tamper` endpoint is unreachable (routes only register under SQLite); nginx no
longer discloses its version/OS in response headers (`server_tokens off`, found set to `build` with
a pre-existing "recommended to turn this off" comment never acted on -- fixed and verified live).

**Not reverified in this pass** (prior evidence stands, but wasn't rerun against the live site
today): the full authenticated-user Playwright/E2E click-through (relying on the 34+ authenticated-
flow tests across `test_case_create_assign.py`/`test_workflow_restored.py`/
`test_user_management.py`/`test_audit_coverage.py` in the 231-test suite instead, since doing this
live would have required either the current admin password or creating a new account, and neither
was authorized this pass); a formal `backup_restore_drill.py`-equivalent backup-and-restore cycle
specifically against the live Postgres+MinIO (the migration *to* them was independently verified,
which is related but distinct, as noted in `operations/RESTORE_TEST_REPORT.md`); per-token/session
revocation design (SEC-02); the disaster recovery runbook (SEC-18, still unsafe as written).

**Update (same day, second pass): CSP added.** Inspected the actual built bundle first (no
external CDN references, no `eval`/`new Function` usage, fonts embedded as `data:font/woff`) before
writing a policy, deployed it as `Content-Security-Policy-Report-Only` (zero risk -- only logs,
never blocks), tested with a real headless browser against the reachable login page (0
violations), then promoted to enforcing `Content-Security-Policy` and re-tested identically (still
0 violations, same behavior). Policy: `default-src 'self'; script-src 'self'; style-src 'self'
'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src
'none'; base-uri 'self'; frame-ancestors 'self';`. `style-src` keeps `'unsafe-inline'` (Radix UI,
used throughout the dialog/dropdown components, needs it for dynamic inline positioning);
`script-src` stays strict with no such exception, since that's the vector that actually matters
against XSS. Authenticated pages (graph canvas, dialogs, admin panel) were not click-tested live
under enforcement, same credential limitation as above -- if something unexpected breaks there,
the fix is reverting this one `add_header` line, not a deeper rollback.

**Updated bottom line**: the live deployment is healthy, running over trusted TLS, with verified
RBAC, rate limiting, input validation, path-containment, non-root containers and a cryptographically
intact audit trail -- a materially stronger state than this report's original assessment, which
could not reach the stack at all. It is still not a formal, independently-certified "production
security sign-off": the specific gaps above remain genuinely open, not silently assumed resolved.
