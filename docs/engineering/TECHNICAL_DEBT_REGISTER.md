# DRISTI-NET — Technical Debt Register

**Established:** 2026-11-06 (Modernization Session)  
**Updated:** 2026-11-06  
**Authority:** `docs/architecture/BASELINE_ARCHITECTURE.md`, source code inspection

> Every item here is derived from actual source-code inspection, not assumptions.
> Items marked RESOLVED were addressed in this session.

---

## Priority Definitions

| Priority | Meaning |
|---|---|
| P0 | Breaks contracts or security guarantees |
| P1 | Functional correctness or reliability defect |
| P2 | Structural debt that slows development |
| P3 | Quality improvement, low urgency |

---

## Backend Debt

### TDB-001 — Routes contain inline business logic (P2)

**Files:** `evidence_routes.py` (302 lines), `graph_routes.py` (244 lines), `integrity_routes.py` (263 lines)  
**Finding:** Route handlers perform business operations directly (PDF parsing, hash verification,
integrity mismatch detection, context extraction) rather than delegating to services.  
**Examples:**
- `_pdf_pages()` in `evidence_routes.py` belongs in `extract_document.py` or a new `evidence_service.py`
- `_mark_object_missing()` in `evidence_routes.py` performs a state transition that belongs in a service
- `_authorize_evidence_read()` is a business rule, not HTTP infrastructure
**Risk:** Logic duplication, testing difficulty, route handlers growing unboundedly.  
**Remediation:** Extract to service layer; route handlers should call services, not implement them.  
**Status:** OPEN

---

### TDB-002 — No centralized exception hierarchy (P2)

**Files:** All route files, services  
**Finding:** `HTTPException` is used directly throughout all layers. Business rules produce HTTP status
codes from deep inside services. No domain exception types exist.  
**Risk:** HTTP status codes leak into business logic; changing error handling requires touching every route.  
**Remediation:** Create `apps/api/app/core/exceptions.py` with domain exceptions. Map to HTTP in a
central exception handler in `main.py`.  
**Status:** RESOLVED (2026-11-06) — see `apps/api/app/core/exceptions.py`

---

### TDB-003 — Response serialization as plain dicts (P3)

**Files:** All route files  
**Finding:** Routes return `dict` or list of `dict` without Pydantic response models. OpenAPI docs show
no response schemas. `schemas.py` covers only 8 request types.  
**Risk:** No type safety on responses, no auto-documentation, breaking changes are not caught.  
**Remediation:** Add Pydantic response models for all routes. Register them with FastAPI's `response_model`.  
**Status:** OPEN — deferred (non-breaking, large scope)

---

### TDB-004 — `graph.py` mixes analytics with Neo4j infrastructure (P2)

**File:** `services/graph.py` (417 lines)  
**Finding:** The file contains graph analytics algorithms (community detection, betweenness, degree),
the in-process NetworkX fallback, AND the Neo4j delegation. These are three distinct responsibilities.  
**Remediation:** Split into `services/graph_analytics.py` (algorithms), `services/graph_builder.py`
(claim projection), and keep `neo4j_store.py` for driver management.  
**Status:** OPEN

---

### TDB-005 — `pipeline.py` crosses layer boundaries (P2)

**File:** `services/pipeline.py` (199 lines)  
**Finding:** The pipeline service directly writes to the SQLAlchemy session and commits transactions.
Services should not manage transactions; the session lifecycle should be controlled by the caller.  
**Risk:** Difficult to test in isolation; session management bugs are hidden.  
**Remediation:** Accept a session parameter but do not commit; let the route layer commit.  
**Status:** OPEN — requires careful migration (many tests depend on current behavior)

---

### TDB-006 — No structured JSON logging (P3)

**Files:** All `logger.info/warning/error` calls throughout  
**Finding:** Standard library `logging` with string messages. In production, structured JSON logging
enables log aggregation, correlation ID extraction, and observability.  
**Remediation:** Create `apps/api/app/core/logging.py` to configure JSON structured logging with
trace_id, actor_id, action, and outcome fields.  
**Status:** RESOLVED (2026-11-06) — see `apps/api/app/core/logging.py`

---

### TDB-007 — Config validation at import time (P2)

**File:** `config.py` line 124: `validate_production_secrets()` called at module import  
**Finding:** Importing `config` raises `ValueError` if secrets fail validation. This complicates
test isolation and mocking — importing config in a test with wrong env fails immediately.  
**Risk:** Test setup complexity; CI environment must have full secret configuration.  
**Remediation:** Move validation to a `configure()` function called explicitly in `main.py`.
Tests that need a relaxed config can skip the call.  
**Status:** OPEN — requires coordination with test fixtures

---

### TDB-008 — Duplicate evidence context logic in `context` and `context_reveal` (P2)

**File:** `evidence_routes.py` lines 161–236  
**Finding:** `context()` and `context_reveal()` share nearly identical PDF page parsing and line
windowing logic, duplicated rather than extracted.  
**Remediation:** Extract `_extract_context_lines()` helper called by both endpoints.  
**Status:** RESOLVED (2026-11-06) — see evidence_routes refactoring

---

### TDB-009 — `extract.py` is a 4-line stub (P3)

