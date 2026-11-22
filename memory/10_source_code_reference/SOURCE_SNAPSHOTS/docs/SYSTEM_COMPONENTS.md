# DRISTI-NET — System Components

## 1. Component Registry

### 1.1 Web Application Client (`apps/web`)
- **Technology**: React 19, TypeScript, Vite, TailwindCSS, Lucide-react, Radix UI primitives.
- **Graph Visualization**: Sigma.js v3 + Graphology for WebGL-accelerated 2D graph layout (ForceAtlas2) handling up to 10,000 nodes/edges in bounded views.
- **State Management**: Zustand stores with role-based feature gating (`authStore`, `graphStore`, `hitlStore`, `evidenceStore`, `auditStore`).
- **Network Layer**: Type-safe REST client (`services/api/`) with automatic token renewal and binary blob stream support for dossiers.

### 1.2 API Application Server (`apps/api/app`)
- **Technology**: FastAPI, Python 3.11, Pydantic v2, SQLAlchemy 2.0.
- **Authentication**: JWT RS256 / HS256 tokens with role-based access control (RBAC) supporting 7 distinct roles:
  `ADMIN`, `INVESTIGATOR`, `EVIDENCE_OFFICER`, `REVIEWER`, `ANALYST`, `AUDITOR`, `UNASSIGNED`.
- **Case Authorization**: `authorize_case()` dependency enforcing jurisdiction equality and active user case assignment.
- **Data Serialization**: Masked PII schemas (`schemas.py`) ensuring non-elevated endpoints emit redacted identifiers.

### 1.3 Evidence Extraction & Processing Engines
- **Structured Parsers** (`services/extract_structured.py`): Extract CDR records (calls, cell towers), banking transactions, vehicle registrations, and person identity sheets into claims.
- **Document Extractor** (`services/extract_document.py`): Multi-page PDF/TXT document processor linking extracted claims to exact page, line, and character offsets.
- **OCR Engine** (`services/ocr_adapter.py`): PaddleOCR 3.7.0 (en configuration) with fallback to PyMuPDF text stream extraction for embedded text layers.
- **Named Entity Recognition** (`services/nlp_adapter.py`): AI4Bharat `IndicBERTv2-MLM-only-NER` token classification model with lazy pipeline instantiation and graceful degradation.

### 1.4 Resolution & Review Engines
- **Entity Resolution** (`services/resolution.py`): Conservative blocking-key pairwise matcher evaluating Jaro-Winkler/difflib name similarity, shared phones, shared accounts, and conflicting demographic attributes.
- **Human-in-the-Loop (HITL)** (`routes/review_routes.py`): Mandatory arbitration portal capturing officer badge, justification string, and cryptographic timestamp before merging candidate profiles.

### 1.5 Storage and Persistence Subsystems
- **Relational DB** (`db.py`, `models.py`): PostgreSQL 15+ (production) / SQLite (embedded/testing).
- **Object Storage** (`services/storage.py`): S3-compatible MinIO backend with local filesystem fallback.
- **Analytical Graph Store** (`services/neo4j_store.py`): Neo4j 5.x Bolt driver with cypher projection routines.
- **Event Bus & Worker** (`services/kafka_bus.py`, `workers/worker.py`): Optional Kafka event distribution for asynchronous job processing.

### 1.6 Integrity & Audit Subsystems
- **Audit Logger** (`services/audit.py`): HMAC-SHA256 signed event trail with key versioning (`k1-2026`) and tamper-evident chaining.
- **Merkle Tree & Ledger Anchor** (`services/integrity.py`): Hierarchical cryptographic hashing with optional Besu Ethereum JSON-RPC commit.
- **Dossier Generator** (`services/court_pdf.py`): ReportLab PDF generation structuring evidence references under Bharatiya Sakshya Adhiniyam (BSA) s.63 and Indian Evidence Act s.65B.
