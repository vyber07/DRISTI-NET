# DRISTI-NET — Coding Standards

**Established:** 2026-11-06  
**Authority:** This document governs all code in the DRISTI-NET repository.

---

## 1. Python (Backend)

### 1.1 Naming

| Element | Convention | Example |
|---|---|---|
| Modules/packages | `snake_case` | `evidence_routes.py`, `extract_common.py` |
| Functions | `snake_case` | `def upload_evidence(...)` |
| Classes | `PascalCase` | `class EvidenceService:` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_UPLOAD_MB = 25` |
| Private helpers | `_snake_case` | `def _pdf_pages(...)` |
| SQLAlchemy models | `PascalCase` | `class Evidence(Base):` |
| Pydantic schemas | `PascalCase` with `In`/`Out` suffix | `class EvidenceIn(BaseModel):`, `class EvidenceOut(BaseModel):` |
| Test files | `test_<what_is_tested>.py` | `test_evidence_upload.py` |
| Test functions | `test_<what>_<condition>_<expected>` | `test_upload_infected_file_stays_quarantined` |

### 1.2 Type annotations

- All public function signatures must have type annotations.
- Prefer `str | None` over `Optional[str]` (Python 3.10+ union syntax).
- Use `from __future__ import annotations` for forward references.
- Return types must be annotated. `-> None` is explicit and required.

### 1.3 Imports

Order: stdlib → third-party → local (separated by blank lines).

```python
from __future__ import annotations

import json
import logging
from pathlib import Path

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..models import Evidence
```

Avoid:
- Wildcard imports (`from module import *`)
- Lazy imports inside function bodies (unless a genuine circular import exists)
- Relative imports beyond one level up (`from ...`)

### 1.4 Error handling

- Never use bare `except:`. Always specify the exception type.
- Do not silently swallow exceptions. At minimum, log them.
- Never return `None` to signal an error that should stop execution — raise.
- Domain logic must not raise `HTTPException`. Raise domain exceptions (see `core/exceptions.py`).
- Route handlers catch domain exceptions and convert them to HTTP responses.

```python
# BAD
try:
    result = risky_call()
except:
    pass

# GOOD
try:
    result = risky_call()
except StorageUnavailableError as exc:
    logger.error("storage unavailable: %s", exc)
    raise HTTPException(503, "evidence storage unavailable")
```

### 1.5 Logging

Use the structured logger from `core/logging.py`:

```python
import logging
logger = logging.getLogger("drishti.<module>")
logger.info("action completed", extra={"trace_id": trace, "actor": user_id, "outcome": "OK"})
```

Never log:
- Passwords, tokens, or secret keys
- Raw evidence content
- Stack traces in HTTP responses (log internally, return a safe message)
- Full SQL queries containing sensitive parameters

### 1.6 Database access

- Always use the `get_db` dependency for session lifecycle management.
- Never commit a session inside a service. The route handler commits after all service calls succeed.
- Use `db.get(Model, pk)` for primary-key lookups (not `db.query(Model).filter_by(id=pk).first()`).
- Always bound list queries with `.limit()`.
- Use `db.flush()` before returning a new object's auto-generated ID, not `db.commit()`.

### 1.7 Security rules

- **Backend authorization is mandatory.** Frontend role checks are advisory only.
- Call `authorize_case()` before accessing any case-scoped resource.
- Use `require_roles()` on any route that modifies state.
- Record an audit event for every sensitive action (upload, download, reveal, decision).
- Never echo internal exceptions, host names, or database errors to API responses.

---

## 2. TypeScript / React (Frontend)

### 2.1 Naming

| Element | Convention | Example |
|---|---|---|
| React components | `PascalCase` | `EvidenceTable.tsx` |
| Hooks | `useCamelCase` | `useEvidence.ts` |
| Utilities/helpers | `camelCase` | `formatters.ts` |
| Types/interfaces | `PascalCase` | `type EvidenceRecord = {...}` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_TABLE_ROWS` |
| API client files | `<domain>Api.ts` | `evidenceApi.ts` |
| Store files | `<domain>Store.ts` | `graphStore.ts` |
| Feature pages | `<Feature>Page.tsx` | `EvidenceListPage.tsx` |

