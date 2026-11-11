# Unread Files Register — 2026-11-10

This register distinguishes file discovery from file inspection. A Git file count or a previous report is not evidence that a file was read in this pass.

## Read or directly reviewed in this pass

| Path | Extent |
|---|---|
| `docs/context.md` | Read first 240 lines; project boundary, architecture, workflows, and source authority reviewed |
| `docs/status.md` | Read first 220 lines; current status assertions reviewed, not every section |
| `Makefile` | Read verification/deployment/test targets; selected safe commands evaluated |
| `apps/api/app/config.py` | Read through configuration and production-secret validation |
| `apps/api/app/seed.py` | Read seed/ingest behavior and ran against a temporary store |
| `apps/api/app/auth.py` | Full 100-line source review |
| `apps/api/app/services/pipeline.py` | Full 199-line source review |
| `apps/api/app/services/scanner.py` | Full 91-line source review |
| `apps/api/app/services/resolution.py` | Full 141-line source review |
| `apps/api/app/models.py` | Full 250-line source/state schema review |
| `apps/api/app/services/graph.py` | Full 210-line source review |
| `apps/api/app/tests/test_workflow.py` | Full 156-line workflow test review |
| `apps/api/app/tests/test_migration_safety.py` | Full test review; 4 synthetic/mock success/failure tests run |
| `scripts/migrate_evidence_to_minio.py` | Full static review and source change; not executed against external S3 |
| `scripts/migrate_sqlite_to_postgres.py` | Full static review and source change; tested against temporary SQLite only, not PostgreSQL |
| `apps/api/app/routes/audit_routes.py` | Full route review |
| `apps/api/app/routes/report_routes.py` | Full export route review |
| `apps/api/app/routes/evidence_routes.py` | Upload path and route sections through line 180; remainder not reviewed |
| `apps/api/app/routes/graph_routes.py` | Entity-card response path around lines 200–220 |
| `apps/api/app/routes/review_routes.py` | Stats response around lines 137–153 |
| `tests/e2e/test_ui_demo.py` | Read relevant suite setup and the complete test list/sections needed to scope the routing incident; test was run from a temporary copy |
| `audit/REPOSITORY_INVENTORY.md` | Read opening service/directory inventory section |
| `audit/TECHNICAL_AUDIT_REPORT.md` | Read opening assertions and test/release claims |
| `audit/PROJECT_SOURCE_RECONCILIATION.md` | Read source-of-truth and historical discrepancy matrix |
| `PROJECT_PROGRESS.md`, `PROJECT_BLOCKERS.md`, `CONTINUATION_STATE.md` | Read opening status, blocker, and next-action sections; continuity conflicts identified |
| `memory/` | Enumerated immediate files and counted snapshot/reference files; read none of the 585 source snapshot files |
| Twelve untracked root `DRISTI_NET_*.md` reports | Headings and portions of substantive reports reviewed; the 232-line master checklist was not read in full |

Reading a section is not full-file inspection; targeted use of `test_ui_demo.py` is not a complete frontend audit.

## Uninspected maintained source and configuration

| Scope | Count / paths | Status |
|---|---|---|
| Backend app Python | 60 files under `apps/api/app/**/*.py`; `config.py`, `seed.py`, `auth.py`, `models.py`, `services/pipeline.py`, `services/scanner.py`, `services/resolution.py`, and `services/graph.py` reviewed | **52 uninspected** |
| Frontend TypeScript | 113 files under `apps/web/src/**/*.ts` and `*.tsx` | **113 uninspected** |
| Other Python | 42 tracked `.py` files outside `apps/api/app/**/*.py`, including scripts, workers, and tests | **42 uninspected** |
| API migrations | `apps/api/migrations/**` | Not inspected |
| Infrastructure | `Dockerfile`, Compose files, `infrastructure/**`, proxy and service units | Not inspected |
| Dependency/configuration | Python requirements/constraints, `pyproject.toml`, package/lock files, Vite/TS configs, CI workflows | Not inspected beyond Makefile targets and `config.py` |
| Data and release artifacts | `data/**`, `graph/**`, `policy/**`, `reports/**`, `releases/**` | Not inspected; sensitive/local content not opened |
| Ignored environment/data | `.env*`, `storage/**`, caches, local virtual environments, `node_modules`, built distributions | Not inspected (except path presence/ignore state) |
| Historical memory | `memory/source_snapshot/**` (585 files), `memory/reference_docs/**` (25 files), context/catalog/index/tree/design/reference documents | Counts/metadata only; content and hash reconciliation pending |

## Current coverage statement

- **Source files listed:** tracked path inventory reports 102 Python, 116 TypeScript/TSX, and 107 Markdown files; see `docs/audit/REPOSITORY_INVENTORY.md`.
- **Source modules inspected line by line:** 8 backend modules/configuration files plus the complete workflow test; remaining backend/frontend source not reviewed line by line.
- **Tests run:** backend `make test`; web `make build-web`; E2E was first misrouted to the already-running local demo due to a test URL variable spelling mismatch, then rerun successfully against an isolated server. See the historical verification register and report below.
- **Full frontend interaction audit:** not performed.
- **Security, data model, migration, deployment, or performance audit:** not completed. The web build's bundle-size warning is an observed measurement, not a full performance assessment.

## Next inspection order

1. Strict backend files and tests: `auth.py`, `models.py`, `services/pipeline.py`, `scanner.py`, `resolution.py`, `graph.py` plus their tests.
2. API routers, persistence/migrations, object storage and graph integrations.
3. Frontend routes, API clients, state stores, feature pages and visible controls, followed by tests.
4. Compose/deployment/configuration and CI, without using deployment or destructive targets.
5. Reconcile each finding with existing audit reports and status claims before drafting the twelve report set.
