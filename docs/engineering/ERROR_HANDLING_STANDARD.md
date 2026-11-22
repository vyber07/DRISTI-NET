# DRISTI-NET — Error Handling Standard

**Established:** 2026-11-06  
**Authority:** `docs/engineering/CODING_STANDARDS.md`, `apps/api/app/core/exceptions.py`

---

## 1. Principles

1. **Fail loudly internally, fail safely externally.** Log the full exception internally. Return a
   safe, stable error code to the client.
2. **No secrets in error responses.** Never include database error text, internal paths, tokens,
   host names, or stack traces in API error responses.
3. **Stable machine-readable codes.** Clients should be able to handle specific error types
   programmatically via the `code` field.
4. **Request correlation.** Every error response includes the `trace_id` from the request.
5. **Domain logic must not know about HTTP.** Services raise domain exceptions. Route handlers
   translate them to HTTP responses.

---

## 2. Standard API Error Response

**Since ADR-017 (2026-11-12, branch `worktree-auth-login-ratelimit`):** every error response, including HTTP
exceptions, 422 validation errors, pool timeouts, database outages and unhandled errors, has these top-level fields:

```json
{ "detail": "The service is busy. Please try again in a few seconds.", "code": "BUSY",
  "request_id": "REQ-…", "trace_id": "REQ-…" }
```

- `detail`: a message, or for 422 the list of `{loc, msg, type}`.
- `code`: stable. Values include `NOT_FOUND`, `FORBIDDEN`, `UNAUTHENTICATED`, `INVALID_REQUEST`, `CONFLICT`,
  `RATE_LIMITED`, `BUSY` (503, `Retry-After: 5`), `DB_UNAVAILABLE` (503, `Retry-After: 10`), `INTERNAL` (500), or
  a domain code.
- `request_id`: equal to the `X-Request-Id` header.
- Domain exceptions additionally keep the nested `error` object shown below.
- The web client shows `detail` and the request ID, and retries reads on 502, 503 and 504.

```json
{
  "error": {
    "code": "EVIDENCE_NOT_FOUND",
    "message": "The requested evidence record could not be found.",
    "trace_id": "TRC-abc123def456",
    "details": null
  }
}
```

| Field | Description |
|---|---|
| `code` | Stable machine-readable string. See §4. |
| `message` | Human-readable description. Safe for display. No internal paths or secrets. |
| `trace_id` | The `X-Trace-Id` header value for this request. |
| `details` | Optional structured additional context (validation errors, field names). |

---

## 3. Domain Exception Hierarchy

Defined in `apps/api/app/core/exceptions.py`:

```
DristiBaseError
├── NotFoundError              — 404 resource not found
├── AuthorizationError         — 403 access denied
│   └── CaseAccessDeniedError  — case-level access denied
├── ConflictError              — 409 state machine violation
│   ├── DuplicateEvidenceError — idempotent upload
│   └── IntegrityMismatchError — hash verification failed
├── ValidationError            — 422 input validation failed
├── InfrastructureError        — 503/500 service unavailable
│   ├── StorageUnavailableError
│   └── ScannerUnavailableError
└── ProcessingError            — 422/500 processing failure
```

### Mapping to HTTP status codes

| Exception class | HTTP status | Error code |
|---|---|---|
| `NotFoundError` | 404 | `NOT_FOUND` |
| `AuthorizationError` | 403 | `ACCESS_DENIED` |
| `CaseAccessDeniedError` | 403 | `CASE_ACCESS_DENIED` |
| `ConflictError` | 409 | `CONFLICT` |
| `DuplicateEvidenceError` | 409 | `DUPLICATE_EVIDENCE` |
| `IntegrityMismatchError` | 409 | `INTEGRITY_MISMATCH` |
| `ValidationError` | 422 | `VALIDATION_ERROR` |
| `InfrastructureError` | 503 | `SERVICE_UNAVAILABLE` |
| `StorageUnavailableError` | 503 | `STORAGE_UNAVAILABLE` |
| `ScannerUnavailableError` | 503 | `SCANNER_UNAVAILABLE` |
| `ProcessingError` | 422 | `PROCESSING_ERROR` |
| Unhandled `Exception` | 500 | `INTERNAL_ERROR` |

---

## 4. Error Codes Reference

