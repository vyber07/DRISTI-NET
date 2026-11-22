# DRISTI-NET Master Implementation Checklist

Audit date: 2026-11-07. Scope: source/docs inventory, read-only specialist review, full backend suite in isolated SQLite/local storage, frontend typecheck/build, Compose interpolation check. Backend suite passed 210 tests, with 6 skipped and 1 deselected; no E2E/live external integration was run. “Prior evidence” is distinguished from the current test results.

## Status legend

Uses the exact labels requested: **VERIFIED COMPLETE**, **IMPLEMENTED — PARTIAL**, **IMPLEMENTED — BROKEN**, **NOT IMPLEMENTED**, **PLANNED — NOT IMPLEMENTED**, **BUG REPRODUCED**, **BUG NOT REPRODUCED**, **UNVERIFIABLE**, **OPTIONAL / OUT OF SCOPE**. Items with implementation but no fresh behavior proof are partial or unverifiable, never promoted to verified.

## Module checklist

| ID | Module / requirement | Historical requirement | Actual implementation found | Status | Evidence / test performed | Known issue / remaining work | Priority / next action |
|---|---|---|---|---|---|---|---|
| C-01 | Frontend route/page map | Officer case workspace and workflows in `docs/context.md` | Router has command center, cases, nested overview/evidence/review/graph/timeline/locations/analysis/decisions/reports/audit, profile, admin, global audit, not-found/error routes. | IMPLEMENTED — PARTIAL | `apps/web/src/app/router/router.tsx`; specialist static inspection | Current browser behavior not run; historical page audit is stale. | P1: execute current Playwright suite safely. |
| C-02 | Frontend forms/actions/data states | Every control works, real data, clear errors | Substantive API pages/components exist; evidence upload/details, report, review, case create/assign, admin user management. | IMPLEMENTED — PARTIAL | `apps/web/src/features/`; `tests/e2e/test_ui_demo.py` source | No fresh browser test; some API flows lack E2E coverage. | P1: test role/action matrix. |
| C-03 | Frontend build/type contracts | Build and type safety | Production Vite build succeeded to `/tmp`; `npm run typecheck` failed with 12 TS errors in `casesApi.ts`. | IMPLEMENTED — BROKEN | Direct commands 2026-11-07 | Raw API mapper types invalid. | P1: fix and rerun typecheck. |
| C-39 | Frontend lint/code quality | Detect risky React patterns and dead variables | `npm run lint` exits 0 with 48 warnings (39 React, 2 hooks, 7 unused-variable). | IMPLEMENTED — PARTIAL | Direct lint command 2026-11-07 | Warnings include setState in effect, missing hook dependencies, in-render component, unused toolbar values. | P2/P3: triage effect/state warnings and remove or wire unused controls, then keep lint warning budget at zero or documented baseline. |
| C-04 | Frontend performance | Responsive officer use | Bundle emitted; main JS 844.50 kB. Existing responsive/a11y reports are historical. | IMPLEMENTED — PARTIAL | Vite output; `frontend-audit/` | No current device/browser measurement. | P3: route code-splitting and fresh browser sweep. |
| C-05 | Authentication/login | Login/logout, hashing, expiry, recovery | JWT HS256 (8-hour expiry), PBKDF2-HMAC-SHA256; active-account checks. | IMPLEMENTED — PARTIAL | `apps/api/app/auth.py`; `routes/auth_routes.py` | No token revocation/logout invalidation or self-service recovery found; fresh auth tests not run. | P1: define and test session/recovery lifecycle. |
| C-06 | User administration | Manage roles and accounts | Admin CRUD/status/reset routes and UI present. | IMPLEMENTED — PARTIAL | `routes/auth_routes.py`; `features/admin/user-management-page.tsx` | No fresh runtime role tests; self-service change/reset not found. | P1: exercise each action with synthetic users. |
| C-07 | Role/case access | Server-side access; no cross-case leak | Authorization helpers enforce role, assignment, jurisdiction in code; ADMIN/AUDITOR have broad case bypass. | IMPLEMENTED — PARTIAL | `auth.py`; `test_security.py` source | Prior test claims not rerun; admin policy needs explicit review. | P1: run role and cross-case matrix. |
| C-08 | Brute-force protection | Secure login | Redis per-user throttling is optional; fail-open/degraded if missing/unavailable. | IMPLEMENTED — PARTIAL | `services/ratelimit.py`, `auth_routes.py` | Protection absent during outage. | P1: specify fail policy and test outage. |
| C-09 | Case management lifecycle | Create, assign, search, close/history | Case list/create/assign/details and related routes exist. | IMPLEMENTED — PARTIAL | `routes/case_routes.py`, `cases-directory-page.tsx`; tests `test_case_create_assign.py` | Full lifecycle (closure/reopen/history/report) not freshly verified. | P2: end-to-end lifecycle tests and route matrix. |
| C-10 | Evidence registration/upload/validation | Preserve original; quarantine; validate | Upload validates and hashes; duplicate handling; quarantine and state pipeline. | IMPLEMENTED — PARTIAL | `routes/evidence_routes.py`, `services/pipeline.py`; `test_archive_uploads.py`, `test_security.py`, `test_workflow.py` passed in full backend suite | API/testgate with local storage passed; no live scanner/object-store proof; upload buffers before app cap. | P1: add streaming/body-size cap and verify clean upload in isolated live-service stack. |
| C-11 | Evidence retrieval/download/masking | Controlled source access | Hash checks, masked context, reason-gated reveal/download and role checks exist in code. | IMPLEMENTED — PARTIAL | `evidence_routes.py`; `services/masking.py`; E2E source | Current byte/hash + role behavior not rerun. | P1: E2E exact bytes and unauthorized reads. |
| C-12 | Evidence integrity | Modification detection | SHA-256 manifest and checks; integrity mismatch state; Merkle proof/anchor code and optional Besu adapter. | IMPLEMENTED — PARTIAL | `services/storage.py`, `integrity.py`; test files | Not full chain-of-custody; no live ledger or current regression run. | P1: restore, tamper, anchor verification drill. |
| C-13 | Audit/chain of custody | Access and transfer accountability | HMAC-signed events; audit routes and optional anchors. | IMPLEMENTED — PARTIAL | `services/audit.py`, `routes/audit_routes.py` | Read endpoint does not verify signatures; immutability not shown. | P1: verify signatures in retrieval/export and define retention. |
| C-14 | Malware/processing | Fail closed and handle retries | ClamAV adapter and testgate; extractors for structured/docs, OCR/NLP adapters. | IMPLEMENTED — PARTIAL | `services/scanner.py`, `extract*.py`, `ocr_adapter.py`, `nlp_adapter.py` | Current service availability not checked; testgate is not antivirus. | P1: live scanner test on staging, fail-closed outage proof. |
| C-15 | Background work | Retryable async processing | Inline path plus optional Kafka producer/worker. | IMPLEMENTED — PARTIAL | `services/kafka_bus.py`, `workers/worker.py`, `test_kafka_path.py` | No live broker run; docs conflict whether Kafka is adopted. | P2: reconcile and prove full job lifecycle. |
| C-16 | Search/intelligence | Search authorized cases/entities/evidence | Case listing/search and bounded graph/analytics APIs exist. | IMPLEMENTED — PARTIAL | `routes/listing.py`, `graph_routes.py`, `services/graph*.py` | No current query performance/permission verification. | P2: test filters, scope, pagination, bounds. |
| C-17 | Entity resolution/review | Conservative, explainable, reversible human review | Candidate/review models and accept/reject/defer/reverse paths exist. | IMPLEMENTED — PARTIAL | `services/resolution.py`, `review_routes.py`, tests; current E2E source | Suite not completed; model quality limited by evaluation set. | P1: execute review/contradiction regression and UI. |
| C-18 | Graph/relationships | Temporal POLE+ provenance graph | In-process projection and optional Neo4j, bounded queries, graph UI. | IMPLEMENTED — PARTIAL | `services/graph.py`, `neo4j_store.py`, `GraphCanvas.tsx` | Neo4j live state not verified; graph view current E2E not run. | P2: test fallback and exact source link. |
| C-19 | Dashboard/analytics/map | Accurate statistics, bounded analytic review | Dashboard, analysis and local lat/lon projection; analytics documented. | IMPLEMENTED — PARTIAL | `command-center-page.tsx`, `case-analysis-page.tsx`, `investigation-map-view.tsx`; `docs/status.md` | Data queries/metrics not freshly reconciled; no tile integration by design. | P2: verify metric queries and empty/error states. |
| C-20 | Reports/export | Human-reviewed report and integrity-reference PDF | JSON/HTML and PDF routes/services exist. | IMPLEMENTED — PARTIAL | `report_routes.py`, `services/report.py`, `court_pdf.py` | Permissions, completeness, timestamps and byte integrity not freshly tested. | P2: role-specific export validation. |
| C-21 | Database/schema | SQLite/Postgres, constraints/migrations | SQLAlchemy models and Alembic migrations; SQLite startup migrations. | IMPLEMENTED — PARTIAL | `models.py`, `db.py`, `apps/api/migrations/` | No live schema check; PostgreSQL Compose unavailable. | P1: migration upgrade/rollback on disposable DBs. |
| C-22 | Integrations | Verify all actual connections | Code/config for Postgres, S3/MinIO, Neo4j, Redis, Kafka, ClamAV, Besu, OCR/NLP. | UNVERIFIABLE | `DRISTI_NET_INTEGRATION_VERIFICATION.md`; `docker compose ps` env interpolation failure | No live service was proven connected this audit. | P1: staging health + end-to-end integration suite. |
| C-23 | Deployment/operations | Startup, TLS, logs, health, restart | Compose, Dockerfile, Nginx and systemd units exist. | UNVERIFIABLE | `docker-compose.yml`, `infrastructure/`; Compose status blocked | No current deployed service/TLS/health verification. | P1: safe staging deployment validation. |
| C-24 | Backup/recovery | Export, backup, restore, migration | Scripts and policy/report exist; SQLite/local restore historical evidence. | IMPLEMENTED — PARTIAL | `operations/RESTORE_TEST_REPORT.md`, `scripts/backup_restore_drill.py` | PostgreSQL + S3/MinIO restore and off-host encrypted copy untested. | P0: full restore drill before operational use. |
| C-25 | Security monitoring/logging | Record security events, alert | Structured logs and audit events implemented in source. | IMPLEMENTED — PARTIAL | `core/logging.py`, `services/audit.py` | External monitoring/alerts/retention and current tamper detection unverified. | P1: define monitoring and test alert paths. |
| C-26 | AI/ML evaluation | Verified model behavior | OCR/NLP adapters and small evaluation artifacts exist. | IMPLEMENTED — PARTIAL | `reports/ner-evaluation.md`, `services/nlp_adapter.py`, `conftest.py` | Real quality unproven; suite globally mocks NER; evaluation set small. | P2: representative held-out synthetic evaluation. |
| C-27 | External government/telecom/banking/biometrics | Authorized live connectors | None found; explicitly prohibited absent authorization. | OPTIONAL / OUT OF SCOPE | `docs/context.md` §§2, 11 and `docs/limitations.md` | No connector should be claimed. | P4: only scope with written authorization. |
| C-28 | Historical issues | Prior concerns: AWS shutdown/export/migration/admin/UI/cleanup/docs | Repository issue docs include backup/migration, deployment, UX, code quality concerns; no prior chats supplied. | UNVERIFIABLE | `PROJECT_RISK_REGISTER.md`, `PROJECT_BLOCKERS.md`, audit/ops docs | Historical conversation review incomplete; AWS credit status cannot be confirmed from code. | P2: obtain historical materials and recheck infra externally. |
| C-29 | Upload resource limits | Limit size before accepting untrusted file | Endpoint reads complete upload into a `bytes` object before `validate_upload()` applies `MAX_UPLOAD_MB`. | IMPLEMENTED — PARTIAL | `routes/evidence_routes.py` upload handler; `config.py` MAX_UPLOAD_MB | Concurrent oversized authenticated uploads can consume memory before application-level rejection; proxy/body cap is not verified. | P1: enforce streaming/ASGI/proxy request limits before buffering and test concurrency. |
| C-30 | Sensitive-value masking in reports | Mask sensitive identifiers by default | Report candidate summaries include raw entity labels; resolution candidates are restricted to PERSON entities, so this does not demonstrate phone/account leak. DOB/address conflict values also may appear in candidate payloads. | UNVERIFIABLE | `routes/report_routes.py`; `services/resolution.py::_persons_in_case`; `services/review_routes.py`; `services/masking.py` | Whether person name/DOB/address are masked for authorized, de-identified case users is not fully specified; no runtime export test run. | P2: clarify field classification and test the chosen policy in JSON/HTML. |
| C-31 | Query limit bounds | Bounded list/query results | Several endpoints clamp only maximum and accept negative `limit` values. | IMPLEMENTED — PARTIAL | `audit_routes.py`; `graph_routes.py` timeline/edge; `evidence_routes.py` evidence claims | Negative SQL LIMIT semantics differ by DB; on SQLite may remove limit. | P2: add `Query(ge=1, le=...)` for each and test negative/zero values on SQLite + PostgreSQL. |
| C-32 | Read access accountability | Log access to case/evidence/intelligence objects | Some reads audit; static review found no success audit call in analysis, timeline, claim/entity reads, evidence item/context/claims. | IMPLEMENTED — PARTIAL | Route functions in `graph_routes.py`, `evidence_routes.py`; compare graph/edge/verify audit calls | Access history may omit sensitive reads despite product requirement. | P1: classify auditable actions; add events or document justified exclusions; test each read path. |
| C-33 | Export access masking | Prevent unauthorized sensitive identifier disclosure | `/cases/{id}/report` permits INVESTIGATOR/REVIEWER/ANALYST/ADMIN; report carries raw candidate labels as above. | IMPLEMENTED — PARTIAL | `report_routes.py`; `ReportIn` | Risk applies to exported JSON/HTML; current tests only broad output assertions. | P1: masking regression tests, include role matrix and output scan. |
| C-34 | Audit detail confidentiality | Limit disclosure of event details | Audit serializers expose `detail` verbatim; case audit is available to case-authorized users. | IMPLEMENTED — PARTIAL | `audit_routes.py` `audit_out()` | User-entered reasons/details may contain sensitive data; signature verification also absent in read path. | P2: define detail schema/redaction and verify signatures before display/export. |
| C-35 | Cross-case metadata minimization | Hide restricted case relationships | Entity detail hides inaccessible case IDs but returns `total_cases=len(all_cases)`. | IMPLEMENTED — PARTIAL | `graph_routes.py` `get_entity()` | Count can reveal restricted cross-case linkage volume. | P2: policy decision; count only visible cases or clearly approved aggregate. |
| C-36 | Review queue metrics | Accurate dashboard counts | `identityMergesCount` is populated from total candidate count. | IMPLEMENTED — PARTIAL | `review_routes.py` `hitl_stats()` | Metric name implies merged/accepted identities and can mislead. | P2: compute from approved/active merges or rename to candidate total; add query test. |
| C-37 | Case assignment target eligibility | Assign eligible active same-jurisdiction user | Owner/Admin can assign any matching username; handler does not check target active status or jurisdiction. | IMPLEMENTED — PARTIAL | `case_routes.py` `assign()` | Assignment may create access that later fails jurisdiction gate; inactive users receive case assignment. | P2: validate target policy before assignment and test inactive/cross-jurisdiction users. |
| C-38 | Demo tamper endpoint isolation | Keep destructive testing route out of production | Endpoint exists; router registration is conditional on SQLite. | IMPLEMENTED — PARTIAL | `demo_routes.py`, `main.py` | Static isolation only; verify production DB config cannot expose it accidentally. | P1: startup assertion and deployment test. |

