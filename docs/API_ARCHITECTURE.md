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
| `POST` | `/auth/login` | Public | Authenticates officer credentials; subject to Redis login throttle. |
| `GET` | `/auth/me` | Authenticated | Returns current officer profile, designation, role, and jurisdiction. |

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
