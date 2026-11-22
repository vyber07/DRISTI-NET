# Frontend redesign: implementation report (constitution §20)

**Date:** 2026-11-04 · **Commits:** `e3abc24` (code and tests), followed by the documentation commit · **Branch:** local `main`, not pushed

## Files read
- **Project rules:** CLAUDE.md; docs/context.md §1–6, §8.2, §12 (Role 2), §15.5, §16–20; docs/status.md; docs/FRONTEND_ARCHITECTURE.md and FRONTEND_API_MAP.md (both stale).
- **Frontend:** every file under `apps/web/src`: 115 files, 13,572 lines. Line coverage is recorded in `FRONTEND_SOURCE_INVENTORY.md` (audit agent); the lead read the router, shells, case, evidence, review, graph, timeline, reports, audit, profile and settings pages in full.
- **Backend:** routes (all 41 `/api/v1` handlers and their `require_roles`), `case_out`, `evidence_out`, `candidate_out`, `claim_out`, schemas and models (states).

## Audit and design deliverables
| Document | Where |
|---|---|
| Source inventory, page inventory, navigation map, interaction register (223 rows), data dictionary, API mapping, defect register (60 defects plus status after the redesign) | `frontend-audit/` |
| Information architecture, design system, officer workflow map, page-by-page spec, component catalogue | `frontend-design/` |
| Browser test, regression, accessibility, responsive and usability reports; changelog; known limitations; continuation state | `frontend-audit/` |
| Before/after screenshots (57 / 70) with capture logs | `frontend-audit/screenshots/` |
| Reproducible evaluation scripts | `tests/ui-evaluation/` |

The interaction register and source inventory were produced by two parallel audit agents, as the brief allowed. The lead
reconciled them: one agent claim was disproved against the live payload (`touches_communities` *is* sent); the other findings
were checked in code before they were fixed.

## Files changed (commit `e3abc24`)
- **New:**
  - `lib/permissions.ts`
  - `components/layout/page.tsx`
  - `components/ui/{status-badge,reason-dialog}.tsx`
  - `features/cases/{case-layout,case-context,case-table}.tsx`
  - `features/cases/evidence/{evidence-detail-drawer.tsx,evidence-format.ts}`
  - `features/review/{review-page,source-pane}.tsx` and `review-api.ts`
  - `features/not-found/not-found-page.tsx`
  - `apps/api/app/tests/test_case_people.py`
- **Rewritten:**
  - router, app shell, sidebar, top bar;
  - Home, Cases, Overview, Evidence, Graph tab, Decisions, Reports, Account, source viewer, empty graph drawer, graph legend.
- **Edited:**
  - timeline (copy, labels, missing data, date filter, graph link), Locations, Patterns, audit header/card/filter;
  - global audit gate, login (return path, expired notice, footer), reveal modal and store;
  - graph engine (multigraph, ForceAtlas2, exported colours), graph store and API (bounds), toolbar and filter wording;
  - auth store (expired logout, restore), API client (401), tokens (contrast), dialog sizing.
- **Removed (20 files, no importers left):**
  - the old HITL page, store, API and types;
  - the evidence card, row, filter bar and store;
  - the case workspace and its header, sidebar, placeholder and stats grid;
  - `InvestigationShell`, Settings and the foundation preview.
- **Backend:**
  - `routes/case_routes.py`: additive `people`;
  - `config.py`: `DRISHTI_WEB_DIST`.
- **Tests:** `tests/e2e/test_ui_demo.py` was updated, with 6 tests new or extended.

## Contract decisions
1. **Names, not IDs.** The case response adds `people[]` (assigned users only: id, display name, role, purpose, owner flag).
   I chose this over opening `GET /users` to more roles: it exposes nothing a case member couldn't already see by ID.
2. **Role hints mirror the backend** (`lib/permissions.ts`). They are a convenience only, and every write is still authorized server-side.
3. **"Escalate" became "Defer".** The button sent `DEFER`, and no escalation exists in the backend.
4. **Reverse is offered** because the backend's `REVERSE` existed and the constitution requires reversible decisions.
5. **Reveal display window: 5 minutes, in browser memory.** The server records no expiry, and a full reload on sign-out clears it.
6. **Search stays client-side** over the complete authorized list. This is stated in the UI. Server-side search is roadmap.

## Tests run and results
| | Result |
|---|---|
| `make test` (backend) | 187 passed, 6 skipped |
| E2E (`tests/e2e`, Chromium, isolated build) | 11 passed, twice in a row |
| `tsc -b --noEmit` | 0 errors |
| `oxlint` | 0 errors, 85 warnings (was 117) |
| axe-core, 14 pages | 0 violations (was 572 elements) |
| Route sweep, 3 viewports, 7 roles | 0 horizontal overflow; 1 failed request (the intended denial) |
| Scripted task comparison | 4 tasks newly possible, 1 shorter (4 → 2 clicks), 2 unchanged |

## Demonstrated behaviour
Everything in the browser test report's tables, in a real browser against a real API with ClamAV and the real NER model, on synthetic data.

## Remaining targets and limitations
See `FRONTEND_KNOWN_LIMITATIONS.md`. In short:
- the live demo still serves the old build (deploying is the owner's decision);
- 13 audit defects remain open;
- there is no case creation or assignment UI;
- there is no server-side search;
- the graph is not keyboard-accessible;
- no real user or accessibility audit has been done.

## Language and safety
- Neutral wording was applied throughout: candidate, possible, review priority, integrity reference.
- Removed: "verified" claims, legal-process placeholders (BNSS §91), "Classified Cases", "clue" wording, and blockchain-style "blocks / sequence linked".
- The integrity PDF is described as "not a legal certificate and does not establish admissibility".

## Next step
1. The owner decides whether to deploy: `make build-web` replaces the live demo's `dist`; back up the old `apps/web/dist` first.
2. Then run `make e2e` against the demo through nginx.