## Fresh command outcomes

- `npm run typecheck`: failed; see BUG-NEW-01.
- `npm run build -- --outDir /tmp/drishti-audit-web-dist`: passed with chunk/import warnings.
- Isolated `make test`: incomplete/interrupted after progress; not a pass.
- `make e2e`: not run because it mutates DB and no disposable running server was configured.
- `docker compose ps`: unable to inspect because required env values were unavailable to Compose.

## Historical issue register summary

Supplied repository documentation records prior AWS Free Tier/server shutdown and export/migration concerns only in project notes (no conversational history supplied). ZIP release archives exist under `releases/`, but their presence does not prove a complete data backup or successful restore. `operations/RESTORE_TEST_REPORT.md` covers SQLite/local storage, not PostgreSQL + MinIO/S3. Admin provisioning exists in code but no deployment credentials were inspected. UI simplification, business-logic separation, naming and error handling have ongoing changes; the current TypeScript failure is newly observed. Cleanup was not performed.

## Backend endpoint inventory (static inventory; individual response contracts not live-verified)

All routes are registered under the application API prefix in `apps/api/app/main.py`. The list below records actual decorators found during this audit; it is not evidence that each route works. Auth and permission behavior is implemented in handlers/dependencies but was not freshly executed endpoint-by-endpoint.

