# DRISTI-NET — Code Cleanup Register

**Established:** 2026-11-06  
**Authority:** `docs/engineering/TECHNICAL_DEBT_REGISTER.md`

> This register tracks every identified dead-code, duplicate-code, and obsolete-code item.
> Nothing is deleted until its usage is verified and a replacement (if needed) is in place.

---

## Status definitions

| Status | Meaning |
|---|---|
| IDENTIFIED | Found but not yet analyzed |
| ANALYZED | Usage verified; decision made |
| IN PROGRESS | Migration underway |
| RESOLVED | Cleaned up; tests pass |
| DEFERRED | Intentionally postponed with reason |
| REJECTED | Decided to keep as-is with reason |

---

## Duplicate Code Items

| ID | Description | Location | Duplicate Location | Decision | Tests | Status |
|---|---|---|---|---|---|---|
| DUP-001 | PDF page parsing for context display | `evidence_routes._pdf_pages()` | (was duplicated in `context` and `context_reveal`) | Consolidated into `services/evidence_service.pdf_pages_for_context()` | Existing tests cover both endpoints | RESOLVED (2026-11-06) |
| DUP-002 | Context window extraction logic | `evidence_routes.context()` | `evidence_routes.context_reveal()` | Consolidated into `services/evidence_service.build_context_window()` | Existing endpoint tests verify both paths | RESOLVED (2026-11-06) |
| DUP-003 | Graph edge serialization | `graph_routes.py` and `evidence_routes.claim_out()` | (review) | ANALYZED: `claim_out()` is in `graph_routes` and imported by `evidence_routes` — not a true duplicate | — | REJECTED |

---

## Dead Code Items

| ID | Description | Location | Usage check | Decision | Status |
|---|---|---|---|---|---|
| DEAD-001 | `services/extract.py` (4-line stub) | `apps/api/app/services/extract.py` | Callers import `validate_upload` and `detect_record_type` through it; removing it requires updating 2 import sites | Keep as public API surface for extraction subsystem; add docstring | DEFERRED |
| DEAD-002 | `config.py` module-level `validate_production_secrets()` | Line 124 of `config.py` | Called at import time — complicates testing | Migrate to explicit `configure()` call in next major config refactor | DEFERRED |

---

## Obsolete Items

| ID | Description | Location | Verification | Decision | Status |
|---|---|---|---|---|---|
| OBS-001 | `force_scan_outcome` references in scripts | `scripts/dry_run.py`, `docs/contracts.md` | P1-10 from task board — was a fake scanner capability removed but references remain | Remove references | IDENTIFIED |
| OBS-002 | `# trigger rebuild` comment at end of `main.py` | `apps/api/app/main.py` line 115 | Appears to be a stale development comment | Remove on next main.py touch | IDENTIFIED |

---

## Dependency Cleanup

| Package | Side | Finding | Decision | Status |
|---|---|---|---|---|
| `paddlepaddle` / `paddleocr` | Python runtime | Optional OCR dependency; large binary; needs separate install | Keep as opt-in; already in `requirements-optional.txt` | DEFERRED — needs owner decision on image size |
| `transformers` / `torch` | Python runtime | Optional NER; very large | Keep as opt-in; `DRISHTI_NER_OFFLINE=1` can use cached model | DEFERRED — needs owner decision on image size |
| `confluent-kafka` | Python runtime | Optional Kafka client | Keep — Kafka is an architecture target | DEFERRED |
| `oxlint` | JS dev | Frontend linter already present | Verify it's configured; add to CI | IDENTIFIED |
| `@types/react-router-dom` missing | JS dev | react-router-dom used but no @types package | Check if @types are bundled in react-router-dom v6 | ANALYZED — bundled, no separate @types needed |

---

*Update this register whenever code is removed, found to be dead, or consolidated.*
