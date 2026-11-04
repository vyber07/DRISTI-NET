# Existing navigation map

Audited read-only against commit `817bfd0` and the working tree as it stood at the start of the audit. Page IDs (P-xx, O-xx) refer to `FRONTEND_PAGE_INVENTORY.md`.

## 1. Global chrome (every authenticated route, via `AppShell`)

### 1.1 Sidebar (`layouts/AppShell/sidebar.tsx`, `constants/navigation.ts`)
| Section | Item | Target | Visibility |
|---|---|---|---|
| Investigation | Dashboard | `/command-center` | all |
| Investigation | Case Directory | `/cases` | all |
| System | Audit Trail | `/audit` | `roles: ["AUDITOR","ADMIN"]` (client filter; the backend also enforces it) |
| footer | Profile button (avatar, display name, role) | `/profile` | all |
| footer | Collapse Menu | toggles `uiStore.sidebarCollapsed` (not persisted) | all |

There is no sidebar entry for Settings, Reports, the review queue or any case. The sidebar never shows the current case. NavLink active styling works only for the three top-level paths; inside `/cases/:id/*`, "Case Directory" is highlighted because NavLink matches by prefix.

### 1.2 Security status bar (`components/security/security-status-bar.tsx`)
- Shows: display name and role, the role again, jurisdiction, and a PII label ("PII MASKED (STRICT)" or "PII REVEALED", from the client-side `authStore.piiMasked`).
- Bell (Notifications): **dead**, no handler.
- Lock: `logout()` → a full reload to `/login`.

## 2. Case-level navigation

### 2.1 Case left-nav, workspace variant (`case-workspace-page.tsx` `CASE_NAV_TABS`, 9 items)
Used by P-05/06/08/09/10/11/12/13/14/15.

| Label | id | Mechanism | Target | Stays in case layout? |
|---|---|---|---|---|
| Case Overview | overview | `navigate` | `/cases/:id/overview` | yes |
| Investigation Map | graph | `<Link>` (`isRoute`) | `/cases/:id/graph` | yes, but the graph page has its own shell and a 5-item nav. Never highlighted as active. |
| Location Map | map | `navigate` | `/cases/:id/map` | yes |
| Evidence & Records | evidence | `navigate` | `/cases/:id/evidence` | yes |
| Event Timeline | timeline | `navigate` | `/cases/:id/timeline` | yes |
| Graph Analysis | analysis | `navigate` | `/cases/:id/analysis` | yes |
| Analyst Review | hitl | `navigate` | `/cases/:id/hitl` | **no**: HITL has its own full-page chrome |
| Decisions | reviews | `navigate` | `/cases/:id/reviews` | yes |
| Audit Trail | audit | `navigate` | `/cases/:id/audit` | yes |

Items are `<button>`s, not links (except Graph), so they can't be middle-clicked or opened in a new tab, and they don't show a URL. Reports is **not** in the left-nav; it is reachable only from the header button.  Every tab is a separate route entry with its own `<CaseWorkspacePage/>` element; React Router normally reuses the instance (the case fetch keys on `caseId`), but this was not verified at runtime.

### 2.2 Case left-nav, graph variant (`case-graph-page.tsx` `CASE_NAV_ITEMS`, 5 items)
Case Overview → `/cases/:id` · Investigation Map (active) · Evidence & Records · Event Timeline · Audit Trail.
**Missing:** Location Map, Graph Analysis, Analyst Review, Decisions. These are real `<Link>`s, unlike the workspace variant.

### 2.3 Case header (`components/case-header.tsx`, workspace pages)
| Control | Target |
|---|---|
| ← Home | `/command-center` (**not** `/cases`) |
| `CASE-ID — title` + "Active Investigation" badge (hard-coded) | none |
| Investigation Map (primary button, hidden on the graph tab) | `/cases/:id/graph` |
| Export Reports | `/cases/:id/reports` (leaves the case layout) |

