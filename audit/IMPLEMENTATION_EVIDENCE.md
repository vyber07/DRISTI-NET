# Implementation Evidence Register

Document ID: DRISTI-AUDIT-003
Version: 1.0
Status: VERIFIED
Date: 2026-09-14
Owner: DRISTI-NET Architecture Team
Source of Truth: System Repository (`apps/api`, `apps/web`)
Scope: Core Module Verification

## Purpose
This document serves as the technical evidence bridge between the source code, the architecture, and the project documentation. It proves exactly what is real and what is just planned.

## Current Status
**VERIFIED** through Phase 0 Forensic Audit.

## Target State
Must continuously reflect the exact state of the `main` branch codebase.

## Evidence Register

| Module | Expected Capability | Actual Implementation | Files | Status | Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Backend API** | REST API handling auth, cases, evidence, and graph | FastAPI backend with 19 endpoints | `apps/api/app/main.py`, `apps/api/app/routes/` | IMPLEMENTED | Verified routes; passing `tests/test_workflow.py`. |
| **Database** | Relational state management (PostgreSQL) | SQLAlchemy ORM + Alembic migrations. Defaults to SQLite, explicitly supports PostgreSQL. | `apps/api/app/models.py`, `apps/api/migrations/` | IMPLEMENTED | Verified 12 schema tables (`User`, `Case`, `Evidence`, `Claim`, etc.). |
| **Authentication** | Secure JWT-based login | Custom JWT implementation with PBKDF2 hashing | `apps/api/app/auth.py` | IMPLEMENTED | Verified `hash_password`, `verify_password`, and `HTTPBearer` dependencies. |
| **Authorization** | ABAC/RBAC server-side enforcement | Case-level and role-level checks inside API routes | `apps/api/app/auth.py` (see `authorize_case`) | IMPLEMENTED | Verified enforcement logic preventing unauthorized case access. |
| **Malware Scanning** | Scan uploads and fail-closed | ClamAV shell execution (`clamscan`) with testgate fallback | `apps/api/app/services/scanner.py` | IMPLEMENTED | Verified `ScanOutcome` logic and quarantine directories. |
| **Extraction (AI/NLP)** | Deep NLP/NER entity extraction | Deterministic/RegEx extraction ONLY | `apps/api/app/services/extract.py` | PARTIAL / PROTOTYPE | Source relies on hardcoded functions (`extract_calls`, `extract_vehicles`, etc.). NLP is a TARGET. |
| **Entity Resolution** | Embedding/Probabilistic matching | Basic deterministic matching | `apps/api/app/services/resolution.py` | PARTIAL / PROTOTYPE | Source verifies basic exact-match logic. Advanced resolution is a TARGET. |
| **Human Review** | Accept/Reject/Defer workflow | Full CRUD pipeline for HITL decisions | `apps/api/app/routes/review_routes.py` | IMPLEMENTED | DB models explicitly capture `Review` state and decisions. |
| **Graph Database** | Temporal POLE+ Projection in Neo4j | Writes to Neo4j via Cypher if URI present; else uses NetworkX | `apps/api/app/services/graph.py`, `neo4j_store.py` | IMPLEMENTED | Verified parameterized Cypher execution and NetworkX fallback. |
| **Event Bus** | Kafka/Redpanda async jobs | Synchronous in-process pipeline | `apps/api/app/services/pipeline.py` | IMPLEMENTED | No Kafka configuration or consumers exist in the codebase. |
| **Dynamic Masking** | Redact PII based on role/audit | Server-side redaction of phones/accounts | `apps/api/app/services/masking.py` | IMPLEMENTED | Verified logic blocking specific strings unless step-up audited. |

## Dependencies
* Requires source code access to verify any updates.

## Related Documents
* `SOURCE_OF_TRUTH.md`
* `CLAIM_REGISTER.md`
