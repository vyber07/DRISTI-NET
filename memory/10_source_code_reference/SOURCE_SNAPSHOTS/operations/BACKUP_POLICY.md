# DRISTI-NET — Backup Policy & Data Protection Guide

> **Status (2026-11-01): TARGET POLICY, not implemented.** None of the PostgreSQL/MinIO procedures below (WAL archiving,
> `pg_dump` schedule, bucket versioning, `mc mirror`, weekly automated test restore) exist in this repository or have been
> run. The only verified restore is the SQLite + local-storage drill in `operations/RESTORE_TEST_REPORT.md`
> (`scripts/backup_restore_drill.py`). The signing key (`DRISHTI_SECRET_KEY` / `DRISHTI_AUDIT_KEYS`) must be escrowed
> separately: without it the restored audit trail cannot be verified.

## 1. Scope & Objective

This policy defines the backup schedule, retention rules, encryption standards, and verification procedures for all authoritative data assets managed by DRISTI-NET.

---

## 2. Backup Classification & RPO / RTO Targets

| Tier | Component | Authoritative? | Backup Frequency | RPO Target | RTO Target |
|---|---|---|---|---|---|
| **Tier 1** | PostgreSQL Relational DB | YES (Authoritative) | Continuous WAL archiving + Hourly incremental + Daily full snapshot | < 15 minutes | < 1 hour |
| **Tier 1** | MinIO / S3 Object Store | YES (Authoritative) | Continuous bucket versioning + Daily offsite rsync | < 1 hour | < 2 hours |
| **Tier 2** | Cryptographic Audit Log | YES (Authoritative) | Real-time write + Daily export to cold storage / Besu anchor | 0 minutes | < 30 minutes |
| **Tier 3** | Neo4j Graph DB | NO (Projection) | Daily snapshot (Optional; 100% reconstructible from Tier 1) | Reconstructible | < 4 hours |
| **Tier 4** | Redis Cache | NO (Ephemeral) | No persistent backup required (ephemeral rate limit counters) | N/A | Immediate |

---

## 3. Backup Execution Procedures

### 3.1 PostgreSQL Database Backup
- **Daily Snapshot**:
  ```bash
  pg_dump -U drishti -h localhost -F c -b -v -f "/var/backups/dristi/db_$(date +%Y%m%d_%H%M%S).dump" drishti
  ```
- **Integrity Verification**: Automated test restore into throwaway database every 7 days.

### 3.2 MinIO / S3 Object Storage Backup
- **Bucket Versioning**: Enabled by default on bucket `drishti`. Overwrites create new versions; deletes create soft delete markers.
- **Offsite Synchronization**:
  ```bash
  mc mirror --overwrite /home/ubuntu/DRISTI-NET/storage/accepted s3-backup/dristi-cold-storage/accepted
  ```

### 3.3 Cryptographic Verification of Backups
Every backup artifact must be accompanied by an automatically generated SHA-256 manifest:
```bash
sha256sum db_*.dump > checksums.sha256
```
Integrity must be confirmed prior to archiving into cold immutable media.