| Route module | Methods and paths found |
|---|---|
| `auth_routes.py` | POST `/auth/login`; GET `/auth/me`; GET/POST `/users`; PATCH `/users/{user_id}`; POST `/users/{user_id}/deactivate`; POST `/users/{user_id}/reactivate`; POST `/users/{user_id}/reset-password` |
| `case_routes.py` | GET/POST `/cases`; GET `/cases/{case_id}`; POST `/cases/{case_id}/assign` |
| `evidence_routes.py` | POST `/cases/{case_id}/evidence`; GET `/cases/{case_id}/evidence`; GET `/cases/{case_id}/evidence/summary`; GET `/evidence/{evidence_id}`; POST `/evidence/{evidence_id}/process`; GET `/evidence/{evidence_id}/verify`; GET `/evidence/{evidence_id}/context`; POST `/evidence/{evidence_id}/context/reveal`; POST `/evidence/{evidence_id}/download`; GET `/evidence/{evidence_id}/claims` |
| `review_routes.py` | GET `/cases/{case_id}/candidates`; GET `/cases/{case_id}/candidates/summary`; GET `/candidates/{candidate_id}`; POST `/candidates/{candidate_id}/decision`; POST `/candidates/{candidate_id}/assign`; GET `/cases/{case_id}/stats`; POST `/claims/{claim_id}/decision`; GET `/cases/{case_id}/reviews`; GET `/cases/{case_id}/contradictions` |
| `graph_routes.py` | GET `/cases/{case_id}/graph`; GET `/cases/{case_id}/locations`; GET `/cases/{case_id}/analysis`; GET `/cases/{case_id}/timeline`; GET `/cases/{case_id}/edge`; GET `/claims/{claim_id}`; GET `/entities/{entity_id}`; POST `/entities/{entity_id}/reveal` |
| `audit_routes.py` | GET `/audit`; GET `/cases/{case_id}/audit` |
| `report_routes.py` | POST `/cases/{case_id}/report` |
| `integrity_routes.py` | POST `/cases/{case_id}/integrity/anchor`; GET `/cases/{case_id}/integrity/anchors`; GET `/cases/{case_id}/integrity/anchors/{anchor_id}/proof/{leaf_sha256}`; POST `/cases/{case_id}/report/court-pdf` |
| `demo_routes.py` | POST `/demo/tamper/{evidence_id}` (demo/test-only behavior; deployment isolation must be verified) |

