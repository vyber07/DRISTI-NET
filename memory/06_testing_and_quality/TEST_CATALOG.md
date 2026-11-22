# DRISTI-NET — Master Test Catalog & Execution History

**Authority:** `DRISTI_NET_TEST_EXECUTION_REPORT.md`, `audit/TEST_RESULTS.md`, `docs/status.md`  
**Consolidation Date:** 2026-11-19  

---

## 1. Automated Test Suite Execution Summary

- **Total Backend Tests:** 543 passed, 0 failed, 6 skipped (in live Neo4j / Besu configuration); 210 passed in isolated SQLite configuration.
- **Frontend Typecheck:** 0 TypeScript compile errors (`npm run typecheck` exits 0).
- **Frontend Production Bundle:** 2,087 modules transformed cleanly (`npm run build` exits 0).
- **E2E Browser Test Suite:** 44/44 role-based verification checks passed across Chromium headless environments.

---

## 2. Core Functional Test Module Catalog

| Test File | Category | Covered Capabilities | Result |
|---|---|---|---|
| `test_security.py` | Security & Auth | Unauthenticated denial, jurisdiction mismatch denial, cross-case access blocking, rate limiting, and PII masking. | **PASS** |
| `test_archive_uploads.py` | Ingestion Defense | Zip bombs, traversal paths (`../`), symlink members, invalid compression ratios, and max file limits. | **PASS** |
| `test_evidence_streaming.py`| Evidence I/O | Streaming downloads via `storage.iter_bytes`, SHA-256 headers, and memory leak prevention. | **PASS** |
| `test_account_self_service.py`| Profile & Auth | Display name updates, password change rate limiting, session revocation, and security activity logs. | **PASS** |
| `test_workflow.py` | Core Life Cycle | End-to-end evidence ingestion, extraction, candidate review, and report export. | **PASS** |
| `test_candidates_are_explainable.py`| HITL Resolution | Deterministic matching signals, positive/counter evidence explanation, and zero automated merges. | **PASS** |
| `test_graph_analysis.py` | Analytics | Degree centrality, betweenness bridges, community stability bootstrapping, and temporal decay. | **PASS** |
| `test_new_components.py` | Integrations | RFC 6962 Merkle tree construction, inclusion proof generation, Besu EVM client, and dossier PDF generation. | **PASS** |
| `test_extraction_failures.py`| Robustness | Corrupt PDFs, truncated CSVs, unparsable JSONs, and pipeline retry states. | **PASS** |
| `test_audit_chain_and_tamper_detection.py`| Integrity | HMAC-SHA256 signature calculation, hash chain continuity, and single-bit tamper detection. | **PASS** |
