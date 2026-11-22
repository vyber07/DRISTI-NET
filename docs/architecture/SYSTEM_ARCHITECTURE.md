# DRISTI-NET — System Architecture

**Established:** 2026-11-06  
**Status:** CURRENT IMPLEMENTATION + TARGET ARCHITECTURE  
**See also:** `docs/architecture/BASELINE_ARCHITECTURE.md` for the pre-modernization state

---

## 1. Architecture Principles

1. **PostgreSQL is the source of truth.** Evidence metadata, relationships, audit trail, and
   human decisions live in PostgreSQL. Neo4j is a rebuildable analytical projection.
2. **Evidence bytes stay in object storage.** Original evidence bytes live in MinIO/S3.
   The database holds only metadata and provenance pointers.
3. **Fail closed.** Every ambiguous security gate defaults to denial. Scanner unavailable ≠ clean.
4. **Human review before person-level merges.** No automated identity resolution. All candidate
   merges require an authorized human decision.
5. **Backend authorization is mandatory.** The frontend may hide controls but the backend
   enforces every access rule independently.
6. **Bounded graph queries.** The browser never receives unrestricted graph access. All queries
   enforce hop limits, node limits, timeouts, and case scoping.

---

## 2. Component Responsibilities

### 2.1 Backend application layer (`apps/api/app/`)

```
HTTP Layer (routes/)
  ├── auth_routes      — login, token, user listing
  ├── case_routes      — CRUD cases, assignments
  ├── evidence_routes  — evidence lifecycle, context, download
  ├── review_routes    — candidate listing, human decisions
  ├── graph_routes     — graph, timeline, locations, analysis
  ├── integrity_routes — hash chains, Merkle, anchoring
  ├── audit_routes     — audit event listing
  ├── report_routes    — JSON/HTML report, PDF dossier
  └── demo_routes      — SQLite-only reset/seed

Application Services (services/)
  ├── pipeline         — evidence processing orchestration
  ├── scanner          — ClamAV integration (fail-closed)
  ├── storage          — object storage (local FS / MinIO / S3)
  ├── extract_common   — shared extraction utilities
  ├── extract_structured — CSV/JSON extraction
  ├── extract_document   — PDF/text extraction
  ├── ocr_adapter      — PaddleOCR + pypdf fallback
  ├── nlp_adapter      — IndicBERT NER + rule-based fallback
  ├── resolution       — entity resolution (candidate matching)
  ├── graph            — analytics + Neo4j/in-process projection
  ├── neo4j_store      — Neo4j driver wrapper
  ├── integrity        — SHA-256, Merkle tree, ledger anchoring
  ├── audit            — HMAC-signed audit event recording
  ├── masking          — PII field masking
  ├── report           — report generation
  ├── court_pdf        — integrity dossier PDF
  ├── kafka_bus        — Kafka event publisher (opt-in)
  ├── ratelimit        — Redis login throttle (opt-in)
  └── evidence_service — evidence domain operations (NEW: 2026-11-06)

Cross-cutting concerns (core/)  ← NEW: 2026-11-06
  ├── exceptions       — domain exception hierarchy
  └── logging          — structured logging configuration

Domain data (models.py, schemas.py)
  ├── SQLAlchemy ORM models (11 models)
  └── Pydantic input schemas (8 types)

Infrastructure (db.py, config.py, auth.py)
  ├── database session management
  ├── runtime configuration (env vars)
  └── JWT auth + RBAC/case authorization
```

### 2.2 Frontend application (`apps/web/src/`)

```
App shell (layouts/AppShell/)
  ├── Sidebar navigation
  └── Route outlet

Feature modules (features/)
  ├── auth/            — login page
  ├── cases/           — case directory, case workspace
  │   ├── analysis/    — case analysis page
  │   ├── audit/       — case audit trail view
  │   ├── evidence/    — evidence list + detail drawer
  │   ├── map/         — location map view
  │   ├── reviews/     — review queue
  │   └── timeline/    — event timeline
  ├── audit/           — global audit page
  ├── command-center/  — investigator dashboard
  ├── review/          — global review page
  └── reports/         — reports page

Shared components (components/)
  ├── graph/           — Sigma.js canvas, engine, filters, drawers
  ├── intelligence/    — confidence meter, entity badge, PII reveal
  ├── layout/          — page wrapper
  ├── security/        — security status bar
  └── ui/              — primitive components (button, badge, dialog, etc.)

Services (services/api/)        — HTTP client functions
State (stores/)                 — Zustand cross-component state
Types (types/)                  — TypeScript type definitions
Utilities (lib/)                — formatters, permissions, PII helpers
```

---

## 3. Data Flow

### 3.1 Evidence ingestion

