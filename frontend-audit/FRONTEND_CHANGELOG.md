# Frontend changelog

## 2026-11-04: officer-centred redesign (commit `e3abc24`)

### Navigation
- **Added:**
  - one case layout for every case page;
  - a breadcrumb;
  - a single tab row: Overview, Evidence, Review queue (with count), Relationship graph, Timeline, Locations, Patterns, Decisions, Reports, Audit log.
- **Changed:**
  - sidebar is now Home, Cases, Audit log (auditor/admin only) and Account;
  - below 1024 px it becomes an overlay drawer.
- **Redirects:**
  - `/cases/:id/hitl[/:task]` → `/review[/:task]`
  - `/map` → `/locations`
  - `/reviews` → `/decisions`
  - `/report` → `/reports`
  - `/overview` and `/notes` → the case root
  - `/settings` → `/profile`
  - `/home` → `/command-center`
- **Added:** a "Page not found" page for unknown URLs. They used to land silently on the dashboard.

### Pages
- **Home:** "Waiting for review" per case; a case table. Removed "SYSTEM ONLINE".
- **Cases:** sortable table; search over the complete authorized list; "only cases awaiting review" filter.
- **Overview:**
  - people by name, evidence by status and review counts;
  - contradictions with entity, attribute, value and an "Open source" button;
  - recent decisions with reviewer names, and integrity anchors (by role).
  - Removed: the right info panel, the module button row and the fabricated footer.
- **Evidence:**
  - a table with status filter and search, and a labelled upload showing the real outcome;
  - a detail drawer with Verify integrity, processing jobs and extracted claims that open their exact line;
  - Reprocess for held items;
  - the download reason is asked in an accessible dialog.
- **Review queue:**
  - filters (Needs review / Deferred / Decided / All);
  - side-by-side record comparison;
  - Approve / Reject / **Defer** (was mislabelled "Escalate") and **Reverse decision** (new);
  - decision history with names.
- **Relationship graph:**
  - stays inside the case layout;
  - real ForceAtlas2 layout;
  - honest legend;
  - a notice when the graph is truncated or stale;
  - selection arriving from the timeline.
  - Removed: Share, Export and the emoji legend.
- **Timeline:** honest description; entities by label; "Missing in the source" shown as text; inclusive date filter.
- **Patterns, Locations, Decisions, Audit log:** shared headers; no invented fields ("stability", "LIVE", "Sequence Linked"); escaped CSV export.
- **Reports:** inside the case; says what each export contains and that neither is a legal certificate; disabled with a reason for roles the server refuses.
- **Account:** replaces Profile and Settings; lists what the role allows.

### Behaviour and security
- Expired session: sign in again and return to the same page; the return path is limited to same-app paths.
- Global audit no longer requests before its role check.
- Review statistics are requested only by roles allowed to read them.
- Reveal: values are now shown (expiry bug), "Hide value again" re-masks, and the fake clearance selector is removed.
- Accessibility: axe-core violations went from 572 elements to 0 on 14 pages. Contrast tokens, names and labels fixed; skip link and landmarks added.

### Backend (additive)
- `GET /cases`, `GET /cases/{id}` and assignment responses include `people[]`.
- `DRISHTI_WEB_DIST` lets a test server serve a separate build.
