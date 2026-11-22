# DRISTI-NET — Master Deployment Guide

**Authority:** `docs/DEPLOYMENT_ARCHITECTURE.md`, `DRISTI_NET_PRODUCTION_READINESS_REPORT.md`, `memory/DEPLOYMENT_STATE.md`, `docs/adr/011-deployment-model.md`  
**Consolidation Date:** 2026-11-19  

---

## 1. Deployment Topology & Ingress Architecture

In compliance with **ADR-011**, DRISTI-NET is deployed as a single-host, multi-container architecture fronted by an Nginx reverse proxy:
- **Zero-Port Suffix:** External users access the web UI and REST API over standard HTTP/HTTPS ports (80/443).
- **Path Routing:**
  - `/api/v1/*` -> Proxied internally to `dristi-net-api:8000`.
  - `/*` -> Static React/TypeScript SPA served directly by Nginx from `/usr/share/nginx/html`.
- **Internal Network Isolation:** All supporting service ports (PostgreSQL 5432, Redis 6379, Neo4j 7687, MinIO 9000, ClamAV 3310, Kafka 9092, Besu 8545) are bound to the internal Docker bridge network (`dristi-net_internal`) and not exposed directly to the public internet.

---

## 2. Production Startup Sequence

1. **Verify Prerequisites:**
   - Docker 24+ and Docker Compose v2.
   - 16 GB+ RAM, 4+ CPU cores, 50 GB+ SSD storage.
2. **Configure Environment:**
   ```bash
   cp .env.example .env
   # Populate secrets (POSTGRES_PASSWORD, JWT_SECRET_KEY, AUDIT_HMAC_KEY)
   ```
3. **Launch Supporting Infrastructure:**
   ```bash
   docker compose up -d postgres redis minio neo4j clamav kafka besu
   ```
4. **Run Database Migrations & Seed Data:**
   ```bash
   docker compose run --rm api alembic upgrade head
   docker compose run --rm api python3 -m apps.api.app.seed
   ```
5. **Launch Application API, Worker & Web Proxy:**
   ```bash
   docker compose up -d api worker nginx
   ```
6. **Health Check Verification:**
   ```bash
   curl -f http://localhost:8000/health
   curl -f http://localhost/api/v1/health
   ```

---

## 3. Local Development Startup (Without Docker)

For rapid local testing and development on Linux/macOS:
1. **Python Environment:**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r apps/api/requirements.txt
   pip install -r apps/api/requirements-dev.txt
   ```
2. **Start Backend API (Local SQLite Mode):**
   ```bash
   export DB_TYPE=sqlite
   export STORAGE_TYPE=local
   python3 -m uvicorn apps.api.app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
3. **Start Web Frontend:**
   ```bash
   cd apps/web
   npm install
   npm run dev
   ```
