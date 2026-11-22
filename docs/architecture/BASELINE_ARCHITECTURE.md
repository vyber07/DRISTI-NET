# DRISTI-NET — Baseline Architecture Report

**Established:** 2026-11-06 (Modernization Session)  
**Branch:** worktree-refactor-modernization (from main @ 15e3ffa)  
**Baseline tests:** 199 passed / 7 skipped  
**Status:** ENGINEERING PREVIEW

---

## 1. System Overview

DRISTI-NET is an evidence-linked relationship-discovery platform for authorized retrospective investigations.
It follows an evidence-first ingestion pipeline: upload → quarantine → hash → scan → extract → candidate
review → graph projection → analysis.

**Core technology stack:**

| Layer | Technology | Version |
|---|---|---|
| Backend API | FastAPI | 0.1.0 (prototype) |
| Backend language | Python | 3.11 |
| Relational DB | SQLite (dev) / PostgreSQL (prod) | SQLAlchemy 2.x + Alembic |
| Object storage | Local FS (dev) / MinIO/S3 (prod) | boto3 |
| Graph store | In-process NetworkX (dev) / Neo4j (prod) | neo4j-driver |
| Cache / rate-limit | Redis (optional, disabled when empty URL) | redis-py |
| Malware scanner | ClamAV / testgate fallback | clamd or clamscan |
| Event bus | Kafka (optional, in-process fallback) | confluent-kafka |
| Frontend framework | React 18 + TypeScript | Vite build |
| Graph visualization | Sigma.js + Graphology | 2.x |
| State management | Zustand | — |
| UI components | Radix UI + Tailwind CSS | — |
| NLP/NER | IndicBERTv2 (optional) + rule-based fallback | transformers (opt-in) |
| OCR | PaddleOCR (optional) + pypdf fallback | paddlepaddle (opt-in) |
| Reverse proxy | Nginx | 1.x |

---

## 2. Current Folder Structure

```
DRISTI-NET/
├── apps/
│   ├── api/
│   │   ├── app/
│   │   │   ├── __init__.py
│   │   │   ├── main.py           # FastAPI app, middleware, SPA fallback
│   │   │   ├── config.py         # All runtime settings (env vars)
│   │   │   ├── auth.py           # JWT auth + RBAC/case authorization
│   │   │   ├── db.py             # SQLAlchemy engine + session factory
│   │   │   ├── models.py         # SQLAlchemy ORM models (250 lines)
│   │   │   ├── schemas.py        # Pydantic input schemas (68 lines)
│   │   │   ├── migrations.py     # Alembic migration runner
│   │   │   ├── seed.py           # Demo data seeder
│   │   │   ├── routes/
│   │   │   │   ├── audit_routes.py
│   │   │   │   ├── auth_routes.py
│   │   │   │   ├── case_routes.py
│   │   │   │   ├── demo_routes.py
│   │   │   │   ├── evidence_routes.py   # 302 lines — largest route file
│   │   │   │   ├── graph_routes.py      # 244 lines
│   │   │   │   ├── integrity_routes.py  # 263 lines
│   │   │   │   ├── listing.py           # Pagination helpers
│   │   │   │   ├── report_routes.py
│   │   │   │   └── review_routes.py
│   │   │   ├── services/
│   │   │   │   ├── audit.py         # Audit event recording
│   │   │   │   ├── court_pdf.py     # Integrity dossier PDF generation
│   │   │   │   ├── extract.py       # Entry point (delegates)
│   │   │   │   ├── extract_common.py # Shared extraction helpers (297 lines)
│   │   │   │   ├── extract_document.py # PDF/text extraction
│   │   │   │   ├── extract_structured.py # CSV/JSON extraction
│   │   │   │   ├── graph.py         # Graph analytics + Neo4j delegation (417 lines)
│   │   │   │   ├── integrity.py     # SHA-256, Merkle, ledger anchoring (310 lines)
│   │   │   │   ├── kafka_bus.py     # Kafka event publisher
│   │   │   │   ├── masking.py       # PII masking
│   │   │   │   ├── neo4j_store.py   # Neo4j driver wrapper (183 lines)
│   │   │   │   ├── nlp_adapter.py   # NER: IndicBERT + rule fallback (229 lines)
│   │   │   │   ├── ocr_adapter.py   # OCR: PaddleOCR + pypdf fallback (207 lines)
│   │   │   │   ├── pipeline.py      # Evidence processing orchestration (199 lines)
│   │   │   │   ├── ratelimit.py     # Redis login throttle
│   │   │   │   ├── report.py        # Report generation
│   │   │   │   ├── resolution.py    # Entity resolution (candidate matching) (141 lines)
│   │   │   │   ├── scanner.py       # ClamAV integration
│   │   │   │   └── storage.py       # Object storage (S3/local) (189 lines)
│   │   │   └── tests/
│   │   │       ├── conftest.py
│   │   │       ├── test_archive_uploads.py
│   │   │       ├── test_case_create_assign.py
│   │   │       ├── test_case_people.py
│   │   │       ├── test_clamav_live.py
│   │   │       ├── test_cross_case_and_exports.py
│   │   │       ├── test_extraction_failures.py
│   │   │       ├── test_graph_analysis.py
│   │   │       ├── test_kafka_path.py
│   │   │       ├── test_listing_search.py
│   │   │       ├── test_merkle_rfc6962.py
│   │   │       ├── test_migrations.py
│   │   │       ├── test_neo4j_live.py
│   │   │       ├── test_ner_real_model.py
│   │   │       ├── test_new_components.py
│   │   │       ├── test_provenance_and_decisions.py
│   │   │       ├── test_ratelimit.py
│   │   │       ├── test_scanner_parsing.py
│   │   │       ├── test_security.py
│   │   │       ├── test_storage_s3.py
│   │   │       ├── test_workflow.py
│   │   │       └── test_workflow_restored.py
│   │   ├── migrations/            # Alembic migration files
│   │   └── requirements*.txt      # Python dependencies
│   │
│   └── web/
│       └── src/
│           ├── App.tsx
│           ├── main.tsx
│           ├── index.css
│           ├── app/
│           │   ├── providers/     # React context providers
│           │   └── router/        # React Router configuration
│           ├── components/
│           │   ├── auth/          # Protected route guard
│           │   ├── evidence/      # Provenance viewer, bbox overlay
│           │   ├── graph/         # Graph canvas, engine, filters, drawers
│           │   ├── intelligence/  # Confidence, entity, PII, reveal components
│           │   ├── layout/        # Page wrapper
│           │   ├── security/      # Security status bar
│           │   └── ui/            # Primitive UI components (badge, button, etc.)
│           ├── constants/         # Navigation, evidence tier definitions
│           ├── features/
│           │   ├── audit/         # Global audit page
│           │   ├── auth/          # Login page
│           │   ├── cases/         # Case listing, layout, graph, evidence, review, etc.
│           │   ├── command-center/ # Dashboard/command center
│           │   ├── not-found/     # 404 / route error pages
│           │   ├── profile/       # User profile page
│           │   ├── reports/       # Reports page
│           │   └── review/        # Global review page
│           ├── layouts/AppShell/  # App shell, sidebar
│           ├── lib/               # Formatters, permissions, PII, utils
│           ├── services/api/      # API client functions (12 files)
│           ├── stores/            # Zustand state stores (7 files)
│           ├── styles/            # CSS tokens, typography
│           └── types/             # TypeScript type definitions (9 files)
│
├── apps/api/migrations/           # Alembic versioned migrations
├── data/synthetic/                # Synthetic test data and truth labels
├── docs/                          # Project documentation
├── graph/                         # Graph ontology documentation
├── infrastructure/                # Nginx, systemd units
├── packages/schemas/              # Shared JSON schemas
├── policy/authorization/          # Authorization policy docs
├── scripts/                       # Operational scripts
├── security/                      # Security documentation
├── storage/                       # Local evidence storage (gitignored)
├── tests/e2e/                     # Playwright E2E tests
├── tests/infrastructure/          # Infrastructure tests
├── workers/                       # Kafka worker
└── audit/                         # Audit reports, test results, defect register
```

