# DRISTI-NET Verified Completed Features

Audit date: 2026-11-07. “Verified complete” below is scoped to the behavior named and tested, in the isolated audit configuration. It does not mean the whole module or deployment is production-ready. Backend suite: 210 passed, 6 skipped, 1 deselected; temporary SQLite and local storage; optional external services blanked/offline. See [test execution report](DRISTI_NET_TEST_EXECUTION_REPORT.md).

| ID | Verified behavior | Evidence and test result | Scope limitation |
|---|---|---|---|
| VC-01 | Unauthenticated request to the protected API endpoint is denied | `apps/api/app/tests/test_security.py::test_unauthenticated_denied`; approved isolated run, 1 passed in 0.35 s; also included in full backend suite | Does not establish a complete role/permission matrix, session revocation, or browser login behavior. |
| VC-02 | Security configuration rejects disallowed scanner mode/short secret and verifies historical audit HMAC key rotation behavior covered by tests | `test_security.py` selection: 4 passed, 21 deselected; full backend suite also passed | Unit behavior only; does not verify deployment secret provisioning or external key custody. |
| VC-03 | RFC 6962 Merkle proof and legacy proof behaviors covered by pure tests | `test_merkle_rfc6962.py`: included in 42 passed pure Merkle/graph tests | Does not prove API anchor routes, PostgreSQL persistence, external Besu anchoring, or a complete evidence custody process. |
| VC-04 | Bounded graph analysis/aggregation behaviors covered by pure tests | `test_graph_analysis.py`: included in 42 passed pure Merkle/graph tests | Does not verify live Neo4j, frontend visualization, or operational intelligence quality. |
| VC-05 | ClamAV protocol response parsing cases represented in the parser test suite | `test_scanner_parsing.py`: 9 passed using local mock protocol replies | Not a live ClamAV daemon or malware detection efficacy test. |
| VC-06 | Rate-limit helper pure/degraded-path behaviors covered by unit tests | `test_ratelimit.py -k 'not real_redis and not login_endpoint'`: 2 passed, 2 deselected | Does not establish live Redis enforcement, multi-instance limits, or login brute-force protection. |
| VC-07 | Case create/assign, ownership checks, case search paging, wildcard escaping, and access scope for search | `test_case_create_assign.py`, `test_listing_search.py`, `test_security.py`; all included in full passing suite | Synthetic SQLite API tests; no multi-user browser workflow or production DB verification. |
| VC-08 | Evidence upload validation, scan gate, hash manifest/tamper detection, archive traversal/size defenses, and archive extraction flow | `test_security.py`, `test_archive_uploads.py`, `test_workflow.py`; included in full passing suite | Test scanner gate and local filesystem only; not live antivirus, object storage, large/concurrent upload performance, or all media types. |
| VC-09 | Source-linked extraction, explainable candidate generation without automatic merge, review decisions, and report export behavior covered by workflow tests | `test_workflow.py` (`test_status_flow_and_source_linked_extraction`, `test_candidates_are_explainable_and_never_auto_merged`, `test_review_decisions`, `test_report_export`); included in full passing suite | Synthetic API workflow only; does not prove all role-specific report content, masking policy, browser flow, or legal use. |
| VC-10 | Frontend source can be transformed into a Vite production bundle | `npm run build -- --outDir /tmp/drishti-audit-web-dist`: 2087 modules transformed and build emitted | Build-only result. Frontend typecheck fails with 12 errors; no browser workflow was freshly run. |

The rows above are bounded test behaviors verified in this audit. A synthetic API workflow has relevant passing tests; a full officer-facing browser-to-production-services workflow was not run. No live external integration, legal compliance, certified evidence process, or end-to-end chain of custody is verified. Historical test records in `docs/status.md`, `audit/TEST_RESULTS.md`, and other reports are retained as dated prior evidence and are not presented as fresh passes.

## 2026-11-10 addendum

| ID | Verified behavior | Evidence and test result | Scope limitation |
|---|---|---|---|
| VC-11 | Case response mapping has an explicit compile-time contract matching FastAPI `CaseOut` | `apps/web/src/services/api/casesApi.ts`; pre-change typecheck reproduced 12 errors; post-change `npm run typecheck` exit 0, `npm run build` passed, and `test_create_case_requires_authority_reference` passed (1 test) | No runtime response schema validation; isolated browser E2E 16/16 was run before this type-only change. |

The 2026-11-10 E2E result is isolated synthetic evidence, not a live production-service result; its initial misrouted attempt is recorded in `docs/audit/TEST_EXECUTION_BASELINE_2026-11-10.md`.

| ID | Verified behavior | Evidence and test result | Scope limitation |
|---|---|---|---|
| VC-12 | Migration safety code refuses a conflicting S3 object and a populated relational target, while preserving existing data in tested cases | `apps/api/app/tests/test_migration_safety.py`: 4 passed; final backend suite 214 passed, 6 skipped, 1 deselected | Fake S3 and temporary SQLite only. No external provider, PostgreSQL lock, or production migration was verified. |
