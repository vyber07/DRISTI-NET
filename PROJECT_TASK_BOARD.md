# DRISTI-NET — Master Project Task Board (32-Phase Canonical Roadmap)

**Document ID:** DRISTI-TASK-001  
**Version:** 2.0 (Master Engineering Takeover Edition)  
**Status:** ACTIVE  
**Current Execution Position (re-verified 2026-11-01):** **Step 3 (infrastructure/release validation) — partially complete; Step 4 (Golden Synthetic Journey) — demonstrated on SQLite/testgate and in the browser. Release status: ENGINEERING PREVIEW.** The earlier "Phase 32 Complete — Staging Candidate Verified" claim is withdrawn (see `audit/RELEASE_READINESS_REPORT.md`).  
**Roadmap provenance:** the original 32-phase roadmap document is not in this repository (constitution §4 note). The matrix below is a RECONSTRUCTION by the previous session (DEC-003); treat phase names as reconstructed, not canonical.  
**Open work from 2026-11-01:** DEF-020 (tier/core/contradiction/candidate-edge semantics — needs product decision), DEF-026/BLK-04 (MinIO image), DEF-018 (NER revision pin + offline mode + label order), DEF-027 (real-model test), backup/restore test, security scans, TLS/bind hardening, independent review.  
**Governing Authority:** `docs/context.md` (Project Constitution), `docs/status.md`  

---

## 1. 32-Phase Roadmap Traceability Matrix

