# DRISTI-NET — API Architecture & Contract Specification

## 1. Gateway & Protocol Conventions

- **Base URI**: `/api/v1`
- **Authentication**: HTTP Bearer JWT header (`Authorization: Bearer <token>`).
- **Standard Encodings**: `application/json` (API data payloads), `multipart/form-data` (evidence ingestion), `application/pdf` (binary dossiers).
- **Error Responses**: RFC 7807 compliant JSON errors containing `detail` string and unique `trace_id`.

---

## 2. API Endpoints Matrix

### 2.1 Authentication & Profile (`/api/v1/auth`)
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `POST` | `/auth/login` | Public | Authenticates officer credentials. Rate-limited per account, per source IP and per account across sources; see *Login and rate limits* below. Body is bounded (username 1–200, password 1–1024 characters, else 422). |
| `GET` | `/auth/me` | Authenticated | Returns current officer profile, designation, role, and jurisdiction. Subject to the per-user API ceiling. |
| `GET` | `/users/{user_id}/login-status` | ADMIN | Lockout state of an account: `locked`, `retry_after`, `distinct_failing_sources`, `source_limit`, `escalation_level`. |
| `POST` | `/users/{user_id}/unlock` | ADMIN | Clears every login lock and failure counter for the account. Audited (`USER_UNLOCK`). Returns `was_locked`. |
| `POST` | `/users/{user_id}/reset-password` | ADMIN | Sets a new password, invalidates existing tokens, and also clears the account's login locks (audited). |

#### Login and rate limits

- **Responses are the same whether or not the username exists.** Unknown user, inactive account and wrong password all return `401 {"detail": "Invalid credentials"}`. Every login runs one password hash, so response time does not reveal existence either.
- **Rate-limited responses** return `429 {"detail": "Too many failed login attempts; try again later"}` with `Retry-After` (seconds). The body is identical for a locked account, a known or unknown name, and a per-source ceiling. Limited attempts skip password hashing.
- **Limits** (defaults; see `apps/api/app/config.py`):
  - per account and source IP: 5 failures / 15 min (ADMIN and AUDITOR: 3 / 30 min);
  - per account across sources: locked after failures from 10 distinct source IPs (ADMIN and AUDITOR: 5) within 60 min; lock 15 min, doubling per repeat up to 4 h;
  - per source IP across all usernames: 30 failures / 15 min;
  - all `/api/v1` requests per IP: 600 / min (health and ready exempt); per user: 300 / min (ADMIN 600).
- **Client IP** comes from `X-Forwarded-For` only when the direct peer is in `DRISHTI_TRUSTED_PROXIES`; otherwise the socket peer is used.
- **Recovery:** the lock expires on its own. An administrator can call `unlock`, or reset the password. If no administrator can sign in, an operator runs `docker compose exec api python -m apps.api.app.unlock_cli <username>`.
- **Errors other than these:** a body that fails validation returns `422` with FastAPI's standard detail. The web client shows this as raw text, a known cosmetic gap.

### 2.2 Case Management (`/api/v1/cases`)
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `GET` | `/cases` | Authenticated | Lists cases assigned to the user within their statutory jurisdiction. |
| `POST` | `/cases` | Investigator/Admin | Creates a case docket; requires mandatory `authority_reference` and `purpose`. |
| `GET` | `/cases/{id}` | Case-Authorized | Retrieves case summary and governance metadata. |
| `GET` | `/cases/{id}/stats` | Case-Authorized | Aggregates candidate counts, evidence tallies, and review progress. |

### 2.3 Evidence & Quarantine Gate (`/api/v1/evidence`)
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `POST` | `/cases/{id}/evidence` | Evidence Officer | Ingests raw evidence into quarantine; computes SHA-256 and triggers scanner. |
| `GET` | `/cases/{id}/evidence` | Case-Authorized | Lists evidence items for the case with current governance states. |
| `GET` | `/evidence/{id}/claims` | Case-Authorized | Paginated retrieval of assertions extracted from this evidence item. |
| `GET` | `/evidence/{id}/context` | Case-Authorized | Fetches source context row/line with byte-level integrity verification. |
| `GET` | `/evidence/{id}/verify` | Auditor/Admin | Recalculates storage hash and compares to acceptance manifest. |

### 2.4 Human-in-the-Loop Review (`/api/v1/candidates`)
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `GET` | `/cases/{id}/candidates` | Reviewer/Investigator | Lists proposed pairwise match candidates with similarity and conflict signals. |
| `GET` | `/candidates/{id}` | Reviewer/Investigator | Detailed inspection of candidate match signals, counter-evidence, and conflicts. |
| `POST` | `/candidates/{id}/decision` | Reviewer | Commits supervisory decision (`APPROVE`, `REJECT`, `DEFER`, `REVERSE`) with mandatory justification. |

### 2.5 Graph & Analytical Projection (`/api/v1/graph`)
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `GET` | `/cases/{id}/graph` | Case-Authorized | Bounded graph projection (max 150 nodes / 2 hops) with masked PII. |
| `GET` | `/cases/{id}/edge` | Case-Authorized | Detailed provenance inspection for a selected graph edge. |
| `POST` | `/entities/{id}/reveal` | Case-Authorized | Audited request to unmask a sensitive entity attribute with logged statutory reason. |

### 2.6 Dossiers, Reports & Audit (`/api/v1/report`, `/api/v1/audit`)
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `POST` | `/cases/{id}/report` | Case-Authorized | Generates comprehensive case report in JSON, HTML, or signed Dossier PDF. |
| `GET` | `/cases/{id}/audit` | Auditor/Case-Auth | Returns cryptographic audit trail for the case with signature verification. |
| `GET` | `/audit/verify` | Auditor | Validates end-to-end HMAC-SHA256 signature chain across all events. |
