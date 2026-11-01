# DRISTI-NET — Disaster Recovery & Service Restoration Plan

## 1. Disaster Scenarios & Recovery Procedures

### Scenario A: Storage Media Failure (Object Store / Evidence Loss)
1. **Assessment**: Storage partition unreadable or MinIO container corrupt.
2. **Action**:
   - Provision replacement storage volume.
   - Restore objects from offsite mirror (`mc mirror s3-backup/dristi-cold-storage /storage`).
   - Run verification pass: `python3 -m apps.api.app.routes.integrity_routes` or call `GET /evidence/{id}/verify` across all case records.
   - Any hash mismatch halts restoration and alerts the Lead Evidence Auditor.

### Scenario B: Database Corruption (PostgreSQL / SQLite Failure)
1. **Assessment**: Database engine fails to boot or database transactions corrupted.
2. **Action**:
   - Stop API application server (`systemctl stop dristinet-api.service`).
   - Restore latest verified dump:
     ```bash
     pg_restore -U drishti -d drishti -v /var/backups/dristi/latest.dump
     ```
   - Replay WAL logs up to the timestamp of failure.
   - Run database schema migration verification: `make db-upgrade`.
   - Run audit chain validation: `GET /api/v1/audit/verify`.
   - Start API application server (`systemctl start dristinet-api.service`).

### Scenario C: Analytical Graph Inconsistency or Loss (Neo4j Failure)
1. **Assessment**: Neo4j cluster desynchronized, corrupted, or deleted.
2. **Action**:
   - Stop Neo4j service.
   - Clear graph storage (`rm -rf data/databases/neo4j/*`).
   - Restart clean Neo4j instance.
   - Initialize constraints (`python3 tests/infrastructure/test_infrastructure.py`).
   - Trigger Full Projection Replay from PostgreSQL authoritative claims:
     ```bash
     python3 -m apps.api.app.services.neo4j_store --rebuild-all
     ```
   - All nodes, relationships, and attributes are reconstructed 100% deterministically from verified claims.

---

## 2. Recovery Verification Checklist

- [ ] Relational DB restored and queryable.
- [ ] Evidence object hashes match database SHA-256 records.
- [ ] Audit log hash chain validates with zero breaks.
- [ ] Neo4j graph nodes and edge counts match extracted claims.
- [ ] API server responds 200 to `/api/v1/health` and `/api/v1/ready`.
- [ ] Real browser login and case view operational (`make e2e`).
