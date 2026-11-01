# DRISTI-NET — Project Source Reconciliation

**Document ID:** DRISTI-AUDIT-003  
**Status:** VERIFIED BASELINE  
**Date:** 2026-11-01  
**Authority:** `docs/context.md` (§3, §4)  

---

## 1. Executive Summary

This document forensically reconciles all project source documentation, historical snapshots, release manifests, and the active codebase as mandated by Part 2.3 of the Master Engineering Takeover Directive.

Conflicts between planning claims, documentation claims, and actual running implementation are reconciled using the strict **Evidence Hierarchy** defined in `audit/SOURCE_OF_TRUTH.md`:
1. **Level 1 (Authoritative):** Source Code & Runtime Execution (`apps/api`, `apps/web`, `workers`, Docker)
2. **Level 2:** Database Schemas & Alembic Migrations (`apps/api/app/models.py`, `apps/api/migrations`)
3. **Level 3:** Automated Tests & CI/CD Verification (`apps/api/app/tests`, `tests/e2e`)
4. **Level 4:** Active Configuration (`docker-compose.yml`, `.env.example`, `config.py`)
5. **Level 5:** Architecture Decision Records (`docs/adr/*.md`)
6. **Level 6 (Non-Authoritative):** Historical documentation, summaries, slide decks, and external presentations

---

## 2. Source Reconciliation Matrix

