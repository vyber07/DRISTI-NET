# DRISTI-NET — Master Backup and Disaster Recovery Plan

**Authority:** `operations/BACKUP_POLICY.md`, `operations/DISASTER_RECOVERY_PLAN.md`, `operations/RESTORE_TEST_REPORT.md`  
**Consolidation Date:** 2026-11-19  

---

## 1. Backup Policy & Retention Metrics

- **Recovery Point Objective (RPO):** Maximum 1 hour of evidentiary transactions.
- **Recovery Time Objective (RTO):** Full service restoration within 15 minutes.
- **Backup Targets:**
  1. **PostgreSQL Relational DB:** Authoritative dump (`pg_dump -Fc`) containing all cases, evidence records, claims, reviews, and audit events.
  2. **MinIO Object Store:** Synchronized archive of `drishti-accepted/` and `drishti-quarantine/` buckets using MinIO Client (`mc mirror`).
  3. **Configuration & Encryption Keys:** Encrypted backup of `.env` configuration (stored off-host in a secure vault).
  - *Note:* Neo4j graph projections and Redis caches are disposable and excluded from backups; they are regenerated automatically from PostgreSQL upon recovery.

---

## 2. Tested Disaster Recovery Drill History

From `operations/DISASTER_RECOVERY_PLAN.md` (Drill completed 2026-11-11):
- **Simulation:** Full catastrophic failure of the host machine. Disposable PostgreSQL and MinIO instances spun up from clean scratch states.
- **Relational Restoration:** Database restored via `pg_restore`. 100% of rows restored across all tables.
- **HMAC Audit Signature Verification:** Every single audit event (99/99 events) verified with **zero HMAC signature failures** post-restore, proving that UTC session pinning prevented timestamp corruption.
- **Evidence Byte Integrity:** Restored evidence files matched their recorded SHA-256 hashes with **100% byte-for-byte fidelity**.

---

## 3. Emergency Restoration Procedure

```bash
# 1. Restore PostgreSQL Database
docker exec -i dristi-net-postgres-1 pg_restore -U drishti_user -d drishti --clean /backups/postgres_latest.dump

# 2. Restore MinIO Object Storage
mc mirror /backups/minio/ local/drishti-accepted/
mc mirror /backups/minio-quarantine/ local/drishti-quarantine/

# 3. Rebuild Neo4j Graph Projections (Deterministic Replay)
docker exec -i dristi-net-api-1 python3 -m apps.api.app.services.rebuild_graph

# 4. Verify System Integrity
docker exec -i dristi-net-api-1 python3 -m pytest apps/api/app/tests/test_audit_chain_and_tamper_detection.py
```
