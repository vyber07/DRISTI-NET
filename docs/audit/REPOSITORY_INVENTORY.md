# Repository Inventory — 2026-11-10

## Scope

This is a fresh top-level inventory of Git-tracked paths and the existing ignored/runtime areas. It is not a complete source inspection. The baseline is commit `0863cb93fad583866226fb91974a266487de694c` on `main`; the working tree was already dirty before this report was created.

## Counts

| Category | Count | Method / limit |
|---|---:|---|
| Git-tracked paths | 9,713 | `git ls-files \| wc -l` |
| Tracked Python files | 102 | `git ls-files '*.py'` |
| Tracked TypeScript/TSX files | 116 | `git ls-files '*.ts' '*.tsx'` |
| Tracked JavaScript/JSX files | 0 | `git ls-files '*.js' '*.jsx'` |
| Tracked Markdown files | 107 | `git ls-files '*.md'` |
| Backend application Python files | 60 | `git ls-files 'apps/api/app/**/*.py'` |
| Frontend source TS/TSX files | 113 | `git ls-files 'apps/web/src/**/*.ts' 'apps/web/src/**/*.tsx'` |
| Tracked backend/test Python files under app tests and tests | 31 | `git ls-files 'apps/api/app/tests/*.py' 'tests/**/*.py'` |

Counts overlap by design (for example, app tests are Python files). Git paths include binary assets and generated/reference artifacts; counts are not source line coverage.

## Major maintained areas observed

| Area | Paths observed | Inventory classification |
|---|---|---|
| Backend | `apps/api/app/`, `apps/api/migrations/`, `workers/` | Python source, API, services, tests, migrations, worker |
| Frontend | `apps/web/src/`, `apps/web/public/`, `apps/web/package.json` | React/TypeScript source, assets, dependency/build config |
| Tests | `apps/api/app/tests/`, `tests/`, `tests/e2e/`, `tests/infrastructure/` | Unit/integration, browser, infrastructure tests |
| Deployment | `Dockerfile`, `docker-compose*.yml`, `infrastructure/`, `Makefile` | Container, Compose, proxy/system configuration, developer targets |
| Data | `data/synthetic/` | Synthetic fixtures and generator; contents not comprehensively inspected this pass |
| Documentation | `docs/`, `audit/`, `frontend-audit/`, root Markdown | Architecture, status, historical audits, project continuity |
| Runtime/local | `.env*`, `storage/`, `.venv*`, `apps/web/node_modules/`, `apps/web/dist/`, `releases/` | Ignored local configuration, data, dependencies, build output, or release artifacts; contents not inspected |
| Memory | `memory/` | Ignored historical snapshot/reference corpus; counts and selected metadata observed, content/hash audit incomplete |

## Baseline findings

- `git status` reported one modified tracked `.gitignore` and twelve untracked root `DRISTI_NET_*.md` reports before this audit created its own deliverables. All were preserved.
- `.env`, `.env.compose`, and `apps/web/.env` are ignored and were not opened. `storage/` is ignored and was not opened.
- `apps/web/dist/` is ignored. `make build-web` regenerated it during the requested build check; it remained ignored and did not appear as a tracked change.
- Browser E2E screenshot paths in the repository are tracked. E2E verification was redirected to a temporary test root under `/tmp`; the repository screenshot files remained unchanged.
- Existing historical audit documents in `audit/` include claims that conflict with the current `docs/status.md` and continuation files. They remain historical records pending a full reconciliation.

## Inspection coverage

The detailed unread scope is in `docs/audit/UNREAD_FILES_REGISTER.md`. In this pass, source inventory is broad but source review is shallow: 59/60 backend application files and all 113 frontend source files remain uninspected line by line. No claim of a complete technical audit or dead-code determination is made.