---

## 3. Backend Architecture — Current State

### 3.1 Layer responsibilities (actual, not intended)

```
HTTP Request
    │
    ▼
FastAPI Route Handler (routes/*.py)
    │  — HTTP parsing
    │  — authentication (via auth.py Depends)
    │  — authorization (authorize_case / require_roles)
    │  — inline business logic (many routes)
    │  — direct SQLAlchemy session use
    │  — inline response serialization (dict returns, no response schemas)
    ▼
Services (services/*.py)
    │  — mixed: business logic + infrastructure
    │  — no consistent layer boundary
    │  — graph.py: analytics + Neo4j interaction + in-process fallback
    │  — pipeline.py: orchestration + direct DB writes
    │  — storage.py: local FS + S3 dual-mode
    ▼
SQLAlchemy ORM (models.py + db.py)
    │
    ▼
SQLite / PostgreSQL / MinIO / Neo4j / Redis / ClamAV
```

### 3.2 Key architectural characteristics

**Strengths:**
- Clear evidence lifecycle enforcement (QUARANTINED → CLEAN → ACCEPTED flow)
- Fail-closed scanner behavior (unavailable ≠ clean)
- Tamper-evident audit trail with HMAC signatures
- Bounded graph queries (max hops, max nodes, timeouts)
- Dual-mode backends (SQLite↔PostgreSQL, local↔S3, in-process↔Neo4j)
- Comprehensive test coverage (199 tests)
- Security: path traversal, IDOR, case isolation, role gates all tested

**Architectural gaps (see TECHNICAL_DEBT_REGISTER.md for details):**
1. Routes contain inline business logic (evidence upload is 90 lines in one handler)
2. No centralized domain exception hierarchy — HTTPException used everywhere
3. Response schemas are `dict` returns without Pydantic models
4. `schemas.py` covers only 8 request types; response serialization is scattered
5. `graph.py` mixes analytics and Neo4j infrastructure in one 417-line file
6. `pipeline.py` directly writes to DB session (crosses layer boundary)
7. No structured JSON logging (uses stdlib `logging`)
8. No OpenAPI response schema documentation (all 200 responses are undocumented)
9. Config validation runs at import time (complicates test isolation)
10. `evidence_routes.py` has PDF parsing logic (`_pdf_pages`) that belongs in a service