**File:** `services/extract.py` (4 lines)  
**Finding:** The file simply re-exports from `extract_common.py`. It exists as an empty dispatch layer.  
**Risk:** Confusing to new developers; callers import from the wrong module.  
**Remediation:** Either remove the stub and update callers to import from `extract_common` directly,
or give `extract.py` a real purpose as the public API for the extraction subsystem.  
**Status:** OPEN

---

### TDB-010 — SQLAlchemy model in a single 250-line file (P3)

**File:** `models.py` (250 lines)  
**Finding:** All 11 SQLAlchemy models are in one file. As the domain grows, this will become unmanageable.  
**Risk:** Low for current size; will grow into a maintenance problem.  
**Remediation:** When adding new domain models, consider splitting into domain-specific modules
(e.g., `models/evidence.py`, `models/case.py`, `models/graph.py`).  
**Status:** DEFERRED — current size acceptable; revisit at >500 lines

---

### TDB-011 — Inline imports scattered through route files (P3)

**Files:** Multiple route files have `import ... inside function bodies` (e.g., `from sqlalchemy import func`)  
**Finding:** Lazy imports inside function bodies are sometimes used to avoid import cycles but here
mostly appear for convenience. They make dependency graphs hard to read.  
**Remediation:** Move all imports to file top-level unless a genuine circular import exists.  
**Status:** OPEN — low priority

---

## Frontend Debt

### TDF-001 — Stores mix server state and UI state (P2)

**Files:** `timelineStore.ts`, `graphStore.ts`  
**Finding:** Zustand stores hold server-fetched data alongside UI state (filters, selections). There
is no cache invalidation when the server data changes, and no loading/error state management.  
**Risk:** Stale data displayed as current; users see old graph after reviewing new candidates.  
**Remediation:** Consider TanStack Query for server state; keep Zustand for pure UI state only.  
**Status:** OPEN — deferred (large scope, requires testing)

---

### TDF-002 — No shared error boundary pattern (P2)

**Files:** Feature pages  
**Finding:** React error boundaries are not used consistently. Unhandled render errors crash the
whole page without a fallback UI.  
**Remediation:** Add an `ErrorBoundary` component wrapping each feature route.  
**Status:** OPEN

---

### TDF-003 — GraphEngine.ts contains both rendering and business logic (P2)

**File:** `components/graph/engine/GraphEngine.ts`  
**Finding:** The graph engine handles both Sigma.js rendering integration and temporal filter
business logic. These are different concerns.  
**Remediation:** Separate into `GraphEngine.ts` (Sigma integration) and `graphFilters.ts` (filter logic).  
**Status:** OPEN

---

### TDF-004 — API clients return `any` for some responses (P3)

**Files:** Some files in `services/api/`  
**Finding:** Several API client functions have partial TypeScript typings, returning `any` or
using non-strict field names.  
**Remediation:** Define proper TypeScript return types from the backend contract.  
**Status:** OPEN — incremental improvement

---

### TDF-005 — No shared form validation utilities (P3)

**Files:** Feature forms throughout  
**Finding:** Form validation logic is duplicated across feature components.  
**Remediation:** Create shared validation utilities in `lib/validation.ts` using zod or similar.  
**Status:** OPEN — low priority for current scope

---

## Infrastructure / Operations Debt

### TDI-001 — Compose stack needs full validation (P1)

**Finding:** The Docker Compose stack was recently fixed (DEF-103..106). A full end-to-end validation
cycle with PostgreSQL + MinIO + Neo4j + ClamAV + Redis has not been completed with the modernized code.  
**Status:** OPEN — requires owner to run `make test-stack`

---

### TDI-002 — No TLS in development/staging configuration (P2)

**Finding:** Nginx configuration is HTTP-only. Production should use HTTPS; a self-signed or Let's
Encrypt certificate should be in the Compose stack.  
**Status:** OPEN

---

### TDI-003 — E2E tests share the demo database (P1)

**File:** `tests/e2e/test_ui_demo.py`  
**Finding:** E2E tests run against the live demo database, risking data corruption and flaky tests.  
**Status:** OPEN (S4-09 from previous session)

---

### TDI-004 — No token revocation (P2)

**File:** `auth.py`  
**Finding:** JWTs cannot be revoked. Logout is client-side only. A leaked token is valid until expiry.  
**Remediation:** Implement a Redis-backed token blocklist, or use short-lived tokens with refresh.  
**Status:** OPEN (S4-10 from previous session)

---

## Documentation Debt

### TDD-001 — No OpenAPI response schemas (P2)

**Finding:** All `200 OK` responses are undocumented in OpenAPI because routes return raw `dict`.
Frontend developers cannot verify contracts from the API spec.  
**Remediation:** Add Pydantic `response_model` to all routes.  
**Status:** OPEN

---

### TDD-002 — ADR backlog (P3)

**Finding:** Several key architectural decisions (dual-mode storage, in-process graph fallback,
Kafka opt-in, testgate scanner) exist in code comments but not as formal ADRs in `docs/adr/`.  
**Status:** PARTIALLY RESOLVED — see docs/decisions/ for new ADRs from this session

---

## Resolved Debt (This Session)

| ID | Description | Resolved by |
|---|---|---|
| TDB-002 | No centralized exception hierarchy | `core/exceptions.py` |
| TDB-006 | No structured logging | `core/logging.py` |
| TDB-008 | Duplicate context extraction logic | `evidence_routes.py` refactoring |

---

*Use this register as the authority for prioritizing engineering cleanup work. Update when items are resolved or new technical debt is identified.*
