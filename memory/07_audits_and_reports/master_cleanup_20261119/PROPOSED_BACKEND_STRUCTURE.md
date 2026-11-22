# DRISTI-NET — Proposed Feature-Oriented Backend Architecture

**Audit Date:** 2026-11-19  
**Status:** Proposal for User Review & Approval  

---

## Candidate Future Structure (Feature-Oriented)

```
apps/api/
├── app/
│   ├── api/v1/                  # Versioned API routes & dependency injection
│   │   ├── routes/
│   │   │   ├── auth.py          # Login, logout, refresh
│   │   │   ├── account.py       # Profile, password, sessions
│   │   │   ├── cases.py         # Case management & assignments
│   │   │   ├── evidence.py      # Uploads, quarantine, streaming download
│   │   │   ├── reviews.py       # HITL candidate arbitration
│   │   │   ├── graph.py         # POLE+ graph, timeline, locations, unmask
│   │   │   ├── integrity.py     # Merkle roots, Besu ledger, dossier PDF
│   │   │   └── audit.py         # Audit logs and verification
│   │   └── dependencies/        # Auth gates, case guards, rate limiters
│   │
│   ├── core/                    # Core infrastructure & configuration
│   │   ├── config.py            # Settings and bounds
│   │   ├── security.py          # PBKDF2 hashing, JWT signing
│   │   ├── database.py          # SQLAlchemy engine, sessions, base
│   │   └── exceptions.py        # Standardized HTTP and domain error handlers
│   │
│   ├── domain/                  # Rich domain business logic
│   │   ├── ingestion/           # Pipeline, scanner, archive defense
│   │   ├── extraction/          # Document, tabular, PaddleOCR, IndicBERT
│   │   ├── resolution/          # Deterministic matching & candidate scoring
│   │   ├── graph/               # Neo4j projection, NetworkX, temporal decay
│   │   ├── integrity/           # RFC 6962 Merkle engine, Besu EVM client
│   │   └── audit/               # HMAC-SHA256 signature chaining
│   │
│   ├── models/                  # Domain-partitioned SQLAlchemy ORM models
│   │   ├── case.py
│   │   ├── evidence.py
│   │   ├── pole.py
│   │   ├── review.py
│   │   └── audit.py
│   │
│   ├── schemas/                 # Domain-partitioned Pydantic schemas
│   │   ├── case.py
│   │   ├── evidence.py
│   │   ├── graph.py
│   │   └── review.py
│   │
│   └── main.py                  # Lifespan, CORS, middleware, static SPA mount
└── tests/                       # Pytest test suite
```