---

## 4. Frontend Architecture — Current State

### 4.1 Structure quality

The frontend already follows a feature-module pattern and is reasonably well organized:

```
Good:
✓ Features organized by domain (cases, auth, review, audit)
✓ Shared components separated from feature components
✓ API clients isolated in services/api/
✓ Zustand stores for cross-component state
✓ TypeScript types in a dedicated types/ directory
✓ Utilities in lib/

Gaps:
△ Some API clients have thin type coverage
△ Stores sometimes hold server state that should be managed with
  react-query or similar (no cache invalidation, no loading states in store)
△ No shared form validation utilities
△ Error boundaries not used consistently
△ components/graph/ is a large mixed-responsibility area
```

### 4.2 State management model

| Store | Purpose | Quality |
|---|---|---|
| `authStore.ts` | JWT token, user identity | Good — single responsibility |
| `graphStore.ts` | Graph data, filters, selected node | Reasonable — could benefit from server state management |
| `auditStore.ts` | Audit events | Thin wrapper |
| `timelineStore.ts` | Timeline data, filters | Mixes server state with UI state |
| `revealStore.ts` | PII reveal state | Good — single operation |
| `provenanceStore.ts` | Evidence provenance | Good |
| `uiStore.ts` | UI state (sidebar, etc.) | Good |

---

## 5. Data Model

### 5.1 SQLAlchemy models (models.py)

| Model | Purpose |
|---|---|
| `User` | Investigative personnel with RBAC roles |
| `Case` | Investigation container with governance fields |
| `CaseAssignment` | User-to-case authorization |
| `Evidence` | Source file metadata with full state machine |
| `Claim` | Extracted entity or relationship candidate |
| `Provenance` | Source location linking a claim to evidence |
| `MatchCandidate` | Entity resolution candidate pair |
| `Review` | Human decision on a candidate |
| `Job` | Evidence processing job with idempotency key |
| `AuditEvent` | HMAC-signed tamper-evident audit record |
| `LedgerAnchor` | Merkle root anchoring (optional Besu integration) |

### 5.2 Evidence state machine

```
UPLOADED → HASHED → QUARANTINED → MALWARE_SCANNING
  → INFECTED (terminal, unless re-submitted)
  → SCAN_FAILED / SCAN_TIMEOUT / SCANNER_UNAVAILABLE (blocked, retryable)
  → CLEAN → ACCEPTED → PROCESSING → EXTRACTED → ENTITY_CANDIDATES → HITL
  → GRAPH_PROJECTED → ACTIVE
  → REJECTED (terminal)
  → STALE (soft-deprecation)
  → INTEGRITY_MISMATCH (blocked, investigated)
  → EXTRACTION_FAILED (retryable)
  → TOMBSTONED (admin override)
```

---

## 6. API Contract

All routes are under `/api/v1`. Key endpoint groups:

| Route file | Prefix | Endpoints |
|---|---|---|
| auth_routes | `/` | POST /login, GET /me, GET /users |
| case_routes | `/` | CRUD /cases, /cases/{id}/assign |
| evidence_routes | `/` | POST/GET /cases/{id}/evidence, evidence lifecycle |
| review_routes | `/` | Candidate listing, decisions, resolution |
| graph_routes | `/` | Graph, timeline, locations, analysis |
| integrity_routes | `/` | Merkle, anchoring, audit hash chain |
| audit_routes | `/` | Audit event listing |
| report_routes | `/` | JSON/HTML report, PDF dossier |
| demo_routes | `/` | Reset/seed (SQLite only) |

---

## 7. Deployment Architecture

```
Internet
    │
    ▼
Nginx (port 80/443)
    │  — Serves static SPA assets
    │  — Proxies /api/* to FastAPI
    ▼
FastAPI (uvicorn, port 8000, bound to 127.0.0.1)
    │
    ├── PostgreSQL (or SQLite)
    ├── MinIO/S3 (or local filesystem)
    ├── Neo4j (optional)
    ├── Redis (optional)
    └── ClamAV (clamd or clamscan)
```

The Compose stack (`docker-compose.yml`) orchestrates all services.
Systemd unit `dristinet-api.service` manages the production API process.

---

## 8. Known Limitations (as of baseline)

1. Compose stack not fully validated (BLK-04/05 from previous sessions resolved in recent commits)
2. NER evaluated on small corpus (1 document / 3 entities; real quality unknown)
3. No TLS in development configuration
4. Query cancellation not implemented (architecture target)
5. H3 spatial analytics not implemented (roadmap)
6. No token revocation / logout endpoint
7. E2E tests share the demo DB (risk of test pollution)
8. Government readiness matrix rows all NOT ASSESSED
9. No human second-reviewer has reviewed the independent technical audit
10. Performance numbers measured on single host (not representative of production load)

---

*This document was established by the modernization session. For current status, see docs/status.md.*