Exact per-route request/response/auth matrices and failure-path tests remain a follow-up before calling this endpoint-by-endpoint certification. Route inventory was obtained with `rg -n '^@router\\.(get|post|put|patch|delete|options|head)' apps/api/app/routes`.

## Endpoint-level authorization/validation notes from source review

- `GET /cases`: scoped by assignment/owner and jurisdiction for ordinary users; ADMIN/AUDITOR list all; search is capped at 200 chars, page size 1–500.
- `POST /cases`: INVESTIGATOR/ADMIN, constrained `CaseIn`, jurisdiction check for non-admin, duplicate 409, audit on success.
- `POST /cases/{id}/assign`: case authorization then owner/ADMIN check; target username existence checked, but target active/jurisdiction eligibility is not.
- Evidence upload: EVIDENCE_OFFICER/INVESTIGATOR/ADMIN and case access; bytes are read fully before size/type validation; duplicate hashes short-circuit; accepted path optionally processes synchronously.
- Evidence read/context/download: case authorization and state/hash gate; context masked by default; raw download requires reason and investigator/reviewer/admin; ADMIN can download quarantined states.
- Candidate decisions: REVIEWER/INVESTIGATOR/ADMIN, case scope, decision enum and reason validated; contradictory forbidden for identity candidate; reverse requires a previous decision; audited.
- Graph/time/location routes use case access; graph bounds and time parse helper exist. Analysis/timeline success reads do not appear to add audit rows.
- Entity detail checks that entity appears in the requested case, but returns total number of cases including restricted cases; reveal is investigator/reviewer/admin with reason and audit.
- Global audit: AUDITOR/ADMIN; case audit: any authorized case user; both return unmasked `detail` and do not verify HMAC on read; limits are upper-clamped but not lower-bounded.
- Reports: investigator/reviewer/analyst/admin and case access; writes graph/report snapshot and audit. Candidate labels in review section bypass `mask_label`.
- Integrity anchors/proofs and PDF: investigator/reviewer/analyst/admin with case access, and auditor can read anchors/proofs; actual Besu RPC remains unverified.
- Demo tamper endpoint is only registered when database URL is SQLite; do not expose SQLite demo mode as production.

### Per-endpoint contract matrix (static source review)

All paths below include the `/api/v1` prefix in deployment. Unless noted, requests use bearer auth, response shapes are plain dict/list outputs without a dedicated Pydantic response model, and tests listed are existing source tests only (not current pass claims). Successful read-access logging is inconsistent and called out where apparent.

