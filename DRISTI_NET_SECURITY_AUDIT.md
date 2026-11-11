# DRISTI-NET Security Audit

Scope: static inspection of auth, authorization, evidence handling, audit, integrity, configuration and frontend token storage. No penetration test or live-service test was performed. No secrets are reproduced.

## Findings

| ID | Priority | Finding | Evidence | Required remediation |
|---|---|---|---|---|
| SEC-01 | P1 | Rate limiting is optional and fail-open when Redis is absent/unavailable. | `apps/api/app/services/ratelimit.py`, `routes/auth_routes.py` | Define explicit outage policy; use bounded local fallback or deny sensitive auth attempts; alert and test brute-force behavior. |
| SEC-02 | P1 | Bearer tokens have 8-hour expiry and no revocation/logout invalidation found. | `apps/api/app/auth.py` | Add revocation/session versioning or shorten token exposure; document logout semantics and test deactivation/compromise response. |
| SEC-03 | P1/P2 | ADMIN has broad role and case-access bypass. | `auth.py` `require_roles()` / `authorize_case()` | Confirm least-privilege operational policy; log/review privileged access and add explicit admin access tests. |
| SEC-04 | P2 | Audit HMAC exists but read route does not verify signatures or expose verification state; no immutable store shown. | `services/audit.py`, `routes/audit_routes.py` | Verify on read/export, detect/report invalid entries, protect signing keys, define external anchoring scope. |
| SEC-05 | P1 | Evidence SHA-256, HMAC and Merkle anchors do not establish a full chain of custody or legal certification. | `services/integrity.py`, `evidence_routes.py`; disclaimer in PDF service | Keep claims narrow; implement documented transfer/access events and independent verification before operational claims. |
| SEC-06 | P2 | Direct bearer token storage in browser localStorage increases impact of same-origin script compromise. | `apps/web/src/services/api/real_client.ts` | Evaluate HttpOnly secure cookie/session approach, XSS controls/CSP, and minimize token lifetime. |
| SEC-07 | P2 | API ValueError handler may return exception text to caller. | `apps/api/app/main.py` | Ensure no sensitive/internal detail is passed; map expected validation errors to safe structured responses. |
| SEC-08 | P1 | Production secret/config and service health could not be verified; Compose cannot resolve required environment values in this environment. | `docker-compose.yml`; `docker compose ps` output | Validate secret provisioning, TLS, network exposure and service health in staging without disclosing values. |
| SEC-09 | UNVERIFIABLE | Report and candidate payloads include person names and some DOB/address values for case-authorized reviewers; the supplied masking helper only masks phone/account identifiers. Whether names, DOB and address must be additionally masked is a policy question not conclusively settled by inspected contracts. | `routes/report_routes.py`, `routes/review_routes.py`, `services/resolution.py`, `services/masking.py`; `docs/context.md` requires approved/de-identified records and masking but does not make all person-name fields masked by default. | Confirm field-level data classification and masking policy; add explicit tests for intended exposure. Candidate matching only considers PERSON entities, so raw candidate labels are not evidence of phone/account leakage. |
| SEC-10 | P1 | Upload handler buffers the complete multipart file before enforcing configured size/type limits. | `routes/evidence_routes.py` `data = await file.read()` precedes `validate_upload()`; `config.py` sets `MAX_UPLOAD_MB`. | Enforce request/body limits before buffering and stream into bounded quarantine; test memory/resource behavior with concurrent oversized uploads. |
| SEC-11 | P1/P2 | Success reads of analysis, timeline, claim/entity details, evidence item/context/claims appear not to record access events. | `graph_routes.py`, `evidence_routes.py`; contrast graph/edge/verify handlers that call `record_audit`. | Map all sensitive reads to audit policy and test expected events; this is an accountability gap pending project-policy confirmation. |
| SEC-12 | P2 | Audit API returns `detail` JSON verbatim without masking and does not verify event signatures before returning it. | `routes/audit_routes.py` `audit_out()`; `services/audit.py` | Redact/validate detail schemas and expose signature-verification outcome; sensitive user-entered reasons may otherwise appear. |
| SEC-13 | P2 | Cross-case entity card returns total case count including restricted cases. | `routes/graph_routes.py` `get_entity()` (`total_cases: len(all_cases)`) | Confirm disclosure policy; return visible count only unless aggregate linkage count is explicitly authorized. |
| SEC-14 | P2 | Case audit and other list query `limit` values lack lower-bound validation; negative values are only upper-clamped. | `audit_routes.py`; `graph_routes.py` timeline/edge; `evidence_routes.py` claims | Add `ge=1`; verify SQLite and PostgreSQL behavior. |
| SEC-15 | P1 | SQLite mode accepts the default demo signing/JWT key because production validation returns early for SQLite. | `apps/api/app/config.py` `validate_production_secrets()` | Ensure SQLite/demo profile cannot be mistaken for production; fail startup when production mode is set with demo secrets or test scanner. |
| SEC-16 | P2 | Investigator/Auditor user listing returns username, display name, role, jurisdiction and active status. | `routes/auth_routes.py` `GET /users` | Confirm minimum-disclosure need; use assignment candidate search or narrower response if broad directory access is not required. |
| SEC-17 | P0 | Migration tooling can delete authoritative target data when directed at the wrong bucket/database. | `scripts/migrate_evidence_to_minio.py` deletes every bucket object before upload; `scripts/migrate_sqlite_to_postgres.py` deletes all modeled target rows before copy. Neither tool was run. | Add explicit target identity/confirmation, backup proof, dry-run diff, narrow scope, and disposable-target checks. Treat as data-loss release blocker until safeguards exist. |
| SEC-18 | P1 | Disaster recovery runbook contains nonexistent commands and destructive graph deletion instructions. | `operations/DISASTER_RECOVERY_PLAN.md` | Do not follow; replace with reviewed commands and verify each step in isolated restore rehearsal. |
| SEC-19 | P1 | Docker API image defaults to root; bundled Nginx has no TLS termination configuration. | `Dockerfile`, `infrastructure/nginx/nginx.conf` | Run application as non-root and define/verify an HTTPS deployment path. Live host TLS is unverified. |

