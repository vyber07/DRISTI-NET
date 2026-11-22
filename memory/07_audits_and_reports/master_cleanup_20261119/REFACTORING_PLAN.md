# DRISTI-NET — Master Refactoring & Modernization Plan

**Audit Date:** 2026-11-19  
**Status:** Plan Prepared — Awaiting User Approval Prior to Execution  

---

## 1. Refactoring Objectives & Safety Rules

1. **Zero Downtime / Zero Regressions:** All active routes, API schemas, and frontend workflows must continue passing 100% of automated tests.
2. **Smallest Atomic Batches:** Code modifications must be executed in separate, test-verified commits.
3. **Approval Gate:** In strict accordance with Project Constitution §20 and Master Execution Prompt §12, **no active source-code files are renamed, relocated, or refactored without prior user approval**.

---

## 2. Staged Refactoring Phases

### Phase A: Service Layer Unification (Backend)
- Group extraction parsers (`extract_document.py`, `extract_structured.py`, `extract_common.py`) into a coherent `services/extraction/` package.
- Extract common supervisor approval dependencies across `override_routes.py` and `user_request_routes.py`.
- Run `pytest apps/api/app/tests` to confirm 100% pass rate.

### Phase B: Frontend Custom Hooks & Data Fetching Separation (Frontend)
- Lift inline API fetch and unmask mutation logic out of `EdgeDrawer.tsx` and `NodeDrawer.tsx` into custom hooks (`useNodeDetails`, `useEdgeContext`).
- Retire legacy `real_client.ts` fallback wrapper.
- Run `npm run typecheck` and `npm run build` to verify zero type or bundle errors.

### Phase C: Model & Schema Domain Partitioning (Optional / Long-Term)
- Partition monolithic `models.py` (1,200 lines) and `schemas.py` (1,100 lines) into domain subpackages (`models/case.py`, `models/evidence.py`, `models/pole.py`, `models/audit.py`), maintaining top-level imports in `models/__init__.py` for backward compatibility with Alembic.
