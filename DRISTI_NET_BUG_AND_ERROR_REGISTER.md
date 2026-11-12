# DRISTI-NET Bug and Error Register

Freshly reproduced this audit: frontend typecheck failure. Other items are historical documented defects or audit observations and are not labeled BUG REPRODUCED unless re-run here.

| ID | Status | Severity | Evidence / reproduction | Impact and action |
|---|---|---|---|---|
| BUG-NEW-01 | BUG REPRODUCED | P1 | Run `npm run typecheck` in `apps/web`; fails with 12 errors at `src/services/api/casesApi.ts:6-18` (`{}`/`unknown` incompatible with expected fields). | Type contract broken; correct API mapper/raw shape and rerun. |
| BUG-NEW-02 | BUG NOT REPRODUCED | P2 | Initial sandbox execution stalled under local transport restrictions. The full suite was then run with approval against isolated SQLite/temp storage: 210 passed, 6 skipped, 1 deselected in 93.50s. | The sandbox stall was environmental and the suite-level problem was not reproduced in the approved run. Skips/deselection and live integration limitations remain in the test report. |
| BUG-NEW-03 | UNVERIFIABLE | P2 | Audit blocker, not a product bug: `docker compose ps` fails interpolation because required environment variables are unavailable to Compose here. | Cannot inspect current running stack or service health. Verify in staging using approved secret provisioning; do not print values. |
| BUG-NEW-04 | IMPLEMENTED — PARTIAL | P1 | Static code path: `evidence_routes.upload()` calls `await file.read()` before `validate_upload()` applies the configured upload cap. | Oversized authorized requests can be buffered before app-level rejection. Add streaming/body-size controls; concurrency runtime test not performed. |
| BUG-NEW-05 | UNVERIFIABLE | P2 | Static code path: `report_routes.export_report()` writes candidate PERSON labels raw; `resolution._persons_in_case()` restricts candidate sides to `Entity.kind == "PERSON"`, so this does **not** establish phone/account masking bypass. Candidate payloads may also include DOB/address conflict values. | Clarify whether names/DOB/address require masking for approved/de-identified case members; add tests to lock down policy. Runtime export not exercised here. |
| BUG-NEW-06 | IMPLEMENTED — PARTIAL | P1/P2 | Static route inspection: several successful sensitive reads have no apparent `record_audit()` call. | Access history may be incomplete. Confirm policy and add assertions for all routes. |
| BUG-NEW-07 | IMPLEMENTED — PARTIAL | P2 | `audit_routes.py` returns `AuditEvent.detail` unchanged; `limit` not lower-bounded. | Possible disclosure of user-entered sensitive reasons and inconsistent negative-limit behavior. Add schema redaction/validation and bounds. |
| BUG-NEW-08 | IMPLEMENTED — PARTIAL | P2 | `graph_routes.get_entity()` returns `total_cases=len(all_cases)` while hiding case IDs unavailable to caller. | May leak restricted cross-case linkage volume; resolve through data-disclosure policy. |
| BUG-NEW-09 | IMPLEMENTED — PARTIAL | P2 | `review_routes.hitl_stats()` sets `identityMergesCount` equal to total candidates. | Incorrect dashboard metric can mislead analysts; compute accepted merges or rename. |
| BUG-NEW-10 | IMPLEMENTED — PARTIAL | P2 | `case_routes.assign()` checks target username exists but not active status or target jurisdiction. | Invalid assignment may be recorded and later fail access checks. Add target eligibility validation. |
| BUG-NEW-11 | IMPLEMENTED — PARTIAL | P0 | Static review of `scripts/migrate_evidence_to_minio.py`: deletes every object in selected bucket before upload; no dry-run/confirmation. | Wrong bucket or incomplete source can destroy unrelated/authoritative objects. Do not run; add backup/target/prefix safeguards and test only in disposable bucket. |
| BUG-NEW-12 | IMPLEMENTED — PARTIAL | P0 | Static review of `scripts/migrate_sqlite_to_postgres.py`: without `--dry-run`, deletes all target rows across modeled tables before copying source. No target-disposable confirmation. | Mispointing at non-disposable target replaces data. Do not run absent verified backup, target identity and explicit change approval. |
| BUG-NEW-13 | UNVERIFIABLE | P1 | `operations/DISASTER_RECOVERY_PLAN.md` is target/not tested; includes nonexistent API/CLI commands and destructive Neo4j deletion guidance. | Runbook unsafe/unusable as written; replace and test against isolated restore. |
| BUG-NEW-14 | IMPLEMENTED — PARTIAL | P1 | `docker-compose.yml` makes Kafka and Besu health hard dependencies despite optional/degraded app paths. | A non-core dependency outage can prevent stack startup; add profiles and degraded-mode checks. |
| BUG-HIST-01 | UNVERIFIABLE | P1 | E2E fixture in `tests/e2e/test_ui_demo.py` directly resets candidate states in DB and creates screenshots under `reports/screenshots/`; safe isolated server unavailable. | E2E not rerun. Use explicit disposable DB/server before tests. |
| DEF-HIST-02 | UNVERIFIABLE | P1 | Earlier issues DEF-085/088/091 in `audit/BUG_AND_DEFECT_REGISTER.md` report Merkle encoding, Postgres TZ/HMAC, ambiguous signature payload; fixes and tests are documented but not rerun now. | Preserve as historical fixed claims pending current regression and live PostgreSQL signature check. |
| DEF-HIST-03 | UNVERIFIABLE | P1 | DEF-090 reports cross-case person-id merge and documented case-scoping fix; not retested here. | Rerun synthetic regression; high identity integrity consequence. |
| DEF-HIST-04 | UNVERIFIABLE | P1 | DEF-101 is cited in E2E source regarding masked original download restrictions, not exercised here. | Validate backend and UI role behavior in safe E2E. |
| BUG-HIST-05 | UNVERIFIABLE | P2 | `frontend-audit/FRONTEND_PAGE_INVENTORY.md` contains old dead controls and false states; frontend agent found multiple current rewrites, so old claims are stale until re-audited. | Do not copy prior defect list as current; rerun focused interaction review. |