```
Officer uploads file
        │
        ▼
Validation (MIME type, extension, size, archive structure)
        │  → reject with 422 if invalid
        ▼
Write to quarantine storage (MinIO / local FS)
        │
        ▼
SHA-256 hash computed → stored in Evidence record
        │
        ▼
ClamAV scan (clamd or clamscan)
        │  → INFECTED: stays in quarantine, never parsed
        │  → SCAN_FAILED / TIMEOUT / UNAVAILABLE: blocked, not clean
        ▼
Evidence promoted to CLEAN
        │
        ▼
Parser / OCR extraction worker
        │  → PDF: PaddleOCR / pypdf
        │  → CSV/JSON: structured extractor
        │  → TXT: text parser
        ▼
Entity + relationship candidates created (Claim records)
        │
        ▼
Human review queue (HITL)
        │  → APPROVE / REJECT / DEFER / REVERSE
        ▼
Approved claims projected into Neo4j (or in-process) graph
        │
        ▼
Analyst views graph / timeline / map
```

### 3.2 Authorization flow

```
JWT token (header or cookie)
        │
        ▼
auth.current_user() — decode + verify token → User record
        │
        ▼
require_roles("ROLE1", "ROLE2") — RBAC check
        │  → 403 if role not permitted
        ▼
authorize_case(db, user, case_id) — case assignment check
        │  → 403 if user not assigned to case
        │  → jurisdiction check
        ▼
Resource operation (always server-side)
        │
        ▼
AuditEvent recorded (HMAC-signed)
```

### 3.3 Graph query flow

```
API request with case_id, hops, node filters
        │
        ▼
authorize_case() — case isolation
        │
        ▼
graph.build_case_graph(db, case_id)
        │  → Loads Claims + Reviews from PostgreSQL
        │  → Filters to APPROVE + ALLOWED decisions
        │  → Builds NetworkX graph (in-process)
        │  → If Neo4j available: also queries Neo4j projection
        ▼
Bounded traversal (max 2 hops, max 150 nodes)
        │
        ▼
Supernode detection + capping
        │
        ▼
Analytics (degree, betweenness, communities, burst rules)
        │
        ▼
Paginated response with provenance IDs
```

---

## 4. Deployment Architecture

### 4.1 Production (Docker Compose)

```
┌─────────────────────────────────────────────────────────┐
│  Nginx :80 / :443                                        │
│  - Serves /assets/* from web build                       │
│  - Proxies /api/* to FastAPI :8000                       │
└──────────────┬──────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────┐
│  FastAPI (uvicorn, bound to 127.0.0.1:8000)             │
│  - JWT authentication                                     │
│  - RBAC + case authorization                              │
│  - Evidence pipeline (inline processing)                  │
│  - Bounded graph queries                                   │
└───┬────────┬────────┬────────┬─────────────────────────┘
    │        │        │        │
    ▼        ▼        ▼        ▼
 PostgreSQL MinIO   Neo4j    ClamAV
 :5432     :9000   :7687    :3310

Optional:
  Redis :6379 — login throttle
  Kafka :9092 — async event bus
  Besu        — Merkle root anchoring
```

### 4.2 Development / SQLite mode

```
FastAPI (port 8000)
  ├── SQLite (storage/drishti.db)
  ├── Local FS (storage/quarantine/, storage/accepted/)
  ├── In-process graph (NetworkX)
  └── testgate scanner (synthetic outcomes, not ClamAV)
```

---

## 5. Security Architecture

### 5.1 Authentication

- JWT HS256 tokens, signed with `DRISHTI_SECRET_KEY` (minimum 32 chars)
- Token TTL: configurable (default 8 hours)
- No token revocation endpoint (architecture target)
- Login throttle: Redis counter, 5 attempts / 15 min window (optional)

### 5.2 Authorization

- **RBAC roles:** INVESTIGATOR, EVIDENCE_OFFICER, REVIEWER, ANALYST, AUDITOR, ADMIN
- **Case isolation:** every resource operation checks case assignment + jurisdiction
- **Object-level:** evidence, candidates, entities all checked for case membership
- **Frontend reflects backend** but does not enforce independently

### 5.3 Data protection

- PII masking by default (phone numbers, account numbers, names in some contexts)
- Authorized reveal requires reason + audit event
- Evidence download requires INVESTIGATOR/REVIEWER/ADMIN role + reason
- Original evidence bytes never overwritten

### 5.4 Integrity

- SHA-256 hash at upload; verified on every read
- HMAC-SHA256 audit signatures (hash chain)
- Merkle tree grouping for case-level integrity references
- Optional Hyperledger Besu anchoring

---

*For the pre-modernization baseline, see `docs/architecture/BASELINE_ARCHITECTURE.md`.*
*For project constitution and product boundary, see `docs/context.md`.*
