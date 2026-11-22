# DRISTI-NET — Master Operational Troubleshooting Guide

**Authority:** `docs/TROUBLESHOOTING.md`, `audit/BUG_AND_DEFECT_REGISTER.md`, `docs/audit/FAILED_TO_FETCH_TEST_RECORD_2026-11-12.md`  
**Consolidation Date:** 2026-11-19  

---

## 1. Common Operational Diagnostics & Fixes

### 1.1 "Failed to fetch" or Network Errors in Web Frontend
- **Symptom:** Browser console reports `Failed to fetch` on API requests.
- **Root Cause:** Nginx reverse proxy configuration mismatch, API container offline, or CORS origin rejection.
- **Diagnostic Command:**
  ```bash
  curl -I http://localhost:8000/health
  docker logs --tail 50 dristi-net-api-1
  ```
- **Remedy:** Ensure `apps/api/app/main.py` includes the frontend origin in `ALLOWED_ORIGINS` and Nginx proxies `/api/v1` to `http://api:8000`.

### 1.2 "INTEGRITY_MISMATCH" During Evidence Promotion
- **Symptom:** Evidence remains in status `QUARANTINED` or `EXTRACTION_FAILED` with an integrity error.
- **Root Cause:** File bytes in object storage were modified, corrupted, or incompletely uploaded relative to the initial SHA-256 calculation.
- **Remedy:** Inspect `evidence.sha256` in PostgreSQL against the actual SHA-256 of the stored object. Re-upload original evidence if transmission corruption occurred.

### 1.3 Neo4j Query Timeouts & Fallback Degradation
- **Symptom:** API logs indicate `Neo4j transaction timed out; degrading to in-process projection`.
- **Root Cause:** A query attempted to traverse an unindexed or massive supernode without proper hop bounds.
- **Remedy:** Ensure `graph/constraints.cypher` unique constraints are applied. Bounded fallback to NetworkX automatically keeps the application operational.

### 1.4 Audit HMAC Signature Verification Fails
- **Symptom:** `GET /cases/{id}/audit/verify` reports signature verification errors on restored databases.
- **Root Cause:** PostgreSQL session timezone was not set to UTC during audit logging, or secret key `AUDIT_HMAC_KEY` differs from the key used to sign historical events.
- **Remedy:** Verify `AUDIT_HMAC_KEYS` contains historical version keys (`v1`, `v2`). Ensure database configuration enforces UTC sessions (`SET TIME ZONE 'UTC'`).