| Code | Meaning | HTTP |
|---|---|---|
| `NOT_FOUND` | Requested resource does not exist | 404 |
| `UNAUTHORIZED` | No valid authentication token | 401 |
| `ACCESS_DENIED` | Authenticated but not authorized | 403 |
| `CASE_ACCESS_DENIED` | User not assigned to this case | 403 |
| `ROLE_REQUIRED` | Action requires a specific role | 403 |
| `CONFLICT` | Action conflicts with current state | 409 |
| `DUPLICATE_EVIDENCE` | File with this SHA-256 already exists in this case | 409 |
| `INTEGRITY_MISMATCH` | Stored file hash does not match manifest | 409 |
| `EVIDENCE_QUARANTINED` | Evidence has not passed the scan gate | 409 |
| `EVIDENCE_INFECTED` | Evidence flagged as containing malware | 409 |
| `VALIDATION_ERROR` | Request body or parameters failed validation | 422 |
| `UPLOAD_REJECTED` | File type, size, or structure rejected | 422 |
| `SERVICE_UNAVAILABLE` | Required service is unreachable | 503 |
| `STORAGE_UNAVAILABLE` | Evidence storage service is unreachable | 503 |
| `SCANNER_UNAVAILABLE` | Malware scanner is unreachable (not clean) | 503 |
| `PROCESSING_ERROR` | Evidence processing failed | 422 |
| `INTERNAL_ERROR` | Unexpected server error | 500 |

---

## 5. Backend Implementation Pattern

### In a service:

```python
from ..core.exceptions import NotFoundError, IntegrityMismatchError

def get_evidence_for_read(db: Session, evidence_id: str) -> Evidence:
    ev = db.get(Evidence, evidence_id)
    if ev is None:
        raise NotFoundError("evidence", evidence_id)
    if ev.status == "INTEGRITY_MISMATCH":
        raise IntegrityMismatchError(evidence_id, ev.sha256, actual=None)
    return ev
```

### In a route handler:

```python
from ..core.exceptions import NotFoundError, IntegrityMismatchError

@router.get("/evidence/{evidence_id}")
def get_evidence(evidence_id: str, ...):
    try:
        ev = evidence_service.get_evidence_for_read(db, evidence_id)
    except NotFoundError as exc:
        raise HTTPException(404, exc.safe_message())
    except IntegrityMismatchError as exc:
        raise HTTPException(409, exc.safe_message())
    return evidence_out(ev)
```

### Centralized handler in `main.py`:

```python
@app.exception_handler(DristiBaseError)
async def domain_error_handler(request: Request, exc: DristiBaseError):
    return JSONResponse(
        status_code=exc.http_status,
        content={"error": {"code": exc.code, "message": exc.safe_message(),
                           "trace_id": getattr(request.state, "trace_id", None)}}
    )
```

---

## 6. Frontend Error Handling

### API client pattern

```typescript
// services/api/evidenceApi.ts
export async function getEvidence(evidenceId: string): Promise<EvidenceRecord> {
  const response = await client.get(`/evidence/${evidenceId}`);
  if (!response.ok) {
    const body = await response.json();
    throw new ApiError(body.error?.code ?? 'UNKNOWN', body.error?.message ?? 'Unknown error');
  }
  return response.json();
}
```

### Component error states

Every data-fetching component must handle:
- `loading` — skeleton or spinner
- `error` — inline error message with retry where appropriate
- `empty` — empty state with guidance
- `unauthorized` — redirect to login or show access-denied message
- `data` — normal rendered content

Do not display:
- Raw error messages from the API (may contain internal paths)
- Technical error codes to end users (log to console only)
- Generic "Something went wrong" without an action the user can take

---

## 7. Worker and Background Job Error Handling

For evidence processing jobs (`pipeline.py`, `workers/worker.py`):

| Error type | Behavior | Retry |
|---|---|---|
| Transient infra failure (storage, scanner) | Mark job `FAILED`, preserve evidence state | Yes, bounded |
| Malware detected | Mark evidence `INFECTED`, do not retry processing | No |
| Parser/OCR failure | Mark evidence `EXTRACTION_FAILED`, log details | Yes, up to 3 attempts |
| Corrupt file | Mark evidence `EXTRACTION_FAILED`, preserve original | No (file is bad) |
| Scanner unavailable | Mark evidence `SCANNER_UNAVAILABLE` — never clean | Yes (after delay) |
| Unexpected exception | Mark job `FAILED`, log full traceback internally | Yes, once |

**Critical rule:** Scanner unavailable NEVER results in CLEAN status. This is a hard invariant of
the security model.

---

## 8. Audit and Logging Integration

Every error on a sensitive operation must be recorded as an audit event:

```python
record_audit(db, trace_id, user.user_id, action, resource_type, resource_id, case_id,
             outcome="DENIED", detail={"reason": "role not permitted", "role": user.role})
```

Outcomes:
- `OK` — successful action
- `DENIED` — authorization refused
- `ERROR` — unexpected failure
- `DUPLICATE` — idempotent repeat

---

*This standard applies to all new code. Legacy code that does not conform should be migrated
incrementally, prioritizing security-sensitive paths first.*