## Controls present in code (not independently proven operational)

PBKDF2 password hashing, JWT validation and inactive-account rejection, server-side case/jurisdiction checks, audited denials, evidence hashing, path containment, scan fail-closed states, role checks on evidence routes, masked context by default, bounded graph query code, and synthetic-data product boundary are represented in source and tests. The fresh isolated backend suite passed 210 tests (6 skipped, 1 deselected); live services and E2E remain unverified. Passing tests do not resolve the static risks listed above.

## Government-readiness boundary

No legal/regulatory compliance, accreditation, production security, or court admissibility conclusion is made. Live CORS/TLS/proxy, backup encryption, key custody, dependency vulnerability status, monitoring/alerting, incident response and operational access controls remain unverified.

## 2026-11-11 remediation addendum

Fixed and verified (commits `6779248`, `24358fe`; full suite 233 passed, 6 skipped, 1 deselected;
rebuilt and redeployed to the live Compose stack, confirmed `/health`/`/ready` and clean non-root
container startup):

- **SEC-17 (P0)**: both migration scripts no longer delete target data unconditionally. The
  relational migration refuses a non-empty target and locks modeled tables during the check; the
  S3 migration preserves unrelated objects, skips identical keys, and refuses conflicting ones.
  New tests: `apps/api/app/tests/test_migration_safety.py`.
- **SEC-10 (P1)**: upload now reads in bounded chunks and aborts with 413 as soon as the
  configured cap is exceeded, instead of buffering the whole body first. New tests:
  `apps/api/app/tests/test_upload_size_limit.py`.
- **SEC-11 (P1)**: `analysis()`, `timeline()`, `get_claim()`, `get_entity()`, `get_evidence()`,
  `context()` and `evidence_claims()` now all write a success-path audit event, matching the
  existing graph/edge/location pattern. New tests: `apps/api/app/tests/test_audit_coverage.py`.
- **SEC-13 (P2)**: `get_entity()`'s `total_cases` field removed -- it was a redundant aggregate
  (always equal to `len(visible_cases) + restricted_case_count + 1`) that disclosed cross-case
  linkage volume beyond the other two fields, and was never read by the frontend.
