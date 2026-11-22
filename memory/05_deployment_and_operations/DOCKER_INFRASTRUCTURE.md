# DRISTI-NET — Master Docker Infrastructure Specification

**Authority:** `docker-compose.yml`, `docker-compose.override.yml`, `Dockerfile`, `infrastructure/nginx/nginx.conf`  
**Consolidation Date:** 2026-11-19  

---

## 1. Container Topology & Service Definitions

The production environment is orchestrated via Docker Compose:

| Service Name | Base Image | Internal Port | Health Check | Role & Dependencies |
|---|---|---|---|---|
| `nginx` | `nginx:alpine` | 80, 443 | `curl -f http://localhost/health` | Edge reverse proxy, SSL termination, static SPA web server. Depends on `api`. |
| `api` | `dristi-net-api` (local build) | 8000 | `curl -f http://localhost:8000/health` | FastAPI REST gateway. Depends on `postgres`, `redis`, `minio`, `neo4j`. |
| `worker` | `dristi-net-worker` (local build)| 8000 | Custom health check | Background evidence extraction worker. Depends on `kafka`, `postgres`, `minio`. |
| `postgres` | `postgres:16-alpine` | 5432 | `pg_isready -U drishti_user` | Primary authoritative relational database. Volume: `postgres_data`. |
| `redis` | `redis:7-alpine` | 6379 | `redis-cli ping` | Ephemeral sliding-window rate-limiting cache. |
| `minio` | `minio/minio:RELEASE...` | 9000, 9001 | `curl -f http://localhost:9000/minio/health/live` | S3-compatible dual-tier evidence storage. Volume: `minio_data`. |
| `neo4j` | `neo4j:5-community` | 7474, 7687 | `cypher-shell "RETURN 1"` | Bounded POLE+ analytical graph projection store. Volume: `neo4j_data`. |
| `clamav` | `clamav/clamav:latest` | 3310 | Custom socket check | Antivirus daemon scanning all evidence prior to promotion. |
| `kafka` | `bitnami/kafka:3.5` | 9092 | Custom Kafka check | Asynchronous event transport for evidence jobs. Volume: `kafka_data`. |
| `besu` | `hyperledger/besu:24.1` | 8545 | `curl -f http://localhost:8545/liveness` | Private EVM testnet node for RFC 6962 Merkle root anchoring. |

---

## 2. Multi-Stage Dockerfile (`Dockerfile`)

The core application image uses a multi-stage Dockerfile:
1. **Builder Stage:** Uses `python:3.11-slim`, installs build tools (`gcc`, `g++`, `libmagic-dev`), builds Python wheels.
2. **Runtime Stage:** Copies wheels, installs runtime dependencies, creates a non-root system user (`dristi`), drops privileges, and exposes port 8000.
