# Frontend browser test report

**Date:** 2026-11-04 · **Code:** commit `e3abc24` (redesign) against `817bfd0` (before)
**Browser:** Playwright 1.x, headless Chromium · **Data:** synthetic seed (`python -m apps.api.app.seed --ingest`), real ClamAV and real NER
**Servers (isolated, never the live demo):**
- 127.0.0.1:8001 served the previous build;
- 127.0.0.1:8002 served the redesign (`DRISHTI_WEB_DIST` pointed at a build in a temporary directory);
- both used the same disposable SQLite database and a random secret key.

The live demo's `apps/web/dist` was not rebuilt.

## 1. End-to-end suite (`tests/e2e/test_ui_demo.py`): 11 / 11 passed

Run twice in a row (the second run starts from the first run's decisions): 11 passed both times, 13–14 s each.

| Test | What it proves | New? |
|---|---|---|
| `test_denial_for_unassigned_user` | An unassigned investigator sees the denied state with the server's reason and no case header, on Overview and on Graph. The old test asserted nothing. | assertion new |
| `test_evidence_and_scan_gate` | The evidence table renders statuses with their raw codes; the upload panel is shown to an evidence officer | updated |
| `test_evidence_download_saves_exact_bytes` | DEF-029/101 as before: disabled for the officer; for the investigator, a reason under 5 characters is refused inside the dialog; the downloaded bytes' SHA-256 equals the server's reference | updated |
| `test_evidence_details_verify_and_claim_source` | The drawer shows the 64-hex SHA-256; **Verify integrity** reports a match; an extracted claim opens the source viewer with a highlighted line | **new** |
| `test_review_queue` | No fabricated content (old list plus STAGE 4, CONFIDENTIAL, Supervisory Officer); side-by-side comparison; real cited files; approve, **reverse**, re-approve; reject the 3-conflict pair; defer Tanvi Bhatt; the Deferred and Decided filters list them | updated + reverse new |
| `test_review_is_read_only_for_analyst` | An analyst sees no decision buttons, and the reason is shown | **new** |
| `test_graph_edge_to_source` | Unchanged assertions: every node and edge drawn; a `USES_PHONE` edge carries its evidence id; claims have locators; the PDF claim opens at page 1 / line 11 | unchanged |
| `test_timeline_analysis_report` | No "verified events" or "Jaipur, Mumbai, and Dubai" text; entity chips carry no `ENT-` IDs; `/report` redirects to `/reports`; JSON report downloads; the audit-log notice is shown | updated |
| `test_old_urls_redirect_and_unknown_urls_say_so` | 7 old URLs land on their new routes; `/no-such-page` shows "not found" without redirecting | **new** |
| `test_global_audit_denied_without_request` | An investigator gets the denied state and **no** `/api/v1/audit` request is sent; an auditor sees the log | **new** |
| `test_expired_session_returns_to_the_same_page` | A forged token leads to `/login?expired=1&next=…`, which shows a notice; signing in returns to `/cases/CASE-0001/evidence` | **new** |

## 2. Route sweep (`tests/ui-evaluation/capture_routes.py`)

Every route, per role and viewport, records console errors, failed requests, the final URL after redirects and horizontal overflow. Screenshots are in `screenshots/before/` and `screenshots/after/`, logged in each folder's `capture_log.json`.

| | Before (8001) | After (8002) |
|---|---|---|
| Captures | 56 (5 roles; 3 viewports) | 61 (7 roles; 3 viewports) |
| Failed API requests (403) | 5 | 1 (see note) |
| Silent redirects of unknown URLs to the dashboard | 4 (`/home`, `/review`, `/reports`, `/evidence`) | 0: `/no-such-page` shows "Page not found"; old URLs redirect to their new routes on purpose |
| Pages with horizontal overflow | 0 | 0 |

The 403s before were:
- `/audit?limit=500` for an investigator, at 3 viewports: the request was sent before the page's own role check;
- `/cases/CASE-0001/stats` for an auditor;
- `/cases/CASE-0001` for an unassigned user.

The only 403 left after is the unassigned user's case request. That denial is expected: the UI shows it as the denied state.

**Console warnings:** WebGL "GPU stall due to ReadPixels" messages on the graph page come from the headless GL driver, not the app. They appear in both builds.

## 3. Interaction checks

| Check | Result |
|---|---|
| Graph drawer stays inside the graph area (top bar visible) | Pass. Screenshot `after/desktop_investigator_cases_CASE-0001_graph.png`; before, it covered the Lock / PII controls |
| Timeline "Show in graph" selects the entity | Pass. `x_tablet_graph_entity.png` (`?entity=` link) |
| Evidence drawer: Verify integrity, jobs table, claims, Source | Pass. `x_evidence_drawer.png`, `x_source_viewer.png`, plus the E2E test above |
| Reason dialog: Escape closes; short reason refused; focus in the textarea | Pass (E2E plus `x_review_reason_dialog.png`) |
| Phone navigation drawer opens and closes | Pass. `x_phone_nav_open.png` |
| Upload with a real file | Not repeated in this pass. The upload API path is covered by backend tests; the new UI uses the shared API client (FE-025) |

## 4. Not tested
- Firefox and WebKit: only Chromium was run.
- Real screen readers: the automated axe scan is not a substitute.
- Human officers: see `FRONTEND_USABILITY_COMPARISON.md`.
- The full Compose stack through nginx with the new build. The redesign changes no API contract apart from the additive `people` field.

## 5. Cross-browser run (added 2026-11-04, commit `fa3e0bc`)
`DRISHTI_E2E_BROWSER=chromium|firefox|webkit`, against an isolated build made with `make build-web-e2e`:

| Browser (Playwright build) | Result |
|---|---|
| Chromium | 15 / 15 passed |
| Firefox | 15 / 15 passed |
| WebKit (Safari's engine) | 15 / 15 passed |

The four new tests cover: create a case and assign a person; server-side search and paging (admin, more than one page); the graph list view by keyboard only; and the audit → evidence deep link.

**Found by this run and fixed:**
- **Firefox (headless, no WebGL):** opening the graph crashed the whole app into React Router's raw error screen, *with a JavaScript stack trace*. Now the graph tab detects missing WebGL and shows the list view with a notice. An error boundary contains other renderer failures, and an app-wide error page shows no technical details. On Firefox the E2E asserts the fallback and still traces an edge to its exact PDF line.
- **WebKit:** three failures came from the test's sign-in helper, which cleared browser storage while the app was starting. That raced the app's own session check, which then correctly redirected to sign-in. The helper now clears storage from the login page. This was a harness defect, not an app defect.

**Not covered:** real Safari on macOS or iOS (WebKit on Linux is the engine, not Safari itself), Edge (Chromium-based), and a GPU-backed Firefox on which the canvas itself is drawn.
