# DRISTI-NET — Master Project Task Board (32-Phase Canonical Roadmap)

**Document ID:** DRISTI-TASK-001  
**Version:** 2.0 (Master Engineering Takeover Edition)  
**Status:** ACTIVE  
**Current Execution Position:** **Step 3 (Infrastructure Validation) → Step 4 (Golden Synthetic Evidence Journey)**  
**Governing Authority:** `docs/context.md` (Project Constitution), `docs/status.md`  

---

## 1. 32-Phase Roadmap Traceability Matrix

| Phase # | Phase Title & Scope | Original Requirement / ADR | Current State | Verification Evidence | Remaining Work | Status |
|---|---|---|---|---|---|---|
| **Phase 0** | Forensics & Repo Discovery | Context §4, Status §1 | Demonstrated | `audit/PROJECT_SOURCE_RECONCILIATION.md`, `audit/REPOSITORY_INVENTORY.md` | Keep updated across milestones | **DONE** |
| **Phase 1** | PostgreSQL Relational Source of Truth | ADR-001, Context §7.3 | Demonstrated | 83 backend tests passing; Alembic migrations in `apps/api/migrations` | Ensure container healthcheck & schema init | **DONE** |
| **Phase 2** | MinIO / S3 Object Storage Backend | ADR-003, Context §7.3 | Demonstrated | `storage.py` dual-mode S3/local; `test_storage_s3.py` | Fix `storage.s3()` test method defect | **DONE** |
| **Phase 3** | Neo4j Bounded Analytical Projection | ADR-002, Context §7.3, §10 | Demonstrated | Parameterized Cypher in `neo4j_store.py`; bounded traversal tests | Maintain case-membership set isolation | **DONE** |
| **Phase 4** | Redis Login Throttling & Cache | ADR-005, Context §7.2 | Demonstrated (Code) | `ratelimit.py`, `test_ratelimit.py` (4 tests pass) | Restore Redis container in `docker-compose.yml` | **IN_PROGRESS** |
| **Phase 5** | Frontend Sigma.js + Graphology Renderer | ADR-006, Context §7.2 | Demonstrated | `apps/web/src/components/graph/` Sigma.js canvas | Fix edge date filter and entity type mapping | **IN_PROGRESS** |
| **Phase 6** | Security Hardening Pass | Security §1-4, Context §15.2 | Demonstrated | `test_security.py` (IDOR, role gates, masking, audit) | Fix dev secret key warning in JWT | **IN_PROGRESS** |
| **Phase 7** | Multi-Backend Full-Stack Verification | ADR-011, Release Gate §19 | Demonstrated | Compose stack definition; seed script ingestion | Verify clean start on fresh stack | **DONE** |
| **Phase 8** | Failure-Injection Testing (Scanner/DB/Storage) | Context §6.1, Directive §39 | Demonstrated | `test_scan_gate_fail_closed`, `test_extraction_failures.py` | Live container stop/start resilience test | **DONE** |
| **Phase 9** | Corrupt-Input Fixtures & Extraction Retry | Context §6.1, Status §6 | Demonstrated | Corrupt CSV and truncated PDF reach `EXTRACTION_FAILED` | Maintain retry idempotency | **DONE** |
| **Phase 10** | Community Stability & Query Timeout | Status §10, §11 | Demonstrated | Bootstrap-perturbation test; Neo4j server-side timeout | Verify timeout on large graph | **DONE** |
| **Phase 11** | Evidence-Level Governance Fields | Context §9.2, Status §9 | Demonstrated | `classification`, `jurisdiction`, `purpose`, `access_class` on Evidence | Maintain immutable upload snapshot | **DONE** |
| **Phase 12** | Archive (.zip) Upload Security Controls | Context §8.3, Status §6 | Demonstrated | `test_archive_uploads.py` (13 tests pass: zip-bomb, traversal rejected) | Preserve pre-decompression inspection | **DONE** |
| **Phase 13** | Edge-Level Governance Fields | Context §10.3, Status §10 | Demonstrated | Edge jurisdiction, access_class, authority_reference mirrored | Test mixed-governance flags | **DONE** |
| **Phase 14** | Graph Query Pagination & Bounds | Context §10.4, Status §10 | Demonstrated | `offset`/`next_offset` pagination in `graph_routes.py` | Safe cancellation remains Architecture target | **DONE** |
| **Phase 15** | Evaluation Reports from Ground Truth | Context §17.2, Status §17 | Demonstrated | `scripts/evaluate.py` fills `reports/*-evaluation.md` from `truth-labels.json` | Re-run on fresh seed | **DONE** |
| **Phase 16** | Map View Over Location Entities | Status §11, `MapView.tsx` | Demonstrated | `GET /cases/{id}/locations` + local coordinate canvas | Accessibility keyboard navigation | **DONE** |
| **Phase 17** | Release Readiness & Performance Testing | Context §18, Reports | Demonstrated | `reports/dry-runs.md` (5x dry runs), `reports/performance.md` | Re-run against live Compose stack | **DONE** |
| **Phase 18** | Accessibility Contrast & Label Pass | Constitution §5, Role 2 | Demonstrated | Form label coverage, button accessible names | Run axe/lighthouse accessibility audit | **DONE** |
| **Phase 19** | Supernode-Capping Test Coverage | Context §10.4, §17.2 | Demonstrated | `test_supernode_capping_on_a_planted_high_degree_node` | Maintain degree bounds in graph traversals | **DONE** |
| **Phase 20** | Limitations Documentation Resync | `docs/limitations.md` | Demonstrated | Explicit disclosure of prototype boundaries | Keep updated with latest test evidence | **DONE** |
| **Phase 21** | Visual Redesign & UI Depth System | Constitution Role 2 | Demonstrated | Typography, Tailwind CSS tokens, surface depth layers | Clean up remaining layout glitches | **DONE** |
| **Phase 22** | Hosted Deployment & Persistence Hardening | ADR-011, README | Demonstrated | Port 80 Nginx reverse proxy, auto-restart policies | Correct hardcoded paths in systemd service | **DONE** |
| **Phase 23** | Kafka Event Bus & Outbox Worker Integration | ADR-013, Status §8 | Demonstrated (Code) | `kafka_bus.py`, `workers/worker.py`, `test_new_components.py` | Live container validation in Compose | **IN_PROGRESS** |
| **Phase 24** | Hyperledger Besu Ledger Anchoring & Merkle Verification | ADR-014, Status §9 | Demonstrated (Code) | `integrity.py`, `LedgerAnchor` table, `test_new_components.py` | Fix `validate_besu.py` script defects | **IN_PROGRESS** |
| **Phase 25** | AI IndicBERTv2 NER & PaddleOCR Ingestion Adapters | ADR-012, Status §11 | Demonstrated (Code) | `nlp_adapter.py`, `ocr_adapter.py`, `test_new_components.py` | Measure real inference time and fallback | **IN_PROGRESS** |
| **Phase 26** | Legal-Neutral Evidence Dossier Export | Status §11, Court PDF | Demonstrated (Code) | `services/court_pdf.py`, `test_new_components.py` | Scrub non-neutral terminology ("Court-Ready") | **IN_PROGRESS** |
| **Phase 27** | HITL Decision Persistence & Audit Trail Reconciliation | Context §11.2, §12 | Demonstrated (Code) | `review_routes.py`, `hitlStore.ts`, `case-overview-view.tsx` | Fix reveal API payload & entity API case_id | **IN_PROGRESS** |
| **Phase 28** | Live Full-Stack Infrastructure & Service Boundary Hardening *(Step 3)* | Directive Step 3 | MVP Target | Active services, healthchecks, secret rotation | Restore Redis in compose, fix systemd path | **IN_PROGRESS** |
| **Phase 29** | Golden Synthetic Evidence Journey Verification *(Step 4)* | Directive Step 4 | MVP Target | Synthetic upload → scan → extract → HITL → graph → dossier | Execute full synthetic journey end-to-end | **READY** |
| **Phase 30** | Real Browser E2E & Visual Journey Validation | Directive Part 15 | MVP Target | Playwright Chromium installed, `tests/e2e` suite | Execute E2E against running API & UI | **READY** |
| **Phase 31** | Government & Regulatory Readiness Assessment | Directive Part 19 | Target | DPDP 2023, IT Act 2000, CERT-In, STQC assessment | Produce `GOVERNMENT_READINESS_MATRIX.md` | **READY** |

