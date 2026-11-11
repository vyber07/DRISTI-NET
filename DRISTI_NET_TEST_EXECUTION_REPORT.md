# DRISTI-NET Test Execution Report

Audit date: 2026-11-07. No source, production data, or infrastructure was changed.

| Check | Command / conditions | Result |
|---|---|---|
| Backend unit suite (initial sandbox attempt) | `DRISTI_DATABASE_URL=sqlite:////tmp/drishti-audit-test.db DRISTI_STORAGE_ROOT=/tmp/drishti-audit-storage DRISTI_SCANNER_MODE=testgate make test` | Stalled in the restricted sandbox before completion; superseded by the successful approved run below. |
| Backend unit suite (approved isolated run) | `DRISTI_DATABASE_URL=sqlite:////tmp/drishti-audit-full.db DRISTI_STORAGE_ROOT=/tmp/drishti-audit-full-storage DRISTI_SCANNER_MODE=testgate DRISTI_SECRET_KEY=<temporary audit key> DRISTI_NEO4J_URI= DRISTI_S3_ENDPOINT_URL= DRISTI_REDIS_URL= DRISTI_KAFKA_BOOTSTRAP_SERVERS= DRISTI_BESU_ENDPOINT= HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 make test` | **PASS**: 210 passed, 6 skipped, 1 deselected in 93.50 s. Used temporary SQLite and storage; external integrations were blanked/offline. Skips/deselection mean this is not a live integration or full production-stack test. |
| Targeted report export test | `DRISTI_DATABASE_URL=sqlite:////tmp/drishti-audit-focused.db DRISTI_STORAGE_ROOT=/tmp/drishti-audit-focused-storage DRISTI_SCANNER_MODE=testgate HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 .venv311/bin/python -m pytest apps/api/app/tests/test_workflow.py::test_report_export -vv --tb=short` | Collection completed but fixture/test produced no completion output; interrupted. **INCOMPLETE**, not pass. This does not reproduce the suspected export masking path. |
| Frontend typecheck | `npm run typecheck` in `apps/web` | **FAILED** with 12 TypeScript errors in `src/services/api/casesApi.ts` lines 6–18: `{}` not assignable to strings/numbers/string[] and `unknown` not assignable to optional string. |
| Frontend lint | `npm run lint` in `apps/web` | Exit 0 with 48 warnings: 39 React rules, 2 React hook dependency warnings, 7 ESLint unused-variable warnings. Warning themes include state updates in effects, missing dependencies, exports affecting Fast Refresh, an in-render component definition, and unused graph toolbar variables. |
| Frontend production build | `npm run build -- --outDir /tmp/drishti-audit-web-dist` | **PASS**: Vite transformed 2087 modules and emitted bundle. Warnings: main JS chunk 844.50 kB; ineffective dynamic import of `real_client.ts`. Build output was outside repository. |
| Pure graph/Merkle tests | `DRISTI_DATABASE_URL=sqlite:////tmp/drishti-pure-audit.db DRISTI_STORAGE_ROOT=/tmp/drishti-pure-audit-storage DRISTI_SCANNER_MODE=testgate HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 .venv311/bin/python -m pytest apps/api/app/tests/test_merkle_rfc6962.py apps/api/app/tests/test_graph_analysis.py -k 'not new_anchor_records' -q` | **PASS**: 42 passed, 1 deselected in 0.10 s. Exercises RFC 6962/legacy Merkle proof behavior and pure graph analysis/aggregation only. Does not exercise API DB workflow or live ledger. |
| Scanner protocol parser (sandbox attempt) | Scanner parser tests plus pure rate-limit tests | **ENVIRONMENT FAILURE**: 8 scanner cases failed at local `socket.socket()` with `PermissionError: [Errno 1] Operation not permitted`; 3 other cases passed. This is sandbox loopback restriction, not demonstrated scanner logic failure. |
| Scanner protocol parser (approved loopback run) | `DRISTI_DATABASE_URL=sqlite:////tmp/drishti-pure-audit-2.db DRISTI_STORAGE_ROOT=/tmp/drishti-pure-audit-storage-2 DRISTI_SCANNER_MODE=testgate HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 .venv311/bin/python -m pytest apps/api/app/tests/test_scanner_parsing.py -q` outside sandbox | **PASS**: 9 passed in 0.03 s. Local mock ClamAV protocol replies only; not a live antivirus daemon test. |
| Rate-limit pure/degraded behavior | `DRISTI_DATABASE_URL=sqlite:////tmp/drishti-pure-audit-3.db DRISTI_STORAGE_ROOT=/tmp/drishti-pure-audit-storage-3 DRISTI_SCANNER_MODE=testgate .venv311/bin/python -m pytest apps/api/app/tests/test_ratelimit.py -k 'not real_redis and not login_endpoint' -q` | **PASS**: 2 passed, 2 deselected in 0.02 s. Does not prove real Redis integration. |
| Config/signature unit tests | `DRISTI_DATABASE_URL=sqlite:////tmp/drishti-pure-audit-4.db DRISTI_STORAGE_ROOT=/tmp/drishti-pure-audit-storage-4 DRISTI_SCANNER_MODE=testgate .venv311/bin/python -m pytest apps/api/app/tests/test_security.py -k 'production_rejects_testgate or testgate_override_requires_explicit_flag or audit_hmac_historical_key_rotation or short_secret_key_rejected_even_on_sqlite' -q` | **PASS**: 4 passed, 21 deselected in 0.03 s. |
| Fixture-backed API smoke test (initial sandbox attempt) | `test_unauthenticated_denied` in temp SQLite DB | Sandbox local transport stalled; superseded by approved isolated run. |
| Fixture-backed API smoke test (approved isolated run) | `DRISTI_DATABASE_URL=sqlite:////tmp/drishti-audit-smoke-escalated.db DRISTI_STORAGE_ROOT=/tmp/drishti-audit-smoke-escalated-storage DRISTI_SCANNER_MODE=testgate DRISTI_SECRET_KEY=<temporary audit key> DRISTI_NEO4J_URI= DRISTI_S3_ENDPOINT_URL= DRISTI_REDIS_URL= DRISTI_KAFKA_BOOTSTRAP_SERVERS= DRISTI_BESU_ENDPOINT= HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 .venv311/bin/python -m pytest apps/api/app/tests/test_security.py::test_unauthenticated_denied -vv --tb=short` | **PASS**: 1 passed in 0.35 s. Confirms unauthenticated denial for this endpoint/test setup only; not a role matrix. |
| Frontend dependency tree | `npm ls --depth=0` in `apps/web` | **PASS**: installed top-level dependency tree resolved without reported missing/invalid dependencies. |
| Python dependency consistency | `.venv311/bin/python -m pip check` | **PASS**: no broken requirements reported. |
| E2E | Not run | `tests/e2e/test_ui_demo.py` writes screenshots under `reports/screenshots/` and its fixture directly updates the target DB; it requires `DRISTI_DATABASE_URL` pointing at a dedicated disposable server DB. No such safe running server was established. |
| Compose status | `docker compose ps` | **UNVERIFIABLE**: Compose interpolation refused because required password variables were absent in effective environment. No values were printed. |

