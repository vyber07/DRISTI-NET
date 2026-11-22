# Infrastructure Baseline

## Network Topology

Only the API is published to the host network. All stateful services communicate strictly over the internal Docker network.

| Service       | Internal | Host published |
| ------------- | -------: | -------------: |
| API           |     8000 |           8000 |
| PostgreSQL    |     5432 |              ❌ |
| Neo4j Bolt    |     7687 |              ❌ |
| Neo4j HTTP    |     7474 |              ❌ |
| Redis         |     6379 |              ❌ |
| MinIO         |     9000 |              ❌ |
| MinIO Console |     9001 |              ❌ |
| ClamAV        |     3310 |              ❌ |


## Service Inventory

### PostgreSQL
* **Image:** `postgres:16`
* **Port:** `5432` (Internal only)
* **Dependency:** None
* **Health check:** `pg_isready -U drishti -d drishti`
* **Persistent volume:** `drishti-pgdata` mounted at `/var/lib/postgresql/data`
* **Environment variables:** `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
* **Startup order:** 1
* **Readiness condition:** `service_healthy` (pg_isready)
* **Security requirements:** Passwords must not be default in production.
* **Current verification status:** Defined in compose, verified via integration test.

### Neo4j
* **Image:** `neo4j:5-community`
* **Port:** `7474` (HTTP), `7687` (Bolt) (Internal only)
* **Dependency:** None
* **Health check:** HTTP check on `7474`
* **Persistent volume:** `drishti-neo4jdata` mounted at `/data`
* **Environment variables:** `NEO4J_AUTH`
* **Startup order:** 1
* **Readiness condition:** `service_healthy`
* **Security requirements:** Default password must be changed.
* **Current verification status:** Defined in compose, verified via integration test.

### Redis
* **Image:** `redis:7-alpine`
* **Port:** `6379` (Internal only)
* **Dependency:** None
* **Health check:** `redis-cli ping`
* **Persistent volume:** None (Ephemeral cache)
* **Environment variables:** None
* **Startup order:** 1
* **Readiness condition:** `service_healthy`
* **Security requirements:** Exposed internally.
* **Current verification status:** Defined in compose, verified via integration test.

### MinIO
* **Image:** `quay.io/minio/minio`
* **Port:** `9000` (API), `9001` (Console) (Internal only)
* **Dependency:** None
* **Health check:** `mc ready local`
* **Persistent volume:** `drishti-miniodata` mounted at `/data`
* **Environment variables:** `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`
* **Startup order:** 1
* **Readiness condition:** `service_healthy`
* **Security requirements:** Default credentials must be changed.
* **Current verification status:** Defined in compose, verified via integration test.

### ClamAV
* **Image/version:** `clamav/clamav:1.4`
* **Port:** `3310` (Internal only)
* **Dependency:** None
* **Health check:** `echo PING | nc localhost 3310 || exit 1`
* **Persistent volume:** None (receives bytes via TCP INSTREAM from API)
* **Current verification status:** Defined in compose, verified via integration test.

### API (Backend)
* **Image:** Built from local `Dockerfile` (`python:3.11-slim` + `node:22-slim` for frontend).
* **Port:** `8000` (Published to host)
* **Dependency:** `postgres`, `neo4j`, `redis`, `minio`
* **Health check:** Relies on `/api/v1/ready` endpoint.
* **Persistent volume:** `drishti-data` (for local storage fallback)
* **Environment variables:** `DRISHTI_*` configuration overrides.
* **Startup order:** Last (depends on all stateful services being healthy).
* **Readiness condition:** Internal DB schema verification and Neo4j connectivity check on startup.
* **Security requirements:** `DRISHTI_SECRET_KEY` and other production secrets must be securely provided.
* **Current verification status:** Defined in compose. Runs `seed.py` and Alembic migrations on startup.

### Frontend
* **Implementation:** Built into static assets via Node and served by the API process. Not a separate container.
* **Current verification status:** Bound to API lifecycle.

### Worker
* **Implementation:** Currently runs in-process inside the API (`pipeline.py`).
* **Current verification status:** Bound to API lifecycle.

## Configuration Model
* `.env.example` provides defaults, largely aimed at SQLite/local development.
* Secrets and endpoints are configured via `DRISHTI_*` environment variables.
* Production validation rejects `testgate` and default credentials (`config.py`).
