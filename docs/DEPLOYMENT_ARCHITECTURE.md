# DRISTI-NET — Deployment Architecture & Operations Guide

**Current live deployment (2026-11-04):** the live host runs the Docker Compose stack described in
section 3, not the bare-metal systemd path in section 2 — migrated from the latter on 2026-11-04;
see `frontend-audit/FRONTEND_CONTINUATION_STATE.md`'s "Production migration" section for the
verified details and the rollback. Section 2 is kept as documentation of that prior path and its
rollback target (the systemd unit is still installed, just stopped).

## 1. Deployment Topology

DRISTI-NET supports both a lightweight zero-install development deployment (SQLite + Local Storage + in-process graph) and an enterprise production deployment (PostgreSQL + MinIO + Neo4j + Redis + ClamAV + Nginx).

```mermaid
flowchart TB
    subgraph Host Network / DMZ
        Internet([Client Web Browser]) -->|Port 80 / 443| Nginx[Nginx Reverse Proxy]
    end

    subgraph Application Tier
        Nginx -->|Reverse Proxy /api| API[FastAPI Application Server :8000]
        Nginx -->|Static Assets| SPA[/apps/web/dist]
        API -->|Task Dispatch| CeleryWorker[Asynchronous Pipeline Worker]
    end

    subgraph Core Infrastructure Services
        API -->|TCP 3310| ClamAV[ClamAV Anti-Malware Daemon]
        API -->|TCP 6379| Redis[Redis 7 Rate Limiter]
        API -->|TCP 5432| Postgres[(PostgreSQL 15 Database)]
        API -->|S3 API :9000| MinIO[(MinIO S3 Object Storage)]
        API -->|Bolt :7687| Neo4j[(Neo4j 5 Graph Projection)]
    end
```

---

## 2. Production Service Definition (`systemd`)

The application server runs as a systemd service (`infrastructure/dristinet-api.service`):

```ini
[Unit]
Description=DRISTI-NET FastAPI Application Server
Documentation=file:///home/ubuntu/DRISTI-NET/README.md
After=network-online.target clamav-daemon.service
Wants=network-online.target clamav-daemon.service

[Service]
Type=simple
User=ubuntu
Group=ubuntu
WorkingDirectory=/home/ubuntu/DRISTI-NET
EnvironmentFile=/home/ubuntu/DRISTI-NET/.env
ExecStart=/home/ubuntu/DRISTI-NET/.venv311/bin/python -m uvicorn apps.api.app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5s
StandardOutput=journal
StandardError=journal
SyslogIdentifier=dristinet-api
TimeoutStartSec=60
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
```

---

## 3. Containerized Orchestration (`docker-compose.yml`)

The enterprise stack includes:
- `api`: FastAPI container running uvicorn on port 8000.
- `web`: Nginx container serving built Vite assets and proxying `/api`.
- `postgres`: PostgreSQL 15-alpine with persistent volume `postgres-data`.
- `minio`: MinIO S3 object store with volume `minio-data`.
- `neo4j`: Neo4j 5 community edition with volume `neo4j-data`.
- `redis`: Redis 7-alpine for throttle cache with volume `redis-data`.
- `clamav`: ClamAV daemon container with auto-updating virus definitions.
- `migrations`: One-shot Alembic migration runner executing `alembic upgrade head`.

---

## 4. Release Validation & Health Gates

Before traffic cutover, deployment automation executes:
1. `GET /api/v1/health`: Verifies database connectivity, storage root writeability, and scanner mode.
2. `GET /api/v1/ready`: Verifies database pool and analytical graph engine readiness.
3. `make test-stack-infra`: Runs live socket and constraint verification against all container backends.
