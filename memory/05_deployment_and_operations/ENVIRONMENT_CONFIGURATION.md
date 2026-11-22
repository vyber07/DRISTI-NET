# DRISTI-NET — Master Environment Configuration Reference

**Authority:** `.env.example`, `.env.compose`, `apps/api/app/config.py`  
**Consolidation Date:** 2026-11-19  

---

## 1. Environment Variable Specifications

| Variable Name | Required | Default Value | Description & Constraints |
|---|---|---|---|
| `ENVIRONMENT` | Yes | `production` | Deployment mode (`production`, `development`, `testing`). |
| `DEBUG` | No | `false` | Enable verbose tracebacks (never true in production). |
| `DB_TYPE` | Yes | `postgresql` | Database driver (`postgresql` or `sqlite`). |
| `POSTGRES_HOST` | Cond. | `postgres` | PostgreSQL hostname / Docker container name. |
| `POSTGRES_PORT` | Cond. | `5432` | PostgreSQL port. |
| `POSTGRES_DB` | Cond. | `drishti` | Database name. |
| `POSTGRES_USER` | Cond. | `drishti_user` | Database user. |
| `POSTGRES_PASSWORD` | Cond. | - | Database user password (minimum 16 characters). |
| `DATABASE_URL` | Cond. | - | Full connection URL (constructed automatically if omitted). |
| `STORAGE_TYPE` | Yes | `s3` | Storage backend (`s3` for MinIO/AWS or `local`). |
| `S3_ENDPOINT` | Cond. | `http://minio:9000` | S3 endpoint URL. |
| `S3_ACCESS_KEY` | Cond. | - | MinIO/S3 access key. |
| `S3_SECRET_KEY` | Cond. | - | MinIO/S3 secret key. |
| `S3_BUCKET_QUARANTINE` | Cond. | `drishti-quarantine` | Bucket for unverified evidence files. |
| `S3_BUCKET_ACCEPTED` | Cond. | `drishti-accepted` | Bucket for scanned and verified evidence. |
| `NEO4J_URI` | Yes | `bolt://neo4j:7687` | Neo4j Bolt connection URI. |
| `NEO4J_USER` | Yes | `neo4j` | Neo4j username. |
| `NEO4J_PASSWORD` | Yes | - | Neo4j password. |
| `REDIS_URL` | Yes | `redis://redis:6379/0`| Redis connection URL for rate limiting. |
| `CLAMAV_HOST` | Yes | `clamav` | ClamAV daemon hostname / container name. |
| `CLAMAV_PORT` | Yes | `3310` | ClamAV daemon port. |
| `KAFKA_BOOTSTRAP_SERVERS`| No | `kafka:9092` | Kafka broker endpoints for async workers. |
| `BESU_RPC_URL` | No | `http://besu:8545` | Besu JSON-RPC endpoint for ledger anchoring. |
| `JWT_SECRET_KEY` | Yes | - | Secret key for signing bearer tokens (min 32 chars). |
| `JWT_ALGORITHM` | No | `HS256` | JWT signature algorithm. |
| `JWT_EXPIRE_MINUTES` | No | `60` | Token expiration duration in minutes. |
| `AUDIT_HMAC_KEY` | Yes | - | Secret key for HMAC-SHA256 audit log chaining. |
| `MAX_UPLOAD_MB` | No | `100` | Maximum single evidence upload file size in MB. |
| `GRAPH_MAX_NODES` | No | `500` | Maximum node cap for graph queries. |
| `GRAPH_DEFAULT_HOPS` | No | `2` | Default traversal depth for POLE+ graph queries. |

---

## 2. Production Security Best Practices

1. Never commit `.env` or production credentials into version control.
2. Generate cryptographically strong random keys for `JWT_SECRET_KEY` and `AUDIT_HMAC_KEY`:
   ```bash
   openssl rand -hex 32
   ```
3. Use `.env.example` as a template for new deployments.
