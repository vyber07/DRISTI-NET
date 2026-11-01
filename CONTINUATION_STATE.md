# DRISTI-NET — Continuation State & Handoff Record

**Document ID:** DRISTI-CONT-001  
**Timestamp:** 2026-11-01T04:45:00Z  
**Current Phase:** Phase 28 (Step 3: Live Infrastructure & Service Boundary Hardening)  
**Current Task:** P0 and P1 Defect Remediation  
**Last Completed Task:** Phase 0 & Phase 1 Discovery, Roadmap Traceability Matrix, and Inventory Baseline  
**Active Branch:** `main`  
**Latest Git Commit:** `4dc088e` (HEAD)  
**Environment State:**
- Host: Linux x86_64, Docker 29.9.1, Docker Compose v5.6.0
- Python: 3.11.14 in `.venv311` (83/83 unit/integration tests passing)
- Node: v24.22.0, npm 11.19.1 in `apps/web`
- Playwright: Installed in `.venv311`, Chromium headless shell binary installed

---

## 1. Verified Defect Register Summary (To Remediate)

1. `apps/web/src/services/api/integrityApi.ts`: Missing closing brace `}` on line 22 (P0 - blocks build).
2. `apps/web/package.json`: Typecheck script needs `-b` flag (`tsc -b --noEmit`) to enforce project references.
3. `apps/web/src/features/cases/evidence/case-evidence-view.tsx`: Escaped template string syntax (`\${caseId}`, `\${tok}`); missing `useEffect` to load evidence on mount.
4. `apps/web/src/stores/revealStore.ts` & `apps/web/src/services/api/revealApi.ts`: Payload mismatch with backend `RevealIn` schema (`case_id`, `reason`).
5. `apps/web/src/services/api/entityApi.ts`: `GET /entities/${entityId}` missing mandatory `?case_id=` query parameter.
6. `apps/web/src/components/graph/engine/GraphEngine.ts`: Checks non-existent `attr.timestamp` instead of `firstSeen`/`lastSeen`.
7. `apps/web/src/services/api/real_client.ts`: Does not handle binary blob responses for PDF downloads.
8. `apps/api/app/tests/test_storage_s3.py`: Calls non-existent `storage.s3()` instead of `storage._client()`.
9. `scripts/validate_besu.py`: Broken imports and invalid instantiation of SQLAlchemy model as RPC client.
10. `docker-compose.yml`: Redis service missing (login rate-limiting unconfigured); worker does not wait for migrations service.
11. `scripts/dry_run.py` & `docs/contracts.md`: Obsolete references to removed `force_scan_outcome`.
12. `infrastructure/dristinet.service`: Hardcoded directory path `/home/ubuntu/project/DRISTINET`.
13. `apps/web/src/components/graph/GraphLegend.tsx`, `hitl-decision-pane.tsx`, `reports-page.tsx`: Scrub non-neutral terminology ("Court-Ready", "Certified").
14. `apps/web/src/components/intelligence/reveal-identity-modal.tsx`: Inappropriate statutory justification presets (NAFIS biometric, phone KYC).
15. `Makefile`: Destructive `docker compose down -v` in `test-stack`.

---

## 2. Immediate Next Actions

1. Apply P0 fix to `apps/web/src/services/api/integrityApi.ts` and `apps/web/package.json`.
2. Run `make build-web` to prove web compilation is clean.
3. Apply P1 contract and UI bug fixes (evidence view, reveal store, entity API, graph engine, S3 test, besu script, docker-compose, service paths).
4. Run full test suites: `make test` and `make build-web`.
5. Execute Step 4: Golden Synthetic Evidence Journey and Playwright E2E browser validation.
