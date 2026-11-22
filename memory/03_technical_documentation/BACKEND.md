# DRISTI-NET — Master Backend Technical Documentation

**Authority:** `apps/api/`, `docs/API_ARCHITECTURE.md`, `docs/context.md` §15  
**Consolidation Date:** 2026-11-19  

---

## 1. Architecture & Framework Stack

The backend service is built using **Python 3.11** and **FastAPI**, engineered for high-concurrency asynchronous I/O and strict type safety:
- **FastAPI / Starlette:** HTTP router, dependency injection, and middleware execution.
- **SQLAlchemy 2.0:** Relational ORM mapping PostgreSQL models. Sessions pinned strictly to UTC.
- **Pydantic v2:** Request and response schema validation with strict serialization.
- **Uvicorn:** ASGI application server with worker clustering support.
- **Alembic:** Database migration management.

---

## 2. Source Code Organization

```
apps/api/
├── app/
│   ├── main.py                  # Application entry point, lifespan hooks, CORS, middleware, SPA mount
│   ├── auth.py                  # JWT creation, PBKDF2 verification, RBAC dependency gates
│   ├── config.py                # Pydantic Settings, environment variable loading, bounds checking
│   ├── db.py                    # Engine creation, session maker, base declarative model
│   ├── models.py                # Authoritative SQLAlchemy database models (Cases, Evidence, POLE+, Audit)
│   ├── schemas.py               # Pydantic request/response schemas matching API contracts
│   ├── seed.py                  # Synthetic case and user seeding for dev/test environments
│   │
│   ├── routes/                  # Modular domain API routers (mounted under /api/v1)
│   │   ├── account_routes.py    # /auth/me, password change, active sessions, personal activity log
│   │   ├── auth_routes.py       # /auth/login, /auth/logout, /auth/refresh
│   │   ├── case_routes.py       # /cases, /cases/{id}, team assignments, stats
│   │   ├── evidence_routes.py   # /cases/{id}/evidence, streaming upload/download, quarantine control
│   │   ├── review_routes.py     # /cases/{id}/candidates, accept/reject/defer arbitration
│   │   ├── graph_routes.py      # /cases/{id}/graph, /cases/{id}/timeline, /cases/{id}/locations, unmask
│   │   ├── integrity_routes.py  # /cases/{id}/integrity/anchor, dossier PDF generation
│   │   └── audit_routes.py      # /cases/{id}/audit, /audit/events, verify
│   │
│   ├── services/                # Business logic and domain processing services
│   │   ├── storage.py           # Dual-tier object storage driver (S3/MinIO & local filesystem)
│   │   ├── scanner.py           # ClamAV fail-closed virus scanner client
│   │   ├── pipeline.py          # Coordinated ingestion orchestrator (validate -> quarantine -> scan -> extract)
│   │   ├── extract.py           # Archive traversal defense and uncompressed size ratio checks
│   │   ├── extract_document.py  # Document and structured file parsing (PDF, CSV, JSON, TXT)
│   │   ├── ocr_adapter.py       # PaddleOCR bounding box extraction with PyPDF fallback
│   │   ├── nlp_adapter.py       # IndicBERTv2 NER model adapter for Indian entity extraction
│   │   ├── resolution.py        # Conservative entity disambiguation and pairwise candidate generation
│   │   ├── graph.py             # In-process graph projector, degree/betweenness, temporal decay
│   │   ├── neo4j_store.py       # Analytical Neo4j Cypher projection manager
│   │   ├── masking.py           # PII masking (phone, PAN, Aadhaar hash, bank account) and audited reveal
│   │   ├── integrity.py         # RFC 6962 Merkle tree builder and Besu EVM smart contract client
│   │   ├── court_pdf.py         # Neutral BSA s.63(4)(c) evidence dossier PDF generator
│   │   ├── kafka_bus.py         # Asynchronous Kafka publisher
│   │   └── audit.py             # Cryptographic HMAC-SHA256 audit logger
│   │
│   └── tests/                   # Pytest automated test suite (540+ passing tests)
│
├── migrations/                  # Alembic revision scripts
├── requirements.txt             # Core backend production dependencies
├── requirements-ml.txt          # ML dependencies (torch, transformers, paddleocr)
├── requirements-dev.txt         # Development and testing dependencies (pytest, httpx)
└── Dockerfile                   # Multi-stage production container build
```

---

## 3. Core Security & Middleware Pipeline

Every HTTP request traverses a multi-layered middleware stack in `apps/api/app/main.py`:
1. **Trace ID Injection:** Generates a unique `X-Trace-Id` (e.g. `TRC-2093066046bb`) added to response headers and logging contexts.
2. **Security Headers Middleware:** Enforces `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, and strict Content Security Policy.
3. **CORS Middleware:** Restricts cross-origin requests to configured trusted origins with credential support.
4. **Authentication & Authorization Gate:** Validates Bearer JWTs, checks token version against revocation lists, parses user roles, and verifies case assignment permissions.
5. **Streaming Response Handling:** Large evidence downloads utilize `StreamingResponse` with `storage.iter_bytes()` to prevent heap memory exhaustion on multi-gigabyte files.