---

## 2. Priority Defect Remediation Workstreams

### P0 Workstream — Release Blockers
- **P0-1:** Fix missing closing brace `}` in `apps/web/src/services/api/integrityApi.ts` to unblock `make build-web`.
- **P0-2:** Update `apps/web/package.json` typecheck script to `tsc -b --noEmit` to prevent false-positive typechecks.
- **P0-3:** Fix escaped template interpolation (`\${caseId}`, `\${tok}`) in `apps/web/src/features/cases/evidence/case-evidence-view.tsx`.
- **P0-4:** Mount evidence loader on component mount (`useEffect`) in `case-evidence-view.tsx`.

### P1 Workstream — Functional & API Contract Corrections
- **P1-1:** Fix Reveal API contract mismatch: align `revealStore.ts` and `revealApi.ts` with backend `RevealIn` (`case_id`, `reason`).
- **P1-2:** Fix Entity API contract: pass required `case_id` query parameter in `entityApi.ts`.
- **P1-3:** Fix Graph temporal filter: inspect `firstSeen` / `lastSeen` on edges instead of non-existent `timestamp` in `GraphEngine.ts`.
- **P1-4:** Fix Graph node and relationship type vocabulary mapping between frontend filters and backend ontology.
- **P1-5:** Fix binary PDF download handling in API client and dossier download routes.
- **P1-6:** Fix `apps/api/app/tests/test_storage_s3.py` to use valid client access (`storage._client()`).
- **P1-7:** Fix `scripts/validate_besu.py`: remove non-existent `MerkleTree` import, use `submit_to_besu` instead of treating model as RPC client.
- **P1-8:** Restore Redis container in `docker-compose.yml` and wire `DRISHTI_REDIS_URL` for login throttling.
- **P1-9:** Ensure `worker` container in `docker-compose.yml` waits for `migrations` to complete successfully.
- **P1-10:** Clean up obsolete `force_scan_outcome` references in `scripts/dry_run.py` and `docs/contracts.md`.
- **P1-11:** Fix hardcoded repo path `/home/ubuntu/project/DRISTINET` in `infrastructure/dristinet.service`.
- **P1-12:** Neutralize UI copy: replace "Court-Ready", "Certified" with neutral "Integrity Dossier (BSA s.63(4)(c) Reference)".
- **P1-13:** Neutralize statutory justification presets in `reveal-identity-modal.tsx` to eliminate prohibited enforcement claims.
- **P1-14:** Make `Makefile` safe: eliminate `-v` from `test-stack` to prevent volume data destruction.