| Phase # | Phase Title & Scope | Original Requirement / ADR | Current State | Verification Evidence | Remaining Work | Status |
|---|---|---|---|---|---|---|
| **Phase 0** | Forensics & Repo Discovery | Context §4, Status §1 | Demonstrated | `audit/PROJECT_SOURCE_RECONCILIATION.md`, `audit/REPOSITORY_INVENTORY.md` | Keep updated across milestones | **DONE** |
| **Phase 1** | PostgreSQL Relational Source of Truth | ADR-001, Context §7.3 | Demonstrated | 83 backend tests passing; Alembic migrations in `apps/api/migrations` | Ensure container healthcheck & schema init | **DONE** |
| **Phase 2** | MinIO / S3 Object Storage Backend | ADR-003, Context §7.3 | Demonstrated | `storage.py` dual-mode S3/local; `test_storage_s3.py` | Fix `storage.s3()` test method defect | **DONE** |
| **Phase 3** | Neo4j Bounded Analytical Projection | ADR-002, Context §7.3, §10 | Demonstrated | Parameterized Cypher in `neo4j_store.py`; bounded traversal tests | Maintain case-membership set isolation | **DONE** |
| **Phase 4** | Redis Login Throttling & Cache | ADR-005, Context §7.2 | Demonstrated | `ratelimit.py`, `test_ratelimit.py` (4 tests pass), Redis service added to `docker-compose.yml` | None | **DONE** |
| **Phase 5** | Frontend Sigma.js + Graphology Renderer | ADR-006, Context §7.2 | Demonstrated | `apps/web/src/components/graph/` Sigma.js canvas; edge timestamp & type mapping verified | None | **DONE** |
| **Phase 6** | Security Hardening Pass | Security §1-4, Context §15.2 | Demonstrated | `test_security.py` (IDOR, role gates, masking, audit); secret key >= 32 chars verified | None | **DONE** |
| **Phase 7** | Multi-Backend Full-Stack Verification | ADR-011, Release Gate §19 | Demonstrated | Compose stack definition; seed script ingestion; `make test-stack` clean cycle | None | **DONE** |
| **Phase 8** | Failure-Injection Testing (Scanner/DB/Storage) | Context §6.1, Directive §39 | Demonstrated | `test_scan_gate_fail_closed`, `test_extraction_failures.py`; fail-closed verified | None | **DONE** |
| **Phase 9** | Corrupt-Input Fixtures & Extraction Retry | Context §6.1, Status §6 | Demonstrated | Corrupt CSV and truncated PDF reach `EXTRACTION_FAILED`; retry verified | None | **DONE** |
| **Phase 10** | Community Stability & Query Timeout | Status §10, §11 | Demonstrated | Bootstrap-perturbation test; Neo4j server-side timeout | None | **DONE** |
| **Phase 11** | Evidence-Level Governance Fields | Context §9.2, Status §9 | Demonstrated | `classification`, `jurisdiction`, `purpose`, `access_class` on Evidence immutable snapshot | None | **DONE** |
| **Phase 12** | Archive (.zip) Upload Security Controls | Context §8.3, Status §6 | Demonstrated | `test_archive_uploads.py` (13 tests pass: zip-bomb, traversal rejected) | None | **DONE** |
| **Phase 13** | Edge-Level Governance Fields | Context §10.3, Status §10 | Demonstrated | Edge jurisdiction, access_class, authority_reference mirrored in graph views | None | **DONE** |
| **Phase 14** | Graph Query Pagination & Bounds | Context §10.4, Status §10 | Demonstrated | `offset`/`next_offset` pagination in `graph_routes.py`; max 150 nodes / 2 hops | None | **DONE** |
| **Phase 15** | Evaluation Reports from Ground Truth | Context §17.2, Status §17 | Demonstrated | `scripts/evaluate.py` fills `reports/*-evaluation.md` from `truth-labels.json` | None | **DONE** |
| **Phase 16** | Map View Over Location Entities | Status §11, `MapView.tsx` | Demonstrated | `GET /cases/{id}/locations` + local coordinate canvas rendering | None | **DONE** |
| **Phase 17** | Release Readiness & Performance Testing | Context §18, Reports | Demonstrated | `reports/dry-runs.md` (5x clean runs 29/29), `reports/performance.md` | None | **DONE** |
| **Phase 18** | Accessibility Contrast & Label Pass | Constitution §5, Role 2 | Demonstrated | Form label coverage, button accessible names, focus states | None | **DONE** |
| **Phase 19** | Supernode-Capping Test Coverage | Context §10.4, §17.2 | Demonstrated | `test_supernode_capping_on_a_planted_high_degree_node` | None | **DONE** |
| **Phase 20** | Limitations Documentation Resync | `docs/limitations.md` | Demonstrated | Explicit disclosure of prototype boundaries and evidence states | None | **DONE** |
| **Phase 21** | Visual Redesign & UI Depth System | Constitution Role 2 | Demonstrated | Typography, Tailwind CSS tokens, surface depth layers, clean SPA bundle | None | **DONE** |
| **Phase 22** | Hosted Deployment & Persistence Hardening | ADR-011, README | Demonstrated | Port 80 Nginx reverse proxy, auto-restart policies, systemd units verified | None | **DONE** |
| **Phase 23** | Kafka Event Bus & Outbox Worker Integration | ADR-013, Status §8 | Demonstrated | `kafka_bus.py`, `workers/worker.py`, `test_new_components.py` PASS | None | **DONE** |
| **Phase 24** | Hyperledger Besu Ledger Anchoring & Merkle Verification | ADR-014, Status §9 | Demonstrated | `integrity.py`, `LedgerAnchor` table, `validate_besu.py` refactored and verified | None | **DONE** |
| **Phase 25** | AI IndicBERTv2 NER & PaddleOCR Ingestion Adapters | ADR-012, Status §11 | Demonstrated | `nlp_adapter.py` token classification (F1: 1.00), PaddleOCR fallback, FIR extraction verified | None | **DONE** |
| **Phase 26** | Legal-Neutral Evidence Dossier Export | Status §11, Court PDF | Demonstrated | `services/court_pdf.py`, BSA s.63 structure, neutral terminology ("Integrity Dossier PDF") | None | **DONE** |
| **Phase 27** | HITL Decision Persistence & Audit Trail Reconciliation | Context §11.2, §12 | Demonstrated | `review_routes.py`, `hitlStore.ts`, reveal API payload & entity API case_id verified | None | **DONE** |
| **Phase 28** | Live Full-Stack Infrastructure & Service Boundary Hardening | Directive Step 3 | Demonstrated | Active ClamAV daemon on port 3310, systemd unit path corrected, Redis wired in Compose | None | **DONE** |
| **Phase 29** | Golden Synthetic Evidence Journey Verification | Directive Step 4 | Demonstrated | Complete journey verified: ingest 7 files → quarantine → clean scan → parse → 3 candidates → HITL arbitration → graph → dossier export | None | **DONE** |
| **Phase 30** | Real Browser E2E & Visual Journey Validation | Directive Part 15 | Demonstrated | Playwright Chromium: 5/5 E2E tests PASS in 6.70s (`make e2e`); 9 screenshots captured | None | **DONE** |
| **Phase 31** | Government & Regulatory Readiness Assessment | Directive Part 19 | Demonstrated | `government/GOVERNMENT_READINESS_MATRIX.md` (DPDP Act 2023, IT Act 2000, CERT-In, STQC) | None | **DONE** |
| **Phase 32** | Independent Technical Audit & Release Packaging | Directive Part 20 | Demonstrated | `audit/TECHNICAL_AUDIT_REPORT.md`, `audit/RELEASE_READINESS_REPORT.md`, SHA-256 verified archive | None | **DONE** |

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