| Method + path | Auth / input validation | Purpose / response and error behavior | Existing test source / current next action |
|---|---|---|---|
| POST `/auth/login` | Public; `LoginIn`; optional Redis limiter | Token + user; 401 credentials, 429 throttle; audit success/denial/degraded | `test_security.py`, `test_user_management.py`, `test_ratelimit.py`; fresh fixture API run incomplete. Test revocation/outage policy. |
| GET `/auth/me` | `current_user` | User + assigned case IDs | User/security tests; no fresh run. Verify assignment/owner consistency. |
| GET `/users` | ADMIN/AUDITOR/INVESTIGATOR | User directory; returns username/display name/role/jurisdiction/active | User-management tests; current access not run. Confirm least disclosure for investigators. |
| POST `/users` | ADMIN; `UserCreateIn` bounds/role pattern; duplicate 409 | Create user; salted PBKDF2 hash; audit | `test_user_management.py`; test full role matrix and audit. |
| PATCH `/users/{user_id}` | ADMIN; partial `UserUpdateIn`; 404 unknown | Update display name/role/jurisdiction; audit before/after | `test_user_management.py`; test active sessions after role change. |
| POST `/users/{user_id}/deactivate` | ADMIN; self-deactivation 400; 404 unknown | Set inactive; audit; subsequent current_user rejects account | `test_user_management.py`; test existing JWT immediately after deactivation. |
| POST `/users/{user_id}/reactivate` | ADMIN; 404 unknown | Set active; audit | `test_user_management.py`; verify recovery controls. |
| POST `/users/{user_id}/reset-password` | ADMIN; password 8–200 chars | Hash new password; audit; `{ok:true}` | `test_user_management.py`; no self-service recovery route. |
| GET `/cases` | `current_user`; q≤200, limit 1–500, offset≥0, awaiting_review | Assigned/owned + jurisdiction-scoped list (ADMIN/AUDITOR all), X-Total-Count | `test_listing_search.py`, `test_security.py`; current DB workflow not run. |
| POST `/cases` | INVESTIGATOR/ADMIN; constrained `CaseIn`; jurisdiction; duplicate 409 | Create case, owner assignment, audit, `CaseOut` | `test_case_create_assign.py`; test lifecycle/closure (no close route found). |
| GET `/cases/{case_id}` | `current_user` + `authorize_case` | `CaseOut`; success `CASE_VIEW` audit; unauthorized denied and audited | Security/case tests; current role matrix not run. |
| POST `/cases/{case_id}/assign` | `current_user`; authorized case; owner/ADMIN; username exists | Add assignment idempotently; audit; returns case; does not validate target active/jurisdiction | `test_case_create_assign.py`, `test_security.py`; add target eligibility cases. |
| POST `/cases/{case_id}/evidence` | EVIDENCE_OFFICER/INVESTIGATOR/ADMIN + case; multipart file/source_label/process | Reads entire upload, validates type/size, SHA-256, dedup, quarantine, optional sync process; 422/503 | Archive/workflow/security tests passed in full backend suite with testgate/local storage. Add streaming cap; no live storage/scanner run. |
| GET `/cases/{case_id}/evidence` | `current_user` + case; q/status, limit 1–500, offset≥0 | Evidence list + paging metadata | Listing/workflow/security tests; verify role filters/current response. |
| GET `/cases/{case_id}/evidence/summary` | `current_user` + case | Counts by evidence status | No fresh verification; reconcile UI metric with DB. |
| GET `/evidence/{evidence_id}` | `current_user`; `_get_ev` case auth | Evidence metadata/jobs/claim count; appears no success access audit | Workflow/security tests; add access event if required. |
| POST `/evidence/{evidence_id}/process` | EVIDENCE_OFFICER/INVESTIGATOR/ADMIN + evidence case | Reprocess allowed state; otherwise 409; pipeline/job result | Workflow/extraction tests; test retries and status outcomes. |
| GET `/evidence/{evidence_id}/verify` | `current_user` + evidence case | Recompute hash, state transition/audit if mismatch or missing | Workflow/cross-case tests; current test not run. |
| GET `/evidence/{evidence_id}/context` | `current_user` + clean/hash-verified evidence; bounded window 0–10 | Masked source locator window; 409 if blocked; appears no read audit | Workflow/provenance tests; test exact source and audit policy. |
| POST `/evidence/{evidence_id}/context/reveal` | INVESTIGATOR/REVIEWER/ADMIN; reason 5–500; window 0–10; case auth | Unmasked source window and UNMASK audit; 403 unauthorized role | Security/provenance tests; test role-by-role and audit. |
| POST `/evidence/{evidence_id}/download` | INVESTIGATOR/REVIEWER/ADMIN; reason 5–500; case auth | Raw bytes; blocked scan states except ADMIN; audit; SHA header | `test_cross_case_and_exports.py`, E2E source; current E2E not run. |
| GET `/evidence/{evidence_id}/claims` | `current_user` + case; `limit` upper clamp 500, no lower bound | Claims with source/provenance; appears no success access audit | Workflow tests; add positive lower bound and verify. |
| GET `/cases/{case_id}/candidates` | `current_user` + case; state filter; q≤200; limit 1–500; offset≥0 | Candidate list; search excludes PHONE/ACCOUNT entity label matches | Review/listing tests; run after fixture stall resolved. |
| GET `/cases/{case_id}/candidates/summary` | `current_user` + case | Count by candidate state | Review tests; verify total definitions. |
| GET `/candidates/{candidate_id}` | `current_user`; candidate lookup then case auth | Detailed signals, masked phone/account attributes, reviews; DOB/address conflict values may be raw | Review/security tests; classify fields and test. |
| POST `/candidates/{candidate_id}/decision` | REVIEWER/INVESTIGATOR/ADMIN + candidate case; `DecisionIn`, reason 3–2000 | APPROVE/REJECT/DEFER/REVERSE/STALE; CONTRADICTORY rejected 422; reverse without prior review 409; audit/state update | Review/workflow tests; role matrix not freshly run. |
| POST `/candidates/{candidate_id}/assign` | REVIEWER/INVESTIGATOR/ADMIN + candidate case | Self-assign candidate; audit | Security tests; confirm role/policy and assignment behavior. |
| GET `/cases/{case_id}/stats` | REVIEWER/INVESTIGATOR/ADMIN + case | HITL summary stats; `identityMergesCount` currently equals total candidates | Security tests; correct/rename metric and test. |
| POST `/claims/{claim_id}/decision` | REVIEWER/INVESTIGATOR/ADMIN + claim case; `DecisionIn` | Human claim state/review update and audit | Workflow tests; test invalid/terminal transitions. |
| GET `/cases/{case_id}/reviews` | `current_user` + case | Review history; reasons masked via `mask_text` | Workflow/security tests; no fresh read audit check. |
| GET `/cases/{case_id}/contradictions` | `current_user` + case | Contradictory claims via `claim_out` | Workflow tests; verify case scoping and masking. |
| GET `/cases/{case_id}/graph` | `current_user` + case; offset≥0; service-enforced hops/nodes and strict times | Bounded masked graph, optional candidates, snapshot hash, audit | Graph/workflow/security tests; fresh execution not complete. |
| GET `/cases/{case_id}/locations` | `current_user` + case | Bounded location list including no-coordinate items; audit | Graph tests; no fresh map runtime. |
| GET `/cases/{case_id}/analysis` | `current_user` + case; parsed time window | Masked metrics/bridges/communities/rules; appears no success audit | Graph tests; verify metric outputs, masking, access audit. |
| GET `/cases/{case_id}/timeline` | `current_user` + case; parsed time/entity; limit capped 2000, no lower bound | Approved relationship events; masked labels; appears no success audit | Workflow/E2E source; add lower bound and runtime filters. |
| GET `/cases/{case_id}/edge` | `current_user` + case; source/target/rel_type; limit capped 500, no lower bound | Underlying claims + provenance for aggregate edge; audit | E2E source checks source; add negative-limit test. |
| GET `/claims/{claim_id}` | `current_user`; claim then case auth | Claim details, masked values/provenance; appears no success audit | Workflow tests; verify exact output/audit. |
| GET `/entities/{entity_id}` | `current_user` + query `case_id`; verifies entity actually appears in case | Masked label, case-scoped attributes, claims; hides IDs but returns total cross-case count; appears no success audit | Security/cross-case tests; decide count disclosure and audit. |
| POST `/entities/{entity_id}/reveal` | `current_user`; INVESTIGATOR/REVIEWER/ADMIN; case_id, reason 5–500 | Raw entity value and UNMASK audit; 403 if wrong role/not in case | Security tests; current role behavior not run. |
| GET `/audit` | AUDITOR/ADMIN; optional action; limit upper-clamped 1000, no lower bound | Latest audit rows incl. raw `detail`; no signature verification/pagination | Security tests cover HMAC logic, not endpoint disclosure; define paging/redaction/verification. |
| GET `/cases/{case_id}/audit` | `current_user` + case; limit upper-clamped 1000, no lower bound | Case audit rows incl. raw `detail`; no success read event/signature verification | Workflow/security tests; define read audit, detail redaction and bounds. |
| POST `/cases/{case_id}/report` | INVESTIGATOR/REVIEWER/ANALYST/ADMIN + case; `ReportIn` format JSON/HTML | Snapshot, masked graph/analysis, candidate review summary, export audit; JSON or HTML | `test_workflow.py::test_report_export`; targeted run incomplete. Add field-level policy and output regression tests. |
| POST `/cases/{case_id}/integrity/anchor` | INVESTIGATOR/REVIEWER/ANALYST/ADMIN + case; anchorable evidence; optional Besu config | Merkle anchor record/status and audit; 422 if no anchorable evidence | Integrity/new component tests; no live ledger run. |
| GET `/cases/{case_id}/integrity/anchors` | Authorized case user; role gate includes auditor | Anchor list (bounded) | Integrity route tests; current DB integration not run. |
| GET `/cases/{case_id}/integrity/anchors/{anchor_id}/proof/{leaf_sha256}` | Authorized case user; anchor/leaf existence | Proof + scheme/root verification fields; 404 if unavailable | Merkle/API tests; pure Merkle tests passed but route not verified. |
| POST `/cases/{case_id}/report/court-pdf` | INVESTIGATOR/REVIEWER/ANALYST/ADMIN + case; analyst comments | Integrity-reference PDF disclaimer, snapshot/audit, masked analysis | `test_new_components.py`, cross-case tests; no current route test complete. |
| POST `/demo/tamper/{evidence_id}` | ADMIN; router registered only for SQLite | Mutates demo evidence bytes and audits; intentionally destructive test helper | Security tests test isolation; runtime current mode not checked. Never expose SQLite demo config as production. |

