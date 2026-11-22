# DRISTI-NET — Master Integration Architecture

**Authority:** `docs/MASTER_INTEGRATION_MATRIX.md`, `DRISTI_NET_INTEGRATION_VERIFICATION.md`, `DRISTI_NET_ARCHITECTURE_GAP_ANALYSIS.md`  
**Consolidation Date:** 2026-11-19  

---

## 1. External & Supporting Infrastructure Integration Matrix

| Subsystem | Target Technology | Protocol / Port | Integration Mode | Production Role | Fallback / Offline Behavior |
|---|---|---|---|---|---|
| **Relational Database** | PostgreSQL 16 | TCP 5432 (Postgres wire) | Direct connection pool (SQLAlchemy) | Authoritative System of Record for all metadata, claims, users, audit logs. | SQLite in-memory or file-backed database (`drishti.db`) for testing and local drills. |
| **Object Storage** | MinIO / AWS S3 | HTTP/S TCP 9000 (S3 API) | Boto3 / S3 REST API | Primary blob store for quarantined and accepted evidence files. | Local filesystem storage (`storage/quarantine/`, `storage/accepted/`) with identical API surface. |
| **Analytical Graph Store**| Neo4j 5 Community | Bolt TCP 7687, HTTP 7474 | Neo4j Python Driver | Analytical graph projection, complex path queries, centrality calculations. | Authoritative in-process Python NetworkX projection emitting `projection_stale: true`. Zero data loss. |
| **Rate-Limiter & Cache** | Redis 7 | TCP 6379 (Redis RESP) | Redis Python Client | Sliding-window IP/user rate limiting and JWT session blocklisting. | Degrades gracefully to in-memory dictionary cache with process lifetime limits. |
| **Malware Scanner** | ClamAV Daemon | TCP 3310 (clamd socket) | ClamAV STREAM protocol | Ingestion gate scanning all evidence files for known malware signatures. | Fail-closed testgate: if ClamAV daemon is unreachable, all files remain quarantined. |
| **Message Broker** | Apache Kafka 3.5 | TCP 9092 (Kafka protocol)| aiokafka / confluent-kafka | Decoupled asynchronous evidence processing and worker task distribution. | Direct synchronous in-process pipeline execution (ADR-004 opt-in preserved). |
| **Integrity Ledger** | Hyperledger Besu 24.1 | HTTP JSON-RPC TCP 8545 | Web3.py RPC client | External timestamping and Merkle root anchoring to EVM smart contract. | Local cryptographic Merkle proof generation with RFC 6962 hash verification without external push. |

---

## 2. Integration Verification Status

From the latest integration verification audits (`DRISTI_NET_INTEGRATION_VERIFICATION.md`):

1. **PostgreSQL & MinIO Disaster Recovery:** Verified via automated backup and restore drill (`operations/DISASTER_RECOVERY_PLAN.md`). All database rows, audit HMAC chains, and object SHA-256 hashes matched with zero discrepancies.
2. **Neo4j Resiliency:** Tested against real network interruption. When Neo4j query timeout triggers or the service disconnects, the API automatically falls back to the PostgreSQL-derived in-process projection, ensuring uninterrupted investigator access.
3. **ClamAV Gate:** Verified using the standard EICAR test string (`data/synthetic/documents/eicar_test.txt`). EICAR payloads were caught 100% of the time, resulting in immediate quarantine and status `INFECTED`.
4. **Besu EVM Client:** Smart contract deployment and receipt verification verified via `apps/api/app/tests/test_new_components.py::TestMerkleTree`.
