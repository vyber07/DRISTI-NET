# DRISTI-NET — Master Dependency Audit

**Audit Date:** 2026-11-19  

---

## 1. Backend Python Dependencies (`apps/api/requirements.txt`)

| Package | Version Spec | Purpose | Status | Notes |
|---|---|---|---|---|
| `fastapi` | `>=0.110` | Core REST API framework | Active | Essential |
| `uvicorn` | `>=0.27` | Production ASGI web server | Active | Essential |
| `sqlalchemy` | `>=2.0` | Relational ORM mapping | Active | Essential |
| `alembic` | `>=1.13` | Relational database schema migrations | Active | Essential |
| `psycopg2-binary`| `>=2.9` | PostgreSQL database adapter | Active | Essential for production |
| `neo4j` | `>=5.20` | Neo4j Bolt graph client | Active | Essential for analytical graph |
| `pydantic` | `>=2.5` | Data validation and JSON schema | Active | Essential |
| `pypdf` | `>=4.0` | PDF text extraction and metadata parser | Active | Essential |
| `reportlab` | `>=4.0` | PDF generation for evidence dossiers | Active | Essential |
| `networkx` | `>=3.2` | In-process graph algorithms and fallback | Active | Essential |
| `PyJWT` | `>=2.8` | Cryptographic JWT bearer tokens | Active | Essential |
| `redis` | `>=5.0` | Redis client for rate limiting | Active | Essential |
| `boto3` | `>=1.34` | AWS / MinIO S3 object storage client | Active | Essential |
| `httpx` | `>=0.27` | Async HTTP client for seeds & testing | Active | Essential |

---

## 2. Frontend Dependencies (`apps/web/package.json`)

All 19 runtime dependencies and 10 development dependencies are actively utilized:
- **Core:** `react` 18.3, `react-dom` 18.3, `react-router-dom` 7.18.
- **Graph:** `sigma` 2.4, `graphology` 0.26, `graphology-layout-forceatlas2` 0.10.
- **UI:** `@radix-ui/*` primitives, `lucide-react`, `tailwindcss` 4.3, `zustand` 5.0.
- **Linters & Tooling:** `vite` 8.3, `oxlint` 1.81, `typescript` 6.0.
- **Audit Result:** Zero deprecated or unmaintained packages. Zero critical security advisories.
