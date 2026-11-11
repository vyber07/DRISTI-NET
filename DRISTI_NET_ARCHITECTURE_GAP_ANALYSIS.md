# DRISTI-NET Architecture Gap Analysis

## Current shape

React/Vite SPA calls FastAPI routes; SQLAlchemy stores case/evidence/workflow state; local/S3 storage holds evidence; scanning/extraction feeds candidate claims and review; graph analytics use an in-process projection with optional Neo4j; optional Kafka worker and Besu adapter exist in source. See `DRISTI_NET_REPOSITORY_MAP.md`.

## Gaps and concrete actions

| Gap | Evidence | Priority | Recommended next action |
|---|---|---|---|
| Frontend type contract currently fails | `npm run typecheck` errors in `apps/web/src/services/api/casesApi.ts` | P1 | Make backend raw response types explicit and validate mapper input; restore clean typecheck gate. |
| APIs are mixed between shared client and direct fetch paths | Frontend audit identifies direct PDF/evidence calls; inspect `features/cases/evidence/` and `features/reports/` | P2 | Consolidate auth/error/timeout handling in API clients; define typed responses for all endpoints. |
| Backend pipeline supports inline processing alongside optional async bus | `routes/evidence_routes.py`, `services/pipeline.py`, `services/kafka_bus.py` | P2 | Choose documented execution mode per deployment; surface job state and retry semantics consistently. |
| Integration intent is inconsistent | `docs/limitations.md` describes Kafka as not adopted; `docs/status.md` describes opt-in bus; worker and requirements exist | P2 | Reconcile architecture decision, deployment config, status docs, tests and release gates. |
| Storage adapters and DB modes need production parity evidence | `services/storage.py`, `db.py`, Alembic migrations; Compose unresolved here | P1 | Test migrations, object lifecycle and restore against disposable PostgreSQL + S3-compatible stack. |
| Audit integrity verification is not part of read workflow | `services/audit.py`, `routes/audit_routes.py` | P1 | Add verification API/report and operational alert on signature mismatch. |
| Optional service sprawl increases operations burden | Redis, Neo4j, Kafka, Besu, OCR/NLP adapters | P2 | Classify required vs optional per profile; provide health/degradation matrix and startup checks. |
| Frontend bundle is large | Vite output: main JS 844.50 kB; dynamic import warning | P3 | Split route-level chunks and measure real-device load before broad deployment. |
| No CI configuration found in `.github/` | Repository inventory | P2 | Confirm other CI provider; otherwise add gated pipeline for tests, typecheck, build, migration checks and security scans. |
| Documentation evidence is stale/inconsistent | `docs/status.md`, `docs/limitations.md`, audit reports have multiple dates and conflicting claims | P2 | Assign one evidence ledger owner and stamp every test with commit/date/backend/service conditions. |
| Compose makes optional services mandatory | `docker-compose.yml` gates API/worker on Neo4j, Redis, MinIO, ClamAV, Kafka and Besu health | P1 | Separate required and optional profiles; let core API degrade as documented and distinguish required dependency health. |
| Destructive migration tools lack target guardrails | `scripts/migrate_evidence_to_minio.py` clears whole bucket; `scripts/migrate_sqlite_to_postgres.py` deletes all target rows | P0 | Require target identity confirmation, backup manifest, dry-run diff, scoped object handling and disposable-target safeguards before use. Neither tool was run. |
| Disaster recovery runbook is not executable/safe | `operations/DISASTER_RECOVERY_PLAN.md` includes missing commands and destructive graph deletion | P1 | Replace with current commands, reviewed restore sequence, isolated restore test and key escrow steps. |
| Container/proxy hardening is unverified | `Dockerfile` defaults to root; bundled Nginx is HTTP-only; Node 22 vs repo Node 24 | P1 | Build compatible pinned image, run non-root, define TLS termination and verify clean stack startup. |
| Besu wiring does not enable anchors by default | Compose sets endpoint but omits signing key; route requires both | P2 | Document local-only behavior or secure key/HSM path; test disposable on-chain transaction before claim. |
| File upload buffering is not aligned with declared size cap | `routes/evidence_routes.py` reads the entire upload before validating configured size | P1 | Apply proxy/ASGI request caps and bounded streaming into quarantine. |
| Field-level disclosure policy is unclear for candidate person attributes | Reports/candidate APIs include PERSON names and DOB/address conflict details; resolver only generates PERSON candidates, so phone/account masking bypass is not established | P2 | Decide field classification for approved/de-identified records and test JSON/HTML/API outputs. |
| Access audit coverage is inconsistent | Some graph/evidence successful reads do not appear to audit; others do | P1 | Centralize access-event policy/dependency or add explicit events and route tests. |
| DB-specific negative pagination behavior | Several limits only have upper caps | P2 | Validate positive bounds at request schema level and run cross-database tests. |

Recommended design direction is incremental: preserve the current modular API/domain boundaries, enforce typed API contracts, make the synchronous vs worker path explicit, treat Neo4j as rebuildable projection, and establish reliable backup/audit verification before adding infrastructure.

## 2026-11-10 verification addendum

The `casesApi.ts` typecheck gap above was reproduced and fixed locally by typing its backend response as the existing FastAPI `CaseOut` contract and applying explicit response generics. `npm run typecheck` now passes; the API client still has no runtime response validator. Other gaps in this document remain unverified or open. Separately, current static inspection confirmed the broad target deletion behavior in both migration scripts; see `docs/audit/VERIFIED_STATIC_FINDINGS_2026-11-10.md`.