| Source Document / Artifact | Version / Commit / Date | Content Description | Evidence Quality | Identified Conflicts | Authoritative Resolution |
|---|---|---|---|---|---|
| `docs/context.md` | v1.0 (2026-09) | Core Project Constitution: boundaries, roles, data contracts, failure states, language rules. | LEVEL 5 (Canonical Constitution) | None. Project foundation. | **Authoritative Constitution.** All prompts and implementations are subordinate to this document. |
| `docs/status.md` | 2026-09-25 | Blueprint Status Audit: Demonstrated vs MVP Target vs Roadmap. | LEVEL 5 (High) | References `TASK_BOARD.md` which was deleted in commit `f1633da`. | **Adopted as Verified Status Baseline.** References reconciled to reconstructed master `PROJECT_TASK_BOARD.md`. |
| `Export 11` / `reports/release-checklist.md` | Commit `01b22d2` / `c1df095` (2026-09-12) | Release checklist claims 58/58 unit tests passing, Playwright e2e pass, release archives. | LEVEL 3 & 6 (Mixed) | Export 11 represents a historical release milestone, not a final guarantee of current production readiness. | Re-verified: backend has grown to 83 unit/integration tests passing. Frontend build and e2e need active validation. |
| `0310914:TASK_BOARD.md` | Commit `0310914` (2026-09-18) | 23 development phases (Phase 0 to Phase 22) tracking migration from prototype to full stack. | LEVEL 3 & 5 (High) | Was deleted in commit `f1633da` during mock-data cleanup, leaving hanging references in `docs/status.md` and `scripts/make_packages.py`. | **Recovered & Preserved.** Forms Phases 0–22 of the canonical 32-phase master roadmap. |
| Commit `558f28c` & `3ba68d6` | 2026-09-23 to 2026-09-25 | Outbox Kafka integration, Besu Merkle anchoring, IndicBERT NER, HITL persistence. | LEVEL 1 & 2 (Authoritative) | Added Kafka, Besu, PaddleOCR, and IndicBERT but omitted Redis service from `docker-compose.yml`. | Reconcile: Retain Kafka/Besu/NLP components; restore Redis container in Compose for login throttling. |
| `apps/web/src/services/api/integrityApi.ts` | Working tree (post `f1633da`) | Frontend API service for integrity anchors and court PDF dossier. | LEVEL 1 (Broken) | Missing closing brace `}` on line 22, syntax error blocking `make build-web`. | **P0 Defect.** Fix closing brace and restore compile integrity. |
| `apps/web/tsconfig.json` | Active | TypeScript compiler configuration with references-only mode. | LEVEL 4 (Misconfigured) | `tsc --noEmit` produces a false-positive pass because project references require `tsc -b --noEmit`. | Update `package.json` script `typecheck` to `tsc -b --noEmit`. |
| `apps/web/src/features/cases/evidence/case-evidence-view.tsx` | Active | Evidence repository UI view. | LEVEL 1 (Broken) | Escaped template strings (`\${caseId}`, `\${tok}`); `useEffect` missing so evidence is not fetched on mount. | **P1 Defect.** Unescape template strings and bind `loadEvidence` on mount with `caseId`. |
| `apps/web/src/stores/revealStore.ts` & `revealApi.ts` | Active | Sensitive identifier unmasking workflow. | LEVEL 1 (Contract Mismatch) | Sends `justification`, `emergencyBypass`, `caseId: "unknown"` instead of backend `RevealIn` schema (`case_id`, `reason`). | **P1 Defect.** Align frontend reveal store to backend contract (`case_id`, `reason`), preserve audit logging. |
| `apps/web/src/services/api/entityApi.ts` | Active | Entity details endpoint caller. | LEVEL 1 (Contract Mismatch) | Calls `GET /entities/${entityId}` without mandatory `?case_id=` query param, resulting in 422 Unprocessable Entity. | **P1 Defect.** Pass `case_id` query parameter in `getEntityDetails`. |
| `apps/web/src/components/graph/engine/GraphEngine.ts` | Active | Graph engine date filtering and temporal playback. | LEVEL 1 (Broken) | Checks `attr.timestamp` which is `undefined` on edges (actual fields are `firstSeen` / `lastSeen`). | **P1 Defect.** Correct date filtering logic to inspect `firstSeen` and `lastSeen`. |
| `scripts/validate_besu.py` | Active | Besu EVM anchor test script. | LEVEL 1 (Broken) | Imports non-existent `MerkleTree` class and instantiates SQLAlchemy model `LedgerAnchor` as an RPC client. | Reconcile script to use actual `merkle_root()` and `submit_to_besu()` from `integrity.py`. |
| `apps/api/app/tests/test_storage_s3.py` | Active | S3 / MinIO backend test. | LEVEL 3 (Defect) | Calls `storage.s3()` which does not exist (`storage._client()` is internal). | Expose `s3 = _client` or call `_client()` directly in `storage.py`. |
| `docker-compose.yml` | Active | Multi-container application stack. | LEVEL 4 (Defect) | `worker` does not wait for `migrations: condition: service_completed_successfully`; Redis service absent; Nginx on HTTP 80 only. | **P1 Ops Defect.** Update compose dependencies and ensure Redis throttling is available. |
| `scripts/dry_run.py` & `docs/contracts.md` | Active | Rehearsal script and endpoint documentation. | LEVEL 3 & 6 (Stale) | References obsolete `force_scan_outcome` parameter rejected by P0-4/P0-5 security fix. | Remove obsolete parameter references. |
| `Makefile` | Active | Development and testing workflow automation. | LEVEL 4 (Hazardous) | `test-stack` executes destructive `docker compose down -v`; `clean` removes all `storage/*.db` and directories without prompt. | Remove `-v` flag from test-stack to prevent unintentional data volume deletion; guard clean command. |
| `infrastructure/dristinet.service` | Active | Systemd service unit. | LEVEL 4 (Defect) | Hardcoded path `/home/ubuntu/project/DRISTINET` instead of actual repo location `/home/ubuntu/DRISTI-NET`. | Correct directory path to `/home/ubuntu/DRISTI-NET`. |
| `docs/responsible-ai.md` vs UI Copy | Active | Neutral terminology and language constraints. | LEVEL 5 vs LEVEL 1 (Violation) | UI copy in `GraphLegend.tsx`, `hitl-decision-pane.tsx`, and `reports-page.tsx` uses banned words ("Court-Ready", "Certified"). | Replace with neutral terms: "Integrity Dossier (BSA s.63(4)(c) Reference)", "Evidence Reference". |
| `scripts/make_packages.py` | Active | Release packaging utility. | LEVEL 1 (Broken) | References non-existent `TASK_BOARD.md`, `PROJECT_STATUS.md`, and root `requirements.txt`. | Update file paths to existing canonical documentation. |

---

## 3. Discontinued / Deprecated Claims

1. **Autonomous Guilt / Threat Scores:** Any mention in historical SIH presentation drafts or external summaries claiming DRISTI-NET computes "criminality" or "threat scores" is strictly classified as **UNSUPPORTED / PROHIBITED** per Constitution §2.2.
2. **Statutory Admissibility Certification:** Any claim that the system certifies court admissibility is **FALSE / UNSUPPORTED**. The system generates technical cryptographic integrity references (SHA-256 manifests, Merkle roots, and audit logs) that assist human investigators, but cannot replace judicial evaluation.
3. **Automatic Person-Level Entity Merges:** Banned by Constitution §2.2. All person-level resolution candidates require human-in-the-loop review.
