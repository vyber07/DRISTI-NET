# DRISTI-NET — Repository Inventory

**Document ID:** DRISTI-AUDIT-004  
**Date:** 2026-11-01  
**Authority:** Master Directive Phase 0, Task 0.2  

---

## 1. Top-Level Directory Structure

| Path | Purpose / Domain | Component Type | Status | Notes |
|---|---|---|---|---|
| `apps/api/` | FastAPI backend application, routers, services, models, migrations | Python 3.11 Backend | Active | Contains 83+ passing unit/integration tests |
| `apps/web/` | React 18 + TypeScript 5.9 + Vite 8 SPA | Frontend UI | Needs Fix | Contains Sigma.js/Graphology, Radix UI, Tailwind CSS |
| `workers/` | Asynchronous worker process (`workers/worker.py`) | Event Worker | Active | Consumes from Kafka / runs background processing |
| `data/synthetic/` | Synthetic data generator (`generate.py`), golden dataset, truth labels | Fixtures & Data | Active | Purely synthetic, zero real personal data |
| `infrastructure/` | Docker Compose, Nginx reverse proxy configuration, systemd units | DevOps / Deployment | Active | Nginx handles ports 80/443; systemd autostart |
| `docs/` | Architecture documents, ADRs (001–014), contracts, context constitution | Architecture & Specs | Canonical | Authoritative specifications |
| `audit/` | Audit logs, claim registers, forensic baselines, verification artifacts | Quality & Governance | Active | Traceability & verification records |
| `reports/` | AI evaluation, release checklists, performance benchmarks, dry-run reports | Release Verification | Active | Metric benchmarks and execution proofs |
| `scripts/` | Tooling: evaluate, dry_run, perf_test, make_packages, validate_besu | Utilities & Automation| Active | Developer & CI scripts |
| `tests/` | Infrastructure, evaluation, security, and Playwright E2E tests | Test Suites | Active | Integration & system tests |
| `storage/` | Local filesystem fallback for quarantine, accepted, derived objects, SQLite | Local Storage | Ignored in Git | Transient development data directory |
| `graph/` | Cypher definitions, constraints, ontology mapping documentation | Graph Projection | Active | Neo4j POLE+ specifications |
| `policy/` | Access control rules, authorization models, masking policies | Security Policy | Active | RBAC / ABAC specifications |

---

## 2. Service Inventory

| Service | Technology | Primary Role | Authoritative / Reconstructible |
|---|---|---|---|
| **API** | FastAPI / Uvicorn | REST API gateway, case isolation, JWT auth, bounded graph API | Stateless Application |
| **Relational DB** | PostgreSQL 16 (fallback SQLite) | Authoritative cases, users, assignments, evidence metadata, reviews, audit | **Authoritative State** |
| **Object Storage**| MinIO / S3 (fallback local FS) | Quarantine vault, accepted evidence, derived text/artifacts | **Authoritative Evidence Bytes** |
| **Graph Store** | Neo4j 5 Community | Reconstructible analytical graph projection (POLE+) | Reconstructible Projection |
| **Cache / Rate Limit** | Redis 7 | Per-username login throttling, rate-limit counters | Ephemeral Cache |
| **Message Broker** | Apache Kafka (Bitnami 3.5) | Replayable event delivery, decoupled worker processing | Asynchronous Messaging |
| **Ledger Anchor** | Hyperledger Besu 24.1 | Optional cryptographic Merkle root anchoring | Cryptographic Reference |
| **Reverse Proxy** | Nginx 1.27 Alpine | TLS termination, CSP, security headers, rate limiting, static assets | Edge Security |
| **Malware Scanner**| ClamAV 1.4.3 | Fail-closed evidence quarantine scanning | Security Inspection Gate |
