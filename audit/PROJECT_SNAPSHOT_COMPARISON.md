# DRISTI-NET — Project Snapshot Comparison

**Document ID:** DRISTI-AUDIT-005  
**Date:** 2026-11-01  
**Authority:** Master Directive Phase 0, Task 0.3  

---

## 1. Overview of Snapshots

| Snapshot Name | Source / Location | Hash / Commit | Primary Characteristics | Differences from Active Tree |
|---|---|---|---|---|
| **Export 11** | Release Archive (`reports/release-checklist.md`) | `c1df095` / `01b22d2` | 58 unit tests passing, early Compose stack with Nginx port 80. | Did not include IndicBERT NER, PaddleOCR bbox adapter, Kafka bus, Besu ledger anchors, or 83 backend tests. |
| **Commit `0310914`** | Git History (2026-09-18) | `0310914297967d50...` | Complete Phase 0–22 `TASK_BOARD.md` and initial Redis / S3 / Neo4j verification. | Contained monolithic `TASK_BOARD.md` (899 lines) which was later deleted in `f1633da`. |
| **Commit `f1633da`** | Git History (2026-09-20) | `f1633da3dd4ad8af...` | Attempted mock removal and E2E test fix. Deleted `TASK_BOARD.md`. | Introduced truncated syntax error in `integrityApi.ts` and escaped interpolation in `case-evidence-view.tsx`. |
| **Commit `558f28c` / `3ba68d6`** | Git History (2026-09-23 to 09-25) | `3ba68d6e2f33df52...` | Integrated Kafka event bus, Hyperledger Besu, IndicBERT NER, dynamic AI evaluation. | Omitted Redis container from `docker-compose.yml`; left broken test references. |
| **Commit `4dc088e` (HEAD)** | Current `main` Branch | `4dc088e5d0a64dfb...` | Docs update, release checklist hashes updated. | Contains uncommitted work in working tree (20 modified files). |
| **Active Working Tree** | Local disk `/home/ubuntu/DRISTI-NET` | Uncommitted diff | Modernized UI with HITL workspace, court PDF endpoints, updated OCR adapter. | Syntax error TS1005 in `integrityApi.ts` blocks `make build-web`. Needs systematic remediation. |

---

## 2. Integrity and Reconciliation Policy

1. **Never Overwrite Without Backup:** Active working tree changes are preserved and repaired rather than wiped.
2. **Re-verify Every Prior Fix:** All 9 historical defect areas from previous audits are independently tested and recorded in `audit/BUG_AND_DEFECT_REGISTER.md`.
3. **Pristine Release Baseline:** All fixes will be validated by `make test`, `make build-web`, and Playwright `make e2e` before any release artifact is created.
