# Frontend: known limitations after the redesign

## Not deployed
The live demo (127.0.0.1:8000 behind nginx) still serves the **previous** build from `apps/web/dist`. The redesign was
built and tested only in isolated test directories. To deploy, run `make build-web`, check the demo, and keep the
previous `dist` as a rollback copy. This is an owner decision because it changes what demo users see.

## Open defects (see `FRONTEND_DEFECT_REGISTER.md`)
- **FE-010:** the login page prints a demo username and password. This is acceptable for the synthetic demo by
  convention (CLAUDE.md §6). It must be removed before any exposure beyond the demo.
- **FE-016:** possible graph mixing when a mounted graph page changes case (latent).
- **FE-018:** TypeScript `strict` is off; about 80 `any` remain.
- **FE-030:** audit "open in context" links.
- **FE-033:** entity drawer "Links" rows look clickable but do nothing.
- **FE-034:** the "Conflicting only" graph filter has no control.
- **FE-044:** client-side masking hard-codes demo names. The server's masking is authoritative.
- **FE-045 – FE-048:** graph filter details.
- **FE-056:** `window.__graph`, `__sigma` and `__graphStore` test hooks ship in production builds.
- **FE-058:** temporal slider edge cases. The slider also labels times "IST" while the rest of the UI shows recorded times without a zone.

## Functional gaps (not built)
- **No case creation or assignment UI.** `POST /cases` and `POST /cases/{id}/assign` exist; the old UI had no screen for them either.
- **No user administration.** No backend exists beyond `GET /users`.
- **No first decision on a contradictory *claim*.** The Decisions tab can only revise claims that already have a review.
  A "decide this contradiction" control on the Overview's contradiction list is the natural next step.
- **No server-side search, paging or filtering.** The cases list, evidence list and review queue load the full authorized list
  and filter it in the browser. That is honest for the demo's sizes; it won't scale beyond a few thousand rows.
  The UI says "Search your N cases" so it never appears to search more than it has.
- **Names outside the case.** Actors outside the case (for example an auditor or admin in the audit log) still show as user IDs.
  Only case members are resolved, via the additive `people` field.
- **Graph accessibility.** The canvas can't be used with a keyboard or screen reader, and there is no tabular graph view.

## Evaluation limits
- The usability comparison is a scripted engineering measurement. No officers took part.
- The accessibility result (0 axe violations on 14 pages) is automated only. No screen-reader or zoom audit was done.
  It is not a WCAG conformance claim.
- Only headless Chromium was tested.
