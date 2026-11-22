# Frontend regression report

**Date:** 2026-11-04 · **Compared:** `817bfd0` (before) and `e3abc24` (redesign)

| Check | Command | Before | After |
|---|---|---|---|
| TypeScript | `npx tsc -b --noEmit` (in `apps/web`) | 0 errors | 0 errors (`strict` is still off: FE-018) |
| Lint | `npx oxlint` | 117 warnings, 0 errors | 85 warnings, 0 errors |
| Production build | `npx vite build --outDir <tmp>` | builds | builds (JS 791 kB / 221 kB gzip; the >500 kB chunk warning existed before) |
| Backend suite | `make test` | 185 passed, 6 skipped | **187 passed**, 6 skipped (+2: `test_case_people.py`) |
| Browser E2E | `pytest tests/e2e` against the isolated build | 6 tests | **11 passed** (6 new or extended; see the browser test report) |
| Accessibility (axe-core, 14 pages) | `tests/ui-evaluation/axe_scan.py` | 572 failing elements | **0** |
| Route sweep, 3 viewports | `tests/ui-evaluation/capture_routes.py` | 5 failed requests on load; 0 overflow | 1 (the intended denial); 0 overflow |
| Frontend size | lines of `.ts`/`.tsx` in `apps/web/src` | 13,241 | 11,040 |

## Workflows re-verified after the change
| Workflow | Verified by |
|---|---|
| Authentication, sign-out, expired session | E2E login helper (every test); `test_expired_session_returns_to_the_same_page` |
| Case access and denial | `test_denial_for_unassigned_user`; backend `test_security.py` (unchanged, passing) |
| Evidence list, upload panel, scan-gate statuses | `test_evidence_and_scan_gate` |
| Evidence download (bytes = recorded SHA-256; role gate; reason) | `test_evidence_download_saves_exact_bytes` |
| Integrity verification, claims, exact source line | `test_evidence_details_verify_and_claim_source` |
| Review: decide, reverse, reject, defer; read-only role | `test_review_queue`, `test_review_is_read_only_for_analyst` |
| Graph: every element drawn; edge → claims → exact PDF line | `test_graph_edge_to_source` (assertions unchanged) |
| Timeline, reports (JSON download) | `test_timeline_analysis_report` |
| Audit: global log role gate | `test_global_audit_denied_without_request` |
| Old URLs, unknown URLs | `test_old_urls_redirect_and_unknown_urls_say_so` |

## API contract
- **No frontend call changed method or path.** The review module now calls `GET /cases/{id}/candidates`,
  `GET /candidates/{id}` and `POST /candidates/{id}/decision` directly, with the same bodies as before, and
  adds `REVERSE`, which the schema already allowed.
- **Newly used, already existing endpoints:**
  - `GET /evidence/{id}/verify`
  - `GET /evidence/{id}/claims`
  - `POST /evidence/{id}/process` (Reprocess)
- **Backend change (additive):** `case_out` adds `people[]`, the display name, role and purpose of each assigned
  user. It is visible only to users who may open the case, and is tested for exact fields and a 403 for outsiders.
- **Config:** `DRISHTI_WEB_DIST` (optional; the default is unchanged).

## Not run in this pass
- `make e2e` against the live demo: the live demo still serves the previous build. **Deploying the new build there is an owner decision.**
- The Compose stack (nginx → api) with the new build.
- Browsers other than Chromium.