### Backend role matrix (source-derived; not freshly exercised)

| Role | Case visibility | Upload/process | Raw download/unmask | Candidate decisions | Reports/anchors | Global audit / user administration |
|---|---|---|---|---|---|---|
| INVESTIGATOR | Assigned/owned case in matching jurisdiction | Yes | Yes, reason required | Yes | Yes | No global audit; no user admin |
| EVIDENCE_OFFICER | Assigned case in matching jurisdiction | Yes | No raw download/reveal | No | No report/anchor route | No global audit; no user admin |
| REVIEWER | Assigned case in matching jurisdiction | No | Yes, reason required | Yes | Yes | No global audit; no user admin |
| ANALYST | Assigned case in matching jurisdiction | No | No raw download/reveal | Read queue, no decisions | Yes | No global audit; no user admin |
| AUDITOR | `authorize_case` bypasses assignment/jurisdiction; sees all cases | No | No raw download/reveal | Read-only; no decisions | Anchor read allowed, report export not allowed | Global audit and user listing; no user mutations |
| ADMIN | Role and case checks are globally bypassed | Yes | Yes | Yes | Yes | Global audit and user administration |

The UI mirrors capability checks in `apps/web/src/lib/permissions.ts`, but backend checks are authoritative. Static risks requiring policy decision: ADMIN’s broad bypass, AUDITOR’s all-case access, and investigators’ access to user directory data. The isolated backend suite passed, including route-level checks in `test_security.py`; no comprehensive manual role matrix or production-service test was performed.