Historical defect register is extensive (DEF series in `audit/BUG_AND_DEFECT_REGISTER.md`) and includes resolved and open items. Newly identified items above are source-level findings, not runtime reproductions; status wording reflects that distinction. This report does not relabel all historical entries as current defects.

## 2026-11-10 verification addendum

- **BUG-NEW-01 — fixed and verified locally.** The `BackendCase` raw response type and explicit `get`/`getPaged`/`post` generics were added in `apps/web/src/services/api/casesApi.ts`. `npm run typecheck` now exits 0; `npm run build` succeeds. Existing case-create API test passed for invalid and valid input. The API contract is tied to `apps/api/app/schemas.py::CaseOut`; this remains compile-time typing, not runtime response validation.
- A fresh isolated Playwright run passed 16/16 before this type-only change. The case-create API test and production build/typecheck passed after it. The first E2E attempt was misrouted to the running local demo; possible synthetic case/audit side effects and the absence of cleanup are documented in `docs/audit/TEST_EXECUTION_BASELINE_2026-11-10.md`.
- **BUG-NEW-11 / BUG-NEW-12 — destructive migration behavior remediated in source.** S3 migration now preserves unrelated objects, skips matching keys, rejects content conflicts, and uses conditional creates. Relational migration refuses a nonempty target instead of deleting rows and locks PostgreSQL tables during import. Four mock/temp success/failure tests pass; full `make test` is 214 passed / 6 skipped / 1 deselected. Provider/PostgreSQL integration remains unverified, so do not run against a data-bearing target.

## 2026-11-11 remediation addendum (commits `6779248`, `24358fe`)

Rebuilt and redeployed to the live Compose stack after these; confirmed `/health`/`/ready` and a
clean non-root container startup with no permission errors.

- **BUG-NEW-04 / SEC-10 — fixed.** `evidence_routes.upload()` now reads the body in bounded
  chunks via a new `_read_bounded()` helper and aborts with 413 as soon as the configured
  `MAX_UPLOAD_MB` cap is exceeded, instead of buffering the whole file before `validate_upload()`
  ever runs. Tests: `test_upload_size_limit.py`.
- **BUG-NEW-06 / SEC-11 — fixed.** Seven previously-unaudited success-path reads (`analysis`,
  `timeline`, `get_claim`, `get_entity`, `get_evidence`, `context`, `evidence_claims`) now each
  write an audit event. Tests: `test_audit_coverage.py`.
- **BUG-NEW-08 / SEC-13 — fixed.** Dropped the redundant `total_cases` field from `get_entity()`'s
  response (confirmed unused by the frontend); it disclosed aggregate cross-case linkage volume
  beyond the two fields that remain.
- **BUG-NEW-10 — fixed.** `case_routes.assign()` now refuses a deactivated or wrong-jurisdiction
  target with a 400 before creating the `CaseAssignment` row. Tests added to
  `test_case_create_assign.py`.
- **BUG-NEW-14 — fixed.** `docker-compose.yml`'s `api`/`worker` services no longer require Kafka
  and Besu to be `service_healthy` before starting (loosened to `service_started`), matching the
  app's own documented degraded paths for both. Verified live: both containers started without
  waiting on Kafka/Besu health checks to pass.
- Dockerfile now runs the application as a non-root `appuser` (SEC-19, partial -- TLS is the
  other half, left open for the owner's decision). Verified live via `docker compose exec api
  whoami` → `appuser`, and `/data` owned by `appuser` with no permission errors.
- **BUG-NEW-03 / SEC-08 (Compose interpolation blocker)** — this was an audit-environment
  limitation, not a product defect: the prior pass had no access to `.env.compose`'s secrets. The
  live Compose stack was independently verified running and healthy throughout this session.

## 2026-11-12 case-assignment addendum (branch `worktree-auth-login-ratelimit`)

| ID | Status | Severity | Evidence / reproduction | Impact and action |
|---|---|---|---|---|
| BUG-NEW-11 | BUG REPRODUCED (data, pre-existing) | P2 | `GET /case-assignments?attention=true` on a freshly seeded store lists 46 of 48 cases with `PRIMARY_JURISDICTION_MISMATCH` and `MEMBER_ACCESS_BLOCKED`. Seed cases CASE-0003 onward are in other jurisdictions (e.g. "District Himachal Pradesh"), while `seed.py` makes the District A account `investigator` their owner and assigns District A accounts. `authorize_case` therefore refuses everyone except ADMIN/AUDITOR. Not introduced by the assignment work; it is now visible. | Demo cases look staffed but are unreachable for investigators. Decide whether to give those cases matching-jurisdiction demo users, or to reassign them. Not changed here (seed data and the live demo are the owner's call). |

