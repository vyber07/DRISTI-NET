# DRISTI-NET — Consolidated Audit Findings & Master Defect Register

**Authority:** `DRISTI_NET_BUG_AND_ERROR_REGISTER.md`, `audit/BUG_AND_DEFECT_REGISTER.md`, `frontend-audit/FRONTEND_DEFECT_REGISTER.md`  
**Consolidation Date:** 2026-11-19  

---

## 1. Master Historical Defect Summary

Across all testing and audit sweeps, 91 core system defects (DEF-001 through DEF-091) and 18 extended integration issues (BUG-NEW-01 through BUG-NEW-18) were identified, traced, and systematically resolved:

| Defect ID | Severity | Component | Problem Description | Resolution / Status |
|---|---|---|---|---|
| **DEF-018** | High | ML NER | IndicBERT tokenizer dropped specific Indian honorifics and multi-part names. | Handled via pre-tokenization normalization rules in `nlp_adapter.py`. **Resolved.** |
| **DEF-021** | Critical | Database / Ledger | `LedgerAnchor` table missing from early Alembic migrations, causing crash on Besu anchor. | Added Alembic migration `5bcde1234569`. **Resolved.** |
| **DEF-028** | Critical | Web Security | Path traversal vulnerability in static SPA file server middleware. | Enforced strict canonical path resolving in `main.py` SPA mount. **Resolved.** |
| **DEF-031** | High | Authorization | Candidate assignment endpoint lacked case-level access validation. | Added `verify_case_access` dependency to candidate assignment route. **Resolved.** |
| **DEF-033** | High | Authorization | Entity card cross-case read allowed viewing unassigned entity attributes. | Added case scoping query filter in `routes/graph_routes.py`. **Resolved.** |
| **DEF-043** | High | Graph Resilience | Unhandled Neo4j connection failure crashed the API during network blips. | Added try/except fallback to in-process NetworkX projection with `projection_stale: true`. **Resolved.** |
| **DEF-051** | Medium | Test Suite | Ten core workflow tests were accidentally deleted in commit `61e3437`. | Restored verbatim in `test_workflow_restored.py`. **Resolved.** |
| **DEF-080** | Medium | Benchmarking | Performance report timed duplicate-upload short-cut instead of actual ingestion. | Benchmark rewritten to measure full upload -> scan -> extract lifecycle. **Resolved.** |
| **DEF-085** | High | Cryptography | Merkle root scheme was ambiguous between RFC 6962 and legacy schemes. | Standardized on RFC 6962 with legacy backward-compatibility verifier. **Resolved.** |
| **DEF-088** | Critical | Audit Integrity | Non-UTC server timezone caused HMAC audit signature verification failure. | PostgreSQL sessions pinned to UTC (`SET TIME ZONE 'UTC'`). **Resolved.** |
| **DEF-090** | High | Data Isolation | Person entity IDs were not properly scoped per case during bulk CSV ingestion. | Scoped source person IDs strictly to case ID prefix. **Resolved.** |
| **DEF-091** | High | Audit Integrity | Non-deterministic JSON serialization caused occasional signature mismatch. | Implemented strict unambiguous canonical JSON serializer in `audit.py`. **Resolved.** |
| **BUG-NEW-01** | High | Security | Evidence download loaded entire file into heap memory, risking OOM on large files. | Streamed via `StreamingResponse` + `storage.iter_bytes()`. **Resolved (commit `28a6f5c`).** |
| **BUG-NEW-02** | High | Security | Server-side session was not invalidated upon user logout. | Added `POST /auth/logout` revoking server session and logging audit event. **Resolved (commit `28a6f5c`).** |
| **BUG-NEW-03** | Medium | Navigation | Mobile sidebar drawer failed to trap keyboard focus below 1024px. | Converted drawer to accessible Radix modal dialog with focus trap. **Resolved (commit `489f286`).** |
| **BUG-NEW-04** | Medium | Accessibility | Small text sizes (< 12px) caused axe-core accessibility failures across multiple views. | Set global minimum typography floor to 12px (`text-micro`). **Resolved (commit `b3ead04`).** |
| **BUG-NEW-05** | High | Account Control | Missing self-service password update and session management endpoints. | Added `/auth/me`, password change, active sessions, and activity logs. **Resolved (commit `4f11760`).** |
| **BUG-NEW-06** | Critical | Database Boot | Declarative models were not loaded on cold boot, causing relationship mapping errors. | Explicitly registered all declarative models on application boot. **Resolved (commit `2385d1c`).** |

---

## 2. Outstanding Known Limitations

In accordance with `docs/limitations.md`:
1. **Live Government Database Connectors:** Live CCTNS/ICJS, telecom CDR feeds, and banking switch APIs are intentionally absent; synthetic or authorized static de-identified data is used.
2. **H3 Spatial Overlap Analytics:** Current mapping displays point coordinates; coarse hexagonal overlap analytics remains an architecture roadmap target.
3. **Mid-Flight Graph Query Cancellation:** Long-running Neo4j queries execute until timeout; cooperative query cancellation remains a roadmap target.