### 2.4 Graph page header (`case-graph-page.tsx`)
← Home → `/command-center` · `CASE-ID — "Case"` · "INVESTIGATION MAP" badge · counts · **Case Overview** → `/cases/:id` · Hide/Show Panel · **Share** (dead) · **Export** (permanently restricted, no target).

### 2.5 HITL header (`hitl-workspace-page.tsx`)
- Queue view: Graph View → `/cases/:id/graph` · Case Overview → `/cases/:id` · Refresh.
- Task view: **Back to Queue** → `/cases/:id/hitl` · Refresh.
- No case left-nav, no case title, no Reports, no link to the evidence page.

### 2.6 Reports page (`reports-page.tsx`)
No header navigation at all. The only way out is the sidebar or the browser's Back button.

## 3. Contextual (in-content) links

| From | Control | To |
|---|---|---|
| Dashboard case card | Open Workspace | `/cases/:id` |
| Dashboard case card | Graph | `/cases/:id/graph` |
| Dashboard | View all N cases (only when more than 6) | `/cases` |
| Dashboard quick actions | Case Directory / Review Queue (REV/INV/ADMIN) / Global Audit (AUD/ADMIN) / My Profile | `/cases`, `/cases/{cases[0]}/hitl` (**first case, arbitrary**), `/audit`, `/profile` |
| Directory case card | Graph / Open Case Workspace | `/cases/:id/graph`, `/cases/:id` |
| Overview "Investigation Modules" | Evidence / Graph / Map / Analysis | `/cases/:id/{evidence,graph,map,analysis}` (**repeats the left-nav**) |
| Timeline row | View source | opens O-02 at the claim's locator (after a `GET /claims/{id}`) |
| Timeline row | View in graph | `selectNode()` then `/cases/:id/graph`. The selection is lost because `loadGraph` clears it. |
| Timeline row | entity chip (`ENT-…`) | in-page scope (re-fetches with `entity_id`) |
| Evidence card/row | Inspect | O-02 (no locator, so it opens at line 1) |
| Evidence card/row | Download | `window.prompt`, then POST download |
| Graph edge drawer | Open source at page/line/row | O-02 at the locator |
| Graph entity drawer | Links rows | **no handler** |
| Graph entity drawer | Reveal (masked kinds) | O-01 |
| HITL queue | task card | `/cases/:id/hitl/:taskId` |
| HITL evidence pane | Full inspector | O-02 |
| Audit event card | target link | ENTITY → `/cases/:case/graph?entityId=` (param ignored) · EVIDENCE → `/cases/:case/evidence?evidenceId=` (param ignored) · NOTE → `/cases/:case/notes?targetId=` (dead route) · GRAPH/RELATIONSHIP → `/cases/:case/graph` |
| Profile | Workstation Settings | `/settings` (the only way to reach Settings) |
| Profile | Logout | `/login` |
| Case reviews, overview recent reviews and contradictions | `target_id` / `claim_id` | **not links** |
| Analysis entities, map locations | labels | **not links** |
| Global audit rows | case_id, target | **not links** |

## 4. Breadcrumbs and back paths
- **No breadcrumbs anywhere.** `InvestigationShell`'s header comment says one was planned.
- "Home" on the case and graph headers always goes to the dashboard. No "back to Case Directory".
- HITL task → "Back to Queue". The queue → Case Overview.
- Reports, Settings, Profile and Global audit have no in-page back control.
- Login always lands on `/`. `ProtectedRoute` saves `state.from`, but `LoginPage` ignores it, so deep links are lost after a session expires.
- Unknown URLs → `/command-center` silently (P-23).

## 5. Flowchart