## Frontend page and major interaction inventory

This is a code-and-test-source inventory, not a browser pass. E2E references describe assertions that exist in `tests/e2e/test_ui_demo.py`; this audit did not execute them.

| Page / route | Main interactions and data source | State/permission evidence | Existing test evidence | Current gap / next action |
|---|---|---|---|---|
| `/login` | Username/password submit via auth store | Required fields, login errors, expired-session notice | E2E source: expired session returns to requested page | Runtime auth not freshly exercised; test brute-force/revocation policy. |
| `/command-center` | Assigned cases, pending reviews/activity summary, audit link | Loading/error/retry, role-aware navigation | No current metric-accuracy E2E assertion identified | Reconcile each statistic with backend query and role data. |
| `/cases` | Case search/filter/paging; create dialog; open case | Server paging/search, role-gated case creation and form validation | E2E source: server search/paging, create case/assign | Current browser behavior not run; test empty/error/filter combinations. |
| Case overview | Case info, assignments, evidence/review/contradiction/activity/anchor summaries | Explicit case loading/denied/error states; assignment dialog; create anchor gated | Source routes and tests exist; no fresh E2E | Verify summary counts and anchor permissions for every role. |
| Case evidence | Search/status/paging, upload, evidence details, verify hash, reprocess, download, source | Upload/download role controls; download reason dialog | E2E source: denial, scan state, exact downloaded-byte SHA-256, verify and exact source | Detail failure falls back to list item; evidence summary failure silently nulls. Test service errors and all role outcomes. |
| Case review queue/detail | Search/state paging; candidate comparison/signals/source tabs; accept/reject/defer/reverse with reason/history | Reviewer/investigator decision controls; analyst read-only presentation | E2E source covers review lifecycle and analyst controls | Backend role behavior not freshly run; clarify DOB/address conflict data policy and test decisions/errors. |
| Graph | WebGL/list toggle, search, filters, temporal slider, entity/edge drawers, source trace | Bounded graph response, WebGL fallback/retry, keyboard list | E2E source asserts nodes/edges, exact source, keyboard source path | Client filters are local; current graph rendering and bounds not run. |
| Timeline | Search/filter/entity scope, reset, source and view-graph actions | Explicit loading/error/empty state; API-backed data | E2E source asserts neutral copy and entity labels | Full filters and deep-links not validated; route success access audit appears absent. |
| Locations/map | Local SVG projection, select location, refresh | API loading/error/empty state | No data assertion; legacy route redirects only | Verify coordinate policy and boundary values; no tile/GIS integration by design. |
| Pattern analysis | Refresh and API-backed graph metrics | Loading/error/data state in page | No metric correctness E2E found | Metric accuracy, access audit and masking require tests. |
| Decisions/review history | Claim decision forms/history | Role gates, reason entry and response error handling | No dedicated current E2E assertion identified | Test claim state transitions, reverse/stale behavior and cross-role denials. |
| Reports | JSON/HTML report and integrity-reference PDF, comments, download | Permission disabling and success/error/download states | E2E source downloads JSON through redirect; no full PDF role matrix | Test JSON/HTML/PDF accuracy, masking, hash references and denial. |
| Case audit | Event filters, detail drawer, export/copy actions | Case-authorized view | No current E2E verifying completeness/signature | Read route returns raw detail and no read event; policy and signature checks need resolution. |
| Global audit | Latest events, client search/action filters, refresh | Outer role gate before content fetch; AUDITOR/ADMIN intended | E2E source asserts denied role triggers no request | No pagination/detail verification; successful read signature validation absent. |
| Admin users | Create/edit/deactivate/reactivate/reset password | ADMIN gate; form validation/busy/error | No CRUD E2E coverage found | Test role/API/UI matrix, password reset audit and active-session behavior. |
| Profile/account | Current user, role/capabilities, assigned cases, signout | Authenticated page; capability descriptions | No current E2E behavior coverage noted | Self-service password change/recovery and session management not present. |
| Shared overlays | Reason dialog, provenance viewer, assign/create/admin dialogs, audit and entity/edge drawers, reveal modal | Radix dialogs and role checks in current source | Some evidence/review overlay interactions in E2E source | Individual focus, keyboard, error, empty and responsive behavior not freshly tested. |

Additional static findings: evidence detail failure silently falls back to the list record; evidence summary errors become `null`; some audit deep-link query parameters require current route validation; global audit loads a fixed latest batch without demonstrated paging. Older Nov 4 frontend audit defects conflict with current code and must not be carried forward without reproduction.

