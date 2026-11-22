# DRISTI-NET — Comprehensive Codebase Architecture Audit

**Audit Date:** 2026-11-19  
**Auditor:** Senior Software Architect & Codebase Auditor  
**Scope:** Full repository source code (`apps/api/`, `apps/web/`, `workers/`, `scripts/`, `infrastructure/`)  
**Status:** Audit Complete — Findings Presented for User Review & Approval  

---

## 1. Executive Codebase Summary

- **Backend:** 18 API route modules, 27 domain services, ~8,900 lines of Python. Strong typing with Pydantic v2 and SQLAlchemy 2.0. Good separation of concerns in newer modules (`account_routes.py`, `evidence_routes.py`), but some overlap between `extract_document.py`, `extract_structured.py`, and `extract_common.py`.
- **Frontend:** React 18, TypeScript 5, Vite 5, Tailwind CSS v4, Zustand. Clean presentation layer with Radix UI headless components. State management is well partitioned across 5 Zustand stores.
- **Test Suite:** 540+ passing automated backend tests (`pytest apps/api/app/tests`), 0 TypeScript errors (`npm run typecheck`), and clean build.

---

## 2. Key Architectural Findings

### 2.1 Backend Findings
1. **Extraction Service Fragmentation:**
   - Text parsing logic is split across `extract.py` (4 lines, mostly forwarding to `_check_archive`), `extract_document.py` (192 lines), `extract_structured.py` (140 lines), and `extract_common.py` (300 lines).
   - *Recommendation:* Unify under a coherent `services/extraction/` package with clear format handlers (`pdf.py`, `csv.py`, `json.py`, `archive.py`).
2. **Policy & Governance Routes:**
   - `masking_routes.py`, `override_routes.py`, `upload_policy_routes.py`, and `user_request_routes.py` share similar audit-logging and supervisor-approval patterns.
   - *Recommendation:* Consolidate into a unified `governance_routes.py` or domain feature package.
3. **Model & Schema Separation:**
   - `models.py` (SQLAlchemy ORM) and `schemas.py` (Pydantic models) are large monolithic single files (1,200+ lines each).
   - *Recommendation:* Partition into domain-specific model files (`models/case.py`, `models/evidence.py`, `models/graph.py`, `models/audit.py`).

### 2.2 Frontend Findings
1. **API Client Consistency:**
   - Most clients follow a clean functional pattern (`casesApi.ts`, `authApi.ts`, `accountApi.ts`), but `real_client.ts` contains legacy fallback wrappers.
   - *Recommendation:* Retire `real_client.ts` in favor of standard `client.ts` with typed error interception.
2. **Component Boundaries:**
   - Graph detail drawers (`EdgeDrawer.tsx`, `NodeDrawer.tsx`) contain inline fetch and unmask mutation logic.
   - *Recommendation:* Lift data-fetching and reveal mutations into custom hooks (`useNodeDetails`, `useEdgeContext`).

---

## 3. Next Steps & Approval Register

All proposed refactoring steps are cataloged in `REFACTORING_PLAN.md` and `CODE_CHANGE_APPROVAL_REGISTER.csv`. As mandated by the Master Execution Prompt, **no code logic is modified without explicit user approval**.