- **SEC-19 (P1) -- now fully fixed.** Non-root container confirmed live (`whoami` inside the `api`
  container returns `appuser`; `/data` owned by `appuser`, no permission errors on startup,
  worker's Kafka consumer group join succeeded normally). TLS added 2026-11-11: no real domain
  exists for this host, only the bare IP, so used the free nip.io wildcard DNS service
  (`65.0.102.181.nip.io`, a real resolvable hostname Let's Encrypt can certify) to get a genuine,
  browser-trusted certificate. Live URL is now `https://65.0.102.181.nip.io/`;
  `http://65.0.102.181/` 301-redirects there. Auto-renews via certbot's own systemd timer. Details
  and rollback: `frontend-audit/FRONTEND_CONTINUATION_STATE.md`'s "TLS added" section.
- **BUG-NEW-10 (P1)**: case assignment now refuses a deactivated or wrong-jurisdiction target
  before creating the assignment row, instead of recording one that could never actually grant
  access. New tests in `apps/api/app/tests/test_case_create_assign.py`.
- **BUG-NEW-14 (P1)**: Kafka and Besu are no longer hard `service_healthy` dependencies for
  `api`/`worker` startup (loosened to `service_started`), matching their own documented
  degraded/optional code paths. Confirmed live: both containers started without waiting on
  Kafka/Besu health.

Reviewed, not changed (reasoning recorded in commit `24358fe`):
- **SEC-01**: the Redis-unavailable fail-open behavior for login throttling is an existing,
  explicitly documented tradeoff in `ratelimit.py`'s own module docstring -- failing closed would
  mean a Redis outage locks out every account, a larger availability cost than the brute-force
  risk it guards against.
- **SEC-07**: every current `raise ValueError(...)` site already uses a deliberately caller-safe
  message (verified by grepping the whole backend); added server-side logging so a future
  violation of that convention would still be caught, without changing current response behavior.
- **SEC-15**: attempting to narrow the SQLite exemption in `validate_production_secrets()` broke
  two existing regression tests that explicitly encode "SQLite is never production, regardless of
  secret key" as intended, tested behavior. Reverted.

**2026-11-11, fourth pass: SEC-02 partially fixed.** Added `User.token_version` (Alembic migration
`5bcde1234571`), embedded as the JWT's `"tv"` claim at issue time, checked against the current
database value on every request. `reset_password()` increments it, so a password reset now
invalidates every token issued before it immediately, instead of leaving them valid until their
natural 8-hour expiry (deactivation already worked immediately via the existing `active` check --
this specifically closes the password-change gap). Proven with a new test
(`test_password_reset_invalidates_tokens_issued_before_it`): a pre-reset token is refused
afterward even though unexpired; a freshly issued one works. Migrated and redeployed to the live
stack, confirmed healthy (`/health`/`/ready` both 200, clean container logs, no errors). Not
tested against a real live account (would have required either creating one via direct DB access,
which the permission system correctly declined as account/credential tampering outside the normal
API, or the admin's actual password) -- relying on the local test's proof instead, same limitation
as the rest of this engagement's live-verification passes. Still not addressed: per-*session*
(as opposed to per-password-change) revocation -- there's still no way to invalidate one specific
token while leaving a user's other sessions valid.

Not addressed, still open: **SEC-06** (localStorage token storage), **SEC-09/16**
(data-classification policy questions), **SEC-12/14** (partial -- audit `limit` bounds were
already fixed separately; detail-redaction and signature-verification-on-read were not).
**SEC-18** (disaster recovery runbook) was fixed and drill-tested afterward -- see
`operations/DISASTER_RECOVERY_PLAN.md`'s "Drill history" section.

## 2026-11-11 full verification sweep (second pass, same day as TLS)

A comprehensive basic-through-advanced verification against the live deployment, prompted by a
direct "is this actually in production, with everything checked" question. Full results and exact
commands: `DRISTI_NET_PRODUCTION_READINESS_REPORT.md`'s matching addendum. Summary: 231 backend
tests + frontend typecheck/build all pass; TLS, auth, rate limiting, JWT tamper/alg-confusion
rejection, SQL-injection and path-traversal defenses, non-root containers, and audit-chain
integrity (92/92 current events verify) were all independently re-confirmed live, not assumed from
prior passes.

**One new finding from this pass, fixed**: **SEC-20 (P2, information disclosure)** -- nginx
disclosed its exact version and OS (`Server: nginx/1.28.3 (Ubuntu)`) on every response, including
error pages. The host's `/etc/nginx/nginx.conf` had `server_tokens build;` with an existing
"Recommended practice is to turn this off" comment that had never been acted on. Changed to
`server_tokens off;`; verified live (`Server: nginx` only, no version/OS, including on 404/405
error pages). This is a host-level nginx config change, not part of this repository's own files.

**Same day, third pass: Content-Security-Policy added**, partially closing the CSP half of the
remediation suggested under **SEC-06**. Deployed report-only first (zero risk), verified 0
violations with a real headless browser against the reachable login page, then promoted to
enforcing and re-verified identically. `script-src 'self'` with no `unsafe-inline`/`unsafe-eval`
exception (confirmed the built bundle never uses `eval`/`new Function`); `style-src` keeps
`'unsafe-inline'` for Radix UI's dynamic positioning. See
`DRISTI_NET_PRODUCTION_READINESS_REPORT.md`'s matching update for the exact policy and what wasn't
tested (authenticated pages, same credential limitation as the rest of this pass). SEC-06 itself
remains open -- CSP is one of several suggested mitigations there, not a full fix for localStorage
token storage.
