# DRISTI-NET — Refactoring Plan

**Established:** 2026-11-06 (Modernization Session)  
**Current phase:** Stage 3 (Foundation) — IN PROGRESS  
**Authority:** Master Engineering Modernization Prompt, `docs/engineering/TECHNICAL_DEBT_REGISTER.md`

> This plan is dependency-aware. Each stage has an exit condition that must pass before the
> next stage begins. No stage breaks the existing test suite.

---

## Execution Principle

> Do not refactor the entire repository in one uncontrolled operation. Implement incrementally
> with tests at each stage. Verify the Golden Synthetic Evidence Journey after major changes.

Baseline to preserve: **199 passed / 7 skipped** (`make test-unit`)

---

## Stage 1 — Baseline (COMPLETE)

**Goal:** Understand the existing application before changing it.

- [x] Read all project documentation (context.md, status.md, continuation state, task board)
- [x] Inventory entire repository folder structure
- [x] Map backend routes, services, models
- [x] Map frontend features, components, stores, API clients
- [x] Establish API contracts (route handlers and their schemas)
- [x] Run baseline tests (199 passed / 7 skipped)
- [x] Identify architectural weaknesses (see TECHNICAL_DEBT_REGISTER.md)
- [x] Document baseline architecture (see BASELINE_ARCHITECTURE.md)

**Exit condition:** ✓ Current implementation understood. Baseline recorded.

---

## Stage 2 — Target Architecture (COMPLETE)

**Goal:** Design the target structure before moving files.

- [x] Design target backend module organization (`core/`, `api/`, `domain/`, `repositories/`)
- [x] Define naming standards (see CODING_STANDARDS.md)
- [x] Define module boundaries and dependency rules
- [x] Define error handling approach (see ERROR_HANDLING_STANDARD.md)
- [x] Define state management approach (see frontend docs)
- [x] Define environment configuration approach
- [x] Document target architecture (see SYSTEM_ARCHITECTURE.md)

**Exit condition:** ✓ Target architecture and migration plan documented.

---

## Stage 3 — Foundation (IN PROGRESS)

**Goal:** Establish the engineering foundation: exceptions, logging, configuration.

### 3.1 Backend foundation

- [x] Create `apps/api/app/core/__init__.py`
- [x] Create `apps/api/app/core/exceptions.py` — domain exception hierarchy (TDB-002)
- [x] Create `apps/api/app/core/logging.py` — structured logging configuration (TDB-006)
- [ ] Update `apps/api/app/main.py` to register centralized exception handlers
- [ ] Add structured logging initialization to `main.py` startup

### 3.2 Documentation foundation

- [x] `docs/architecture/BASELINE_ARCHITECTURE.md`
- [x] `docs/engineering/TECHNICAL_DEBT_REGISTER.md`
- [x] `docs/engineering/CODING_STANDARDS.md`
- [x] `docs/engineering/ERROR_HANDLING_STANDARD.md`
- [x] `docs/engineering/REFACTORING_PLAN.md`
- [ ] `docs/engineering/REFACTORING_PROGRESS.md`
- [ ] `docs/engineering/CODE_CLEANUP_REGISTER.md`
- [ ] `docs/architecture/SYSTEM_ARCHITECTURE.md`
- [ ] `docs/frontend/STATE_MANAGEMENT_ARCHITECTURE.md`
- [ ] `docs/backend/SERVICE_ARCHITECTURE.md`

### 3.3 Code quality tooling

- [ ] Verify `oxlint` (already in package.json devDependencies) is configured for frontend
- [ ] Add `ruff` configuration to `pyproject.toml` for backend linting
- [ ] Configure `mypy` or `pyright` for backend type checking

**Exit condition:** `make test-unit` passes (199+). Core module importable. Logging structured.

---

## Stage 4 — Backend Modularization (PLANNED)

**Goal:** Separate business logic from HTTP handling in route files.

### 4.1 Evidence routes cleanup (TDB-001, TDB-008)

- [ ] Extract `_pdf_pages()` from `evidence_routes.py` → `services/extract_document.py`
- [ ] Extract `_mark_object_missing()` → `services/evidence_service.py` (new)
- [ ] Extract `_authorize_evidence_read()` → `services/evidence_service.py`
- [ ] Extract duplicate context extraction logic → `_extract_context_lines()` helper
- [ ] Run: `make test-unit` must still pass