```mermaid
flowchart LR
  login["/login"] -->|success: always "/"| root["/ (redirect)"]
  root --> dash["/command-center<br/>Dashboard"]
  any["* (unknown URL)"] -.silent redirect.-> dash

  subgraph Sidebar
    sbDash[Dashboard] --> dash
    sbDir[Case Directory] --> dir["/cases<br/>Directory"]
    sbAudit["Audit Trail<br/>(AUDITOR/ADMIN)"] --> gaudit["/audit<br/>Global audit"]
    sbProf[Profile button] --> prof["/profile"]
  end
  prof --> settings["/settings"]

  dash -->|Open Workspace| ov
  dash -->|Graph| graph
  dash -->|Review Queue = cases[0]| hitl
  dash --> gaudit
  dir -->|Open Case Workspace| ov
  dir -->|Graph| graph

  subgraph CaseWorkspace["Case workspace (InvestigationShell, 9-item nav)"]
    ov["/cases/:id<br/>= /overview"]
    ev["/evidence"]
    tl["/timeline"]
    map["/map"]
    an["/analysis"]
    rv["/reviews (Decisions)"]
    au["/audit (case)"]
    notes["/notes → renders Overview"]
    ph["?tab=x → placeholder"]
  end

  subgraph GraphPage["Graph page (own 5-item nav)"]
    graph["/cases/:id/graph"]
  end

  subgraph HITL["HITL (own chrome, no case nav)"]
    hitl["/cases/:id/hitl"] --> task["/hitl/:taskId"]
    task -->|Back to Queue| hitl
  end

  rep["/cases/:id/reports<br/>= /report<br/>(no chrome)"]

  ov <--> ev & tl & map & an & rv & au
  ov -->|nav, header, modules| graph
  ov -->|Analyst Review| hitl
  ov -->|header: Export Reports| rep
  graph -->|5-item nav| ov & ev & tl & au
  hitl -->|Graph View| graph
  hitl -->|Case Overview| ov
  au -.NOTE link.-> notes
  au -.ENTITY link ?entityId ignored.-> graph
  tl -.View in graph: selection lost.-> graph
  ov & graph -->|Home| dash

  ev -.Inspect.-> prov[[Provenance viewer]]
  tl -.View source.-> prov
  graph -.edge drawer.-> prov
  task -.full inspector.-> prov
  graph -.entity drawer reveal.-> reveal[[Reveal identity modal]]
  task -.Submit.-> dlg[[HITL decision dialog]]
  au -.card.-> adrawer[[Audit detail drawer]]
```

## 6. Navigation problems (ranked)

1. **Three different case chromes.** The workspace has a 9-item nav and info panel. The graph has a 5-item nav, no title, and its drawer covers the top bar. HITL and Reports have no case nav at all. Users lose their place and the "way back" changes from page to page.
2. **Duplicate entry points to the same view.** Graph is reachable from the left-nav, the header "Investigation Map" button, the Overview "Investigation Modules", the dashboard card and the directory card. Evidence, Map and Analysis also appear in both the left-nav and Modules.
3. **Confusing names.** "Investigation Map" (graph) vs "Location Map" (map) vs "Graph Analysis". "Analyst Review" (the identity-candidate queue, which analysts **cannot decide on**) vs "Decisions" (review history). "Audit Trail" is used for both the case audit and the global audit.
4. **Duplicate and dead routes:** `/overview`, `/report`, `/notes`, `?tab=`. Audit deep-link query parameters are ignored.
5. **Reports is not in the case nav**, and the Reports page strands the user.
6. **No breadcrumb.** "Home" skips the directory. Login loses the deep link. Unknown URLs redirect silently.
7. **Tabs are buttons, not links** in the workspace nav (no URLs on hover, no new tab).
8. **The "Review Queue" quick link** goes to whichever case happens to be first. There is no cross-case review queue (none exists in the backend either; queues are per case).
9. **Role-blind navigation.** Analyst, officer and auditor see "Analyst Review", "Create Anchor", "Export Reports" and "Upload", all of which end in a 403. Only the sidebar "Audit Trail" is role-filtered.
10. **Timeline "View in graph"** doesn't select the entity, and the EntityDrawer "Links" rows go nowhere. Graph → evidence and map → graph links don't exist.
11. **Settings** is reachable only from Profile. The Profile menu has four dead items.
