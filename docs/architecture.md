# Architecture

> Each backend below has a zero-install default *and* a real, live-verified production-shaped
> alternative — not just a documented "target." See `docs/adr/` for the decision behind each one and
> `TASK_BOARD.md` for what was actually run and checked. `DRISHTI_*` environment variables select which
> side of each pair is active; nothing here is aspirational.

## Current (this repo)

```
Browser (React/TS) ──/api/v1──▶ FastAPI ──▶ SQLAlchemy ORM ──▶ SQLite (default) | PostgreSQL (DRISHTI_DATABASE_URL)
                                   │
                                   ├── services/storage.py    local filesystem (default) | MinIO/S3 (DRISHTI_S3_ENDPOINT_URL)
                                   ├── services/scanner.py    ClamAV TCP INSTREAM | testgate (EICAR-aware test substitute)
                                   ├── services/extract.py    CSV/JSON/PDF(pypdf)/TXT → Entity/Claim/Provenance
                                   ├── services/resolution.py blocking + explainable signals → MatchCandidate (never merges)
                                   ├── services/pipeline.py   SCAN → EXTRACT → RESOLVE as Job rows (idempotent keys, attempts, trace ids)
                                   ├── services/graph.py      NetworkX (default) | Neo4j (DRISHTI_NEO4J_URI) — bounded BFS/Cypher, relevance/decay, analytics
                                   ├── services/ratelimit.py  login-throttle counters via Redis (DRISHTI_REDIS_URL; empty = disabled, fails open)
                                   ├── services/masking.py    default-on masking of PHONE / ACCOUNT
                                   └── services/report.py     JSON + HTML report
```

Authoritative state = the relational tables in `models.py` (SQLite or PostgreSQL). The graph is a
projection, rebuildable from those tables whether it lives in-process or in Neo4j
(`test_projection_is_rebuildable`; `neo4j_store.write_projection`). Audit rows are append-only by
convention (no update/delete endpoints exist).

## Zero-install default vs. real backend, and why each pair exists

| Component | Zero-install default | Real backend | ADR |
|-----------|----------------------|--------------|-----|
| Relational store | SQLite | PostgreSQL | [ADR-001](adr/001-relational-database.md) |
| Graph projection | NetworkX (in-process) | Neo4j | [ADR-002](adr/002-graph-store.md) |
| Evidence bytes | local filesystem | MinIO/S3 | [ADR-003](adr/003-object-storage.md) |
| Async pipeline | in-process fallback | Kafka Event Bus & Worker | [ADR-013](adr/013-kafka-event-bus.md) |
| Login-throttle cache | disabled (empty `DRISHTI_REDIS_URL`) | Redis | [ADR-005](adr/005-redis-scope.md) |
| Malware scan | `testgate` (EICAR-aware substitute) | ClamAV | `docs/security.md` |
| Deployment | single process, `scripts/env.sh` user-space fallback | Docker Compose | [ADR-011](adr/011-deployment-model.md) |

Not yet built, and deliberately not started without a justified need (directive §64,
`TASK_BOARD.md`'s "Explicitly NOT started" list): Kubernetes, MFA/WebAuthn,
OpenTelemetry/Prometheus/Grafana, break-glass access, six-tier evidence
governance UI, OPA policy engine (role/assignment checks stay in `auth.py`).

## Bounds enforced on the server

- `hops ≤ DRISHTI_GRAPH_MAX_HOPS` (2), `max_nodes ≤ DRISHTI_GRAPH_MAX_NODES` (150)
- supernode fan-out capped at `DRISHTI_SUPERNODE_DEGREE` (12) unique neighbours per expansion
- upload ≤ `DRISHTI_MAX_UPLOAD_MB` (25), CSV ≤ 50 000 rows, allow-listed extensions only

## Core Information Flow

```text
START
  ↓
1. Upload Police Documents
  ↓
2. Create SHA-256 Integrity Fingerprint
   (Detects changes to stored evidence bytes)
  ↓
3. Extract & Structure Facts
  ↓
4. Build / Update Knowledge Graph
  ↓
5. Conflicting Entity Candidates?
       │
       ├── NO ──────────────────────┐
       │                            ↓
       │                    7. Access Control
       │                    (Checked on every protected operation)
       │                            ↓
       │                    8. Secure Dashboard
       │                            ↓
       │                    9. View Insights
       │
       └── YES
             ↓
       6. Human Investigator Review
             ↓
        Same Entity?
          │       │
         YES      NO
          ↓       ↓
        MERGE   SEPARATE
          \       /
           \     /
          REVISE GRAPH
               ↓
          BACK TO STEP 4
               ↓
             REPEAT
```