### 2.2 TypeScript requirements

- Strict mode enabled in `tsconfig.json`.
- Avoid `any`. Use `unknown` and narrow at boundaries.
- Define explicit types for all API response shapes.
- Prefer `type` over `interface` for plain data shapes; use `interface` for extendable contracts.
- Functions that can return different types must have explicit return type annotations.

### 2.3 React component rules

- One component per file.
- Extract business logic into hooks (`useX`), not into component bodies.
- Props must be typed. Never use `{}` as a prop type.
- Avoid inline arrow functions in JSX that create new references on every render.
- Use `React.memo` for pure presentational components that re-render frequently.

### 2.4 State management

| State type | Where it lives |
|---|---|
| Server-fetched data | Zustand store (or react-query in future) |
| Local UI state (open modal, active tab) | `useState` in the component |
| Cross-feature shared state | Zustand store |
| Auth / session | `authStore.ts` |
| URL-driven state (filters, pagination) | URL search params |

Do not put server state directly in component `useState` — it cannot be shared or invalidated.

### 2.5 API client rules

- All API calls go through `services/api/`.
- Use the `real_client.ts` base client for authenticated requests.
- Never call `fetch()` directly in a component.
- Handle API errors uniformly: return a typed result `{data, error}` or throw a typed `ApiError`.
- Never log tokens or response bodies containing PII.

### 2.6 Language / content rules (from docs/context.md §16)

| Use | Avoid |
|---|---|
| "candidate relationship" | "criminal relationship", "confirmed link" |
| "possible bridge" | "kingpin", "ringleader" |
| "review priority" | "threat score", "risk score" |
| "source-linked claim" | "proven fact" |
| "integrity reference" | "proof of authenticity", "certified" |

These rules apply to all UI labels, tooltips, error messages, and report content.

---

## 3. File organization rules

### 3.1 Backend

- Route handlers: HTTP concerns only (parse request, call service, serialize response).
- Services: business logic and domain rules. No HTTP types.
- Core modules (`core/`): cross-cutting concerns (config, exceptions, logging, security).
- Tests: mirror the source structure. One test file per source module where possible.

### 3.2 Frontend

```
features/<domain>/
  ├── components/     — domain-specific presentational components
  ├── hooks/          — domain-specific hooks
  ├── pages/          — route-level page components
  └── index.ts        — public exports (optional)

components/ui/        — reusable primitive UI components
components/layout/    — page layout wrappers
services/api/         — HTTP client functions
stores/               — Zustand state stores
types/                — shared TypeScript type definitions
lib/                  — pure utility functions
```

### 3.3 What must not go where

| ❌ Never | ✓ Instead |
|---|---|
| Business logic in route handlers | Put in services |
| HTTPException in services | Raise domain exceptions, convert in routes |
| Direct `fetch()` in components | Use `services/api/` |
| Auth decisions in frontend | Backend enforces; frontend reflects |
| SQL queries in route handlers | Use services or repositories |
| Credentials in source code | Use environment variables via `config.py` |

---

## 4. Testing conventions

### 4.1 Backend

- Unit tests: fast, no DB, mock external services.
- Integration tests: use the in-memory SQLite + testgate scanner.
- Live tests: skip unless `NEO4J_URI`, `CLAMAV_HOST`, or `S3_ENDPOINT_URL` are set.
- Test naming: `test_<action>_<condition>_<expected_outcome>`.
- Every security-relevant path needs both a success test and a denial test.

### 4.2 Frontend

- Component tests: use React Testing Library, not shallow rendering.
- API mocking: use `msw` or `vi.mock` — never make real HTTP calls in unit tests.
- Accessibility: use `@axe-core/react` for accessibility assertions.

---

*This document is the enforced standard. All new code must conform. Legacy code that does not conform
should be migrated to these standards as part of refactoring work, not left as permanent exceptions.*