## Historical issue register (repository materials only)

No prior conversation logs were supplied. Repository notes establish only partial history:

| Historical concern | Evidence found | Current disposition |
|---|---|---|
| AWS Free Tier exhausted / server shutdown risk | AWS host references exist in older reports/config notes; no billing, account or current server-state evidence supplied | UNVERIFIABLE; do not claim credits are exhausted or server is shutting down. |
| Project ZIP/export before shutdown | `releases/` contains archives and `reports/release-checklist.md` records historical package/export checks | UNVERIFIABLE as a complete migration backup; ZIP presence/checksum does not prove DB + evidence restore. |
| ZIP export error/uncertain completion | No prior transcript supplied; release artifacts and backup scripts exist | UNVERIFIABLE; verify by unpacking and restoring into isolated environment. |
| Re-setup/server migration | Migration scripts and prior SQLite→Postgres/MinIO migration notes exist | Partially documented; scripts contain destructive target operations. Require preflight/verified backup and isolated rehearsal. |
| Preserve project and related data | SQLite/local backup restore was tested historically; Postgres/MinIO not covered | IMPLEMENTED — PARTIAL; P0 restore work remains. |
| Clean unnecessary files without damaging data | Repo includes venvs, node_modules, dist, storage, archives; no cleanup performed | UNVERIFIABLE requirement; all files and data were retained. |
| Secure admin provisioning/recovery | Admin user management/reset routes exist; no self-service account recovery found | IMPLEMENTED — PARTIAL; deployment provisioning and recovery policy not verified. |
| Inspect every page/button/function | Page/major interaction inventory above; 16 E2E source tests exist | IMPLEMENTED — PARTIAL; no exhaustive button-by-button runtime walk was performed. |
| Simpler officer UI | Current case workspace and responsive/accessibility artifacts exist | Prior browser evidence only; current usability not freshly measured. |
| Separate business logic from UI / remove duplicate/dead code | Domain services and earlier code-quality reports exist; direct fetch paths and stale API wrappers remain | IMPLEMENTED — PARTIAL; no full dead-code/static-analysis pass in this audit. |
| Environment config separated from source | `.env` and `.env.compose` files exist locally; config reads environment variables and templates exist | UNVERIFIABLE whether deployment config is safely provisioned; values were not read or reported. |
| Error handling, modular components, state management, scalable API, complete docs | Domain errors, services, Zustand stores, routes and extensive docs exist | IMPLEMENTED — PARTIAL; current TS typecheck fails, route/docs conflict, CI/runtime readiness unverified. |

Historical status registers are dated snapshots. `PROJECT_BLOCKERS.md` and `PROJECT_RISK_REGISTER.md` still report items contradicted by later evidence/current source (old MinIO digest, missing Redis, old test-stack destructive-command claim); do not treat them as current defects. `docs/API_ARCHITECTURE.md`, ADR summary and disaster recovery plan contain unsupported audit endpoint/hash-chain claims. Reconcile these documents before operational use.

## Direct answers

1. Today the code can support synthetic case/evidence workflows, source extraction, human-reviewed identity candidates, bounded relationship analysis, reports and audit/integrity references when properly configured; this audit did not establish current production runtime operation.
2. Bounded behaviors are freshly verified in tests: auth denial, case create/assignment/search, evidence validation and testgate workflow, candidate review/report API workflow, pure graph/Merkle behavior, scanner protocol parsing, and selected rate-limit/config behaviors. These do not establish full-module or production readiness; details and limits are in `DRISTI_NET_VERIFIED_COMPLETED_FEATURES.md`.
3. Auth, case/evidence workflows, candidate review, graph, reports, storage, integrations, deployment, backup and AI adapters are partial pending fresh tests/operational proof.
4. Password recovery/token revocation, full immutable custody ledger, PostgreSQL/object-store recovery proof, H3 overlap analytics, extra graph kinds and Kubernetes are missing or planned. Government/live connectors are out of scope.
5. Newly reproduced breakage: frontend `npm run typecheck` fails. The initial sandbox stall was not reproduced in the approved isolated run; full backend suite passed. Current browser/page interaction errors remain unverified because E2E was not run.
6. Historical AWS shutdown/server migration concerns remain relevant as operational questions; ZIP completeness and restore are not proven. No prior conversations were supplied.
7. Main risks: fail-open optional login throttling, no token revocation, broad admin access, unverified audit signature on reads/immutability, and unverified production config/backup.
8. SHA-256 and HMAC/Merkle integrity references exist; complete chain of custody is not established.
9. Integration code exists; live service connections were not verified.
10. Schema/migration code exists, but cross-backend production reliability is not freshly proven.
11. Frontend calls API clients, but type errors and lack of fresh E2E mean full correctness is not established.
12. Deployment artifacts exist; another-server deployability is unverified until secret/config, migrations, storage, TLS and restore are tested.
13. Safe recovery is only documented for SQLite/local storage; production-shaped backup safety is unverified.
14. Not suitable for real operational use based on present evidence; limit to synthetic/de-identified demo use until P0/P1 gates pass.
15. Fix typecheck, complete isolated tests, validate auth/integrity, prove DB/object-store backup/restore, and validate staging deployment/security.
16. Build next: P0 recovery proof, then P1 correctness/security gates, then P2 integration/quality, then optional future analytics/infrastructure.
17. Follow the ordered acceptance criteria in `DRISTI_NET_PRIORITIZED_IMPLEMENTATION_ROADMAP.md`.

Historical conversations were not supplied. Dates and prior results must be read from cited repository artifacts; none are represented as current passes unless explicitly run above.