## Test evidence limits

The repository contains backend tests covering auth/security, workflows, uploads, archives, scanner, S3, Neo4j, Kafka, migrations, NER, and Merkle integrity. E2E source currently has 16 tests per frontend audit. Existing `audit/TEST_RESULTS.md`, `reports/*`, and `frontend-audit/*` contain prior results from earlier dates/environments; they are historical evidence and not fresh passes for this audit.

## Exact next test actions

1. Diagnose the `casesApi.ts` type errors and rerun typecheck.
2. Run E2E with a dedicated disposable DB/storage and route screenshot output to an untracked temporary location; current E2E fixture writes to repository paths and mutates DB rows, so do not point it at deployment data.
3. Run live integration tests only against disposable PostgreSQL/Neo4j/MinIO/Redis/Kafka/Besu services; the backend suite run above deliberately did not connect to them.
4. Conduct a fresh backup/restore drill on the intended production DB and object store.

## 2026-11-10 recovery addendum

The 2026-11-07 results above are retained as historical results. Fresh checks against commit `0863cb93fad583866226fb91974a266487de694c` found:

| Check | Result |
|---|---|
| `make test` | **PASS** — 210 passed, 6 skipped, 1 deselected in 86.67s. |
| `npm run typecheck` (before change) | **FAIL reproduced** — 12 TS2322/TS2740 errors in `src/services/api/casesApi.ts`. |
| Case API typing change | Added a typed `BackendCase` contract corresponding to FastAPI `CaseOut` and supplied explicit generic response types to case detail/list/search/create requests. Runtime fallback mapping was retained. |
| `npm run typecheck` (after change) | **PASS** — exit 0. |
| `npm run lint` (after change) | **PASS** — exit 0 with 48 warnings. |
| `npm run build` (after change) | **PASS** — 2087 modules; Vite still warns about an 844.50 kB minified JS chunk and ineffective dynamic import. |
| Case creation API test | **PASS** — `test_create_case_requires_authority_reference`, 1 passed in 2.22s against temporary SQLite; covers invalid missing authority reference and valid creation. |
| Isolated browser E2E | **PASS** — 16 passed in 28.76s against loopback port 8002, temporary synthetic SQLite/object storage, and temporary screenshots. |

The isolated browser E2E run occurred before the type-only `casesApi.ts` fix; its runtime behavior was then checked by a clean typecheck/build, and the backend case-create positive/negative contract test passed after the change. The preliminary browser run for this recovery pass was misrouted to default `localhost:8000` by a misspelled base URL variable (14 passed, 2 failed); test impact and the possible synthetic case/audit events in the running demo are documented in `docs/audit/TEST_EXECUTION_BASELINE_2026-11-10.md`. No cleanup was attempted. The isolated 16/16 result is the valid current E2E result.

### Migration safety follow-up

- Replaced bucket-wide object deletion with preflight key checks, identical-content skips, conflict refusal, unrelated-object preservation, and conditional create (`IfNoneMatch="*"`).
- Replaced full target-table deletion in the SQLite-to-PostgreSQL migration with refusal when any modeled target table is nonempty. PostgreSQL table locks with a five-second lock timeout cover the preflight and import transaction.
- New `apps/api/app/tests/test_migration_safety.py`: **4 passed** using fake S3 and temporary SQLite.
- Final `make test`: **214 passed, 6 skipped, 1 deselected in 91.05s**.
- These checks do not validate a live S3-compatible provider's conditional `PutObject`, PostgreSQL table lock behavior, or an end-to-end migration. Neither migration script was run against an external target.