### 4.2 Graph service split (TDB-004)

- [ ] Inspect `services/graph.py` (417 lines) in detail
- [ ] Extract graph analytics algorithms → `services/graph_analytics.py`
- [ ] Extract claim projection logic → `services/graph_builder.py`
- [ ] Keep Neo4j interaction in `services/neo4j_store.py`
- [ ] Run: graph tests must pass

### 4.3 Schemas consolidation (TDB-003)

- [ ] Identify all inline dict returns in route files
- [ ] Create `schemas/` package with domain-specific schemas:
  - `schemas/evidence.py` — EvidenceOut, EvidenceListOut
  - `schemas/case.py` — CaseOut, CaseListOut
  - `schemas/graph.py` — GraphOut, NodeOut, EdgeOut
  - `schemas/review.py` — CandidateOut, DecisionOut
  - `schemas/audit.py` — AuditEventOut
- [ ] Add `response_model` to key routes
- [ ] Run: `make test-unit` must pass; `make build-web` must pass

### 4.4 Extract.py stub cleanup (TDB-009)

- [ ] Either expand `services/extract.py` to be the extraction subsystem's public API,
  or remove it and update callers
- [ ] Update `evidence_routes.py` imports accordingly

**Exit condition:** Route handlers are thin. Services do the work. Tests still pass.

---

## Stage 5 — Frontend Modularization (PLANNED)

**Goal:** Ensure feature components are separated from business logic.

### 5.1 GraphEngine separation (TDF-003)

- [ ] Extract temporal filter logic from `GraphEngine.ts` → `lib/graphFilters.ts`
- [ ] GraphEngine.ts handles Sigma.js integration only

### 5.2 Error boundary coverage (TDF-002)

- [ ] Create shared `components/layout/ErrorBoundary.tsx`
- [ ] Wrap each feature route in `router.tsx` with the error boundary

### 5.3 API client type safety (TDF-004)

- [ ] Audit all files in `services/api/` for `any` return types
- [ ] Add TypeScript return types to all API client functions

**Exit condition:** Existing officer workflows remain functional (verify via `make e2e`).

---

## Stage 6 — Database and API Validation (PLANNED)

**Goal:** Verify contracts after refactoring.

- [ ] Verify all API contracts match frontend client expectations
- [ ] Verify database migrations are valid after schema changes
- [ ] Verify transaction behavior in reorganized services
- [ ] Verify authorization on all modified routes
- [ ] Run: `make test-unit && make e2e`

---

## Stage 7 — Cleanup (PLANNED)

**Goal:** Remove verified dead and duplicate code.

- [ ] Remove `services/extract.py` stub (after Stage 4.4)
- [ ] Remove any unused imports identified by ruff
- [ ] Remove obsolete `force_scan_outcome` references in scripts (P1-10 from task board)
- [ ] Remove any duplicate constants

---

## Stage 8 — Security and Testing (PLANNED)

- [ ] Re-run full security test suite (`test_security.py`)
- [ ] Re-run Golden Synthetic Evidence Journey
- [ ] Run E2E tests (`make e2e`)
- [ ] Run frontend type check (`npm run typecheck` from `apps/web/`)
- [ ] Run frontend lint (`npx oxlint src/` from `apps/web/`)

---

## Stage 9 — Documentation and Release (PLANNED)

- [ ] Update README.md with current architecture
- [ ] Update CONTINUATION_STATE.md
- [ ] Generate ADRs for all stage decisions
- [ ] Commit all changes to worktree branch
- [ ] Create PR for owner review

---

## Risk Register

| Risk | Mitigation |
|---|---|
| Test breakage from route refactoring | Run test-unit after each file change |
| Import cycle from core module | Use TYPE_CHECKING guard for heavy imports |
| Schema change breaking API contract | Add response_model without changing field names first |
| Graph service split breaking neo4j tests | Keep integration tests for neo4j_store separate |
| Frontend build break | Run `make build-web` after any schema changes |

---

*Track completion of individual tasks in `REFACTORING_PROGRESS.md`.*
