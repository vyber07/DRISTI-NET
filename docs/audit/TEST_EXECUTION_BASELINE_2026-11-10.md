# Test Execution Baseline — 2026-11-10

Repository commit: `0863cb93fad583866226fb91974a266487de694c` (`main`). Tests ran against the existing worktree without source edits.

## Results

| Check | Result | Evidence / limitations |
|---|---|---|
| `make test` | **PASS** — 210 passed, 6 skipped, 1 deselected in 86.67s | Target runs `pytest apps/api/app/tests -q -k "not test_real_clamav_application_scan"`; this is not the full live integration suite. |
| `npm run typecheck` before case contract fix | **FAIL** — 12 errors in `casesApi.ts` | Reproduced prior BUG-NEW-01 report. |
| `npm run typecheck` after case contract fix | **PASS** — exit 0 | Fix uses typed `BackendCase` response and typed API-client generics. No runtime response validator added. |
| `npm run lint` after case contract fix | **PASS** — exit 0 with 48 warnings | Warnings include React effect/state patterns, Fast Refresh exports, and unused graph-toolbar variables. No warning suppression was added. |
| `make build-web` | **PASS** — Vite built successfully in 2.32s | Minified JS bundle: 844.50 kB (235.17 kB gzip). Vite warned that a chunk exceeds 500 kB and `real_client.ts` has both dynamic and static imports, so the dynamic import will not split it. |
| `make build-web-e2e OUT=/tmp/dristi-net-audit-20261110.5BYtfN/web` | **PASS** | E2E-enabled build written outside the repository. Same large-chunk and ineffective-dynamic-import warnings. |
| Isolated E2E rerun | **PASS** — 16 passed in 28.76s | Existing E2E test copied to temporary test root so screenshot output stayed under `/tmp`; loopback API on port 8002 used temporary SQLite/object storage and the repository's synthetic golden files. The temporary server was stopped after the run. |
| Backend case contract test after frontend fix | **PASS** — 1 passed in 2.22s | `test_create_case_requires_authority_reference` against temporary SQLite; validates rejected missing reference and accepted valid case creation. |
| Migration safety tests | **PASS** — 4 passed in 0.30s | Mock S3 and temporary SQLite; covers safe matching-object skip, conflicting-object refusal, import into an empty target, and refusal/preservation for a nonempty target. |
| Final `make test` after migration changes | **PASS** — 214 passed, 6 skipped, 1 deselected in 91.05s | Includes `test_migration_safety.py`; still excludes the live ClamAV application test and is not the external-service suite. |

## E2E routing incident

The first E2E command intended to use port 8002 but supplied a misspelled base-URL environment variable. The suite fell back to its default `http://localhost:8000`, which was already occupied by the running DRISTI-NET demo. The run ended with **14 passed and 2 failed**; the failures were `test_review_queue` and `test_graph_edge_to_source`. The E2E fixture's explicit database variable pointed at the temporary SQLite database, so its direct candidate reset was isolated, but browser requests went to the running demo.

The passing test list includes `test_create_case_and_assign_a_person`, which creates a synthetic `CASE-E#####` case, and `test_timeline_analysis_report`, which exports a report and expects an audit record. The demo may therefore now contain that synthetic case and test-generated audit events. The exact generated ID was not captured in pytest output. No attempt was made to delete records or alter the running service. The exact scope and any cleanup decision remain open; cleanup must avoid touching unrelated records.

The E2E suite was then rerun with the correct base URL and isolated DB; all 16 tests passed. Screenshots for both runs were directed to the temporary root, not `reports/screenshots/` in the repository.

## Working-tree check

After the checks, `git status` still showed the pre-existing modified `.gitignore` and twelve pre-existing untracked root reports, plus this engagement's new audit documents. No tracked source, tracked report screenshot, or storage path appeared as modified. `git diff --check` passed.

## Not run

- `make test-integration` / full live-service suite.
- Lint, type-check, static analysis, dependency/security scans, coverage, or performance benchmarks.
- Deployment, Docker Compose, migrations, backup/restore, or production health mutation.
- Full Golden Synthetic Evidence Journey through a configured PostgreSQL/MinIO/Neo4j stack.

These checks are not inferred from the passing local unit suite or browser suite.
# Continuation update (2026-11-10)

- Added audit route limit validation and corrected the review identity merge count.
- Focused regression tests: `apps/api/app/tests/test_audit_and_review_stats.py` — **8 passed**.
- Full backend suite after these changes: `make test` — **222 passed, 6 skipped, 1 deselected** in 73.53s.
- SQLite-backed route behavior was exercised. PostgreSQL-specific validation and web rendering of the corrected count were not tested in this update.

