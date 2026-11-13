# Frontend defect register — apps/web/src

**Baseline:** git `HEAD` `817bfd0` (what the live demo's `dist` was built from). Line numbers are HEAD line numbers.
The working tree was being redesigned while this was written; some items may already be fixed there — re-check before closing.
**Method:** code reading only (plus one `tailwind-merge` check in Node and backend route/schema reads to confirm contracts).
Every item quotes the code. Nothing is browser-verified; items marked *latent* need a data/browser check.

Severity: **P0** blocks a core flow or makes a safety/legal claim that is false · **P1** major functional break, false
status, or §16 wording violation on a primary screen · **P2** significant UX / accessibility / consistency / robustness ·
**P3** minor.

There are no P0 items: no code path was found that leaks unmasked data or bypasses a server check (the server enforces
every role and reason requirement read in `apps/api/app/routes/*` and `schemas.py`).

## Summary

| Severity | Count |
| --- | ---: |
| P1 | 14 |
| P2 | 30 |
| P3 | 16 |
| **Total** | **60** |

---

## Status after the redesign (commits e3abc24 and e61188e/fa3e0bc, 2026-11-04)

The findings below were made by reading the code at `817bfd0`, before the redesign. This table records what happened to each.
**Fixed** means the code was changed and the fix was checked by a test, a scan or a screenshot (named under Evidence).
**Removed** means the faulty code is gone. **Open** means it was not addressed.

| ID | Status | Evidence / where |
|---|---|---|
| FE-001 graph drawers cover the top bar | Fixed | drawers fill an in-layout panel (`case-graph-page.tsx`); `after/desktop_investigator_cases_CASE-0001_graph.png` |
| FE-002 queue failure shown as "queue clear" | Fixed | review queue shows `ErrorState` with retry (`features/review/review-page.tsx`) |
| FE-003 reveal never shown (expiry = now) | Fixed | 5-minute browser display window (`revealApi.ts`); the server records no expiry |
| FE-004 "Escalate" recorded DEFER | Fixed | renamed to "Defer — needs more information"; E2E `test_review_queue` |
| FE-005 failed decision gives no feedback | Fixed | the reason dialog stays open with the server's message |
| FE-006 Organize does nothing on real data | Fixed | ForceAtlas2 from deterministic seeds, run on load and on Organize (`GraphEngine.organizeMap`) |
| FE-007 "verified" claims in legend and timeline | Fixed | wording replaced; E2E asserts the timeline text is gone |
| FE-008 legend colours differ from graph | Fixed | legend imports the engine's `ENTITY_COLORS` |
| FE-009 profile PII switch | Removed | Account page has no such control |
| FE-010 demo credentials on the login page | Fixed (owner asked, 2026-11-04) | password no longer printed; demo accounts documented in the README only (`e61188e`) |
| FE-011 reveal modal: fake clearance, broken officer line, no-op Revoke, legal claims | Fixed | clearance tiles and BNSS badge removed; "Hide value again" re-masks (`revealStore.remask`) |
| FE-012 / FE-013 Settings fake success; no-op profile cards | Removed | `/settings` redirects to Account |
| FE-014 audit "blocks / sequence linked" | Fixed | wording now "events"; "Sequence Linked" and "LIVE" removed |
| FE-015 non-multi graph crash (latent) | Fixed | `new Graph({ multi: true })`; the current data has no duplicate pairs, so it is not exercised by a test |
| FE-016 engine mixes cases on route change (latent) | Fixed | canvas keyed by case; `applyDelta` no longer reads the never-set `maskedLabel` (`e61188e`) |
| FE-017 undefined `teal-primary` token | Fixed | token defined in `index.css` |
| FE-018 TypeScript `strict` off | Not a defect | TypeScript 6 enables `strict` by default (TS7006 implicit-any errors fire); `"strict": true` now explicit; ~80 explicit `any` remain as code-quality debt |
| FE-019 no 401 handling | Fixed | `real_client.ts` + `authStore.logout({expired})`; E2E `test_expired_session_returns_to_the_same_page` |
| FE-020 login ignores destination | Fixed | same E2E (same-app paths only) |
| FE-021 global audit request before role check | Fixed | E2E `test_global_audit_denied_without_request` (no request sent) |
| FE-022 swallowed errors | Fixed in rewritten pages | Home, Cases, Overview, Evidence, Review and Decisions show errors; two remaining silent catches are optional enrichments |
| FE-023 stats show 0 when forbidden | Fixed | stats requested only for roles that may read them; others see the case's pending count |
| FE-024 no UI role gating | Fixed for upload, download, reveal, decide, anchors, reports, global audit | `lib/permissions.ts` (mirrors `require_roles`); E2E analyst read-only |
| FE-025 / FE-026 raw fetch for upload and PDF | Fixed | shared API client (`uploadEvidence`, `generateCourtPdf`) |
| FE-027 CSV not escaped | Fixed | every field quoted; leading `= + - @` neutralised |
| FE-028 timeline end date excluded, zones mixed | Fixed | compares recorded YYYY-MM-DD strings, inclusive |
| FE-029 timeline → graph selection lost | Fixed | `?entity=` link; `x_tablet_graph_entity.png` |
| FE-030 audit "open in context" links | Fixed | entity → `graph?entity=`, evidence → `evidence?evidence=` (opens details), candidate → review page, claim → decisions; fake "Role: USER / IP" removed; E2E `test_audit_link_opens_the_evidence_details` |
| FE-031 graph header "Case", Share, Export | Fixed / Removed | graph sits under the case title; Share and Export removed (exports on Reports) |
| FE-032 cannot hide panel while selected | Fixed | panel state is independent of selection |
| FE-033 entity drawer "Links" rows have no handler | Fixed | rows open the relationship's sources and name the other entity |
| FE-034 "Conflicting … only" has no control | Removed | no edge carries a contradiction flag; contradictions are on the Overview |
| FE-035 bell; "Lock" is a logout | Fixed | bell removed; button says "Sign out" |
| FE-036 people as raw IDs | Fixed for case members | additive `people` field; actors outside the case (e.g. an auditor in the audit log) still show IDs |
| FE-037 statuses always blue | Fixed | `StatusBadge` maps every state to a label, icon and tone |
| FE-038 icon-only controls unnamed | Fixed on scanned pages | axe `button-name` 181 → 0 |
| FE-039 clickable non-buttons, hover-only actions | Partly | evidence hover-only actions removed; audit cards are still clickable divs (a keyboard-reachable button exists inside) |
| FE-040 labels not associated | Fixed on scanned pages | axe `label` / `select-name` → 0 |
| FE-041 custom dialogs lack semantics | Partly | reason, source viewer, evidence drawer and reveal use Radix; the audit detail drawer is still custom |
| FE-042 four case layouts | Fixed | one `CaseLayout` |
| FE-043 phones get only a notice | Fixed | phone captures of every case tab |
| FE-044 client masking hard-codes demo names | Fixed | names and account numbers removed (and the "suspect and victim" comment); server masking authoritative |
| FE-045 – FE-048 graph filter details | Fixed | "None" clears; last type can be unticked; real type counts; "nodes passing" from passing relationships; duplicate 2xl dropdown removed; filters reset per case |
| FE-049 reviews view errors and tone | Fixed | Decisions tab rewritten |
| FE-050 `window.prompt` for reasons | Fixed | `ReasonDialog` (none remain) |
| FE-051 reveal reason minimum, persistence | Fixed | at least 5 characters (matches the server); cleared on close |
| FE-052 HITL search reloads API per keystroke | Fixed | client-side filter of the loaded list |
| FE-053 resolved view shows decision as badge | Fixed | decision history shows reviewer name, decision and reason |
| FE-054 reason minimums differ from server | Partly | download and reveal = 5 (the server's); decisions need 10 in the UI and 3 on the server (stricter on purpose) |
| FE-055 `restoreSession` writes "undefined" | Fixed | `authStore.ts` |
| FE-056 test hooks exposed in production | Fixed | hooks only in `VITE_E2E_HOOKS=1` builds (`make build-web-e2e`); normal builds have none |
| FE-057 timestamp formatting inconsistent | Partly | new pages use `formatDate` / `formatDateTime`; the temporal slider still labels times "IST" |
| FE-058 temporal slider edge cases | Fixed | one zone-free time base (`recordedTimeMs`) for slider, filter and engine; no invented range; step never 0; "no dated relationships" note |
| FE-059 case workspace loading/error states | Fixed | `CaseLayout` loading, denied and error states |
| FE-060 unused code and dependencies | Partly | 20 files removed (old HITL, evidence card/row/filter, workspace, settings, foundation preview, investigation shell); unused npm packages still listed |

**Found after the audit and fixed (`fa3e0bc`):** FE-061 — without WebGL the graph crashed the whole app and showed a JavaScript stack trace (Firefox run); now a list-view fallback, an error boundary and a stack-trace-free error page. FE-062 — Chromium date input's calendar button had no visible focus (keyboard audit). FE-063 — every new case was dated 2025-01-01 and blank title/purpose/authority were accepted (backend schema).

**Counts (by defect ID, 60 IDs):** 50 fixed, 4 removed, 5 partly fixed, 1 not a defect, 0 open.

---

## P1

### FE-001 · P1 · Graph drawers escape their panel and cover the global top bar
`components/graph/drawers/EntityDrawer.tsx:38`, `EdgeDrawer.tsx:19`, `EmptyDrawer.tsx:11`, container `layouts/InvestigationShell/investigation-shell.tsx:74-80`
```tsx
className="absolute top-0 right-0 h-full w-[400px] … z-10"      // drawers
<div className={cn("border-l … overflow-y-auto …", … "w-[290px] xl:w-[300px] …")}>  // panel: no `relative`
```
No ancestor up to `AppShell` is positioned, so `absolute top-0 right-0 h-full` resolves against the viewport: the 400 px
drawer is pinned to the window's top-right, covering the security bar (Lock / PII status) and the toolbar search, and is
wider than its 290–300 px grid column. Matches screenshot finding #1.
**Fix:** render drawers as normal flow content (`h-full w-full`, no `absolute`), or add `relative` to the detail-panel div and drop the fixed width.

### FE-002 · P1 · Review-queue load failure is shown as "Arbitration Queue Clear"
`features/hitl/hitl-workspace-page.tsx:32-45, 220-230`; `stores/hitlStore.ts:79-81`
```ts
} catch (e: any) { set({ error: `Failed to load review tasks: …`, isLoading: false }); }   // store
const { tasks, activeTask, filter, stats, isLoading, … } = useHITLStore();                // page never reads `error`
) : tasks.length === 0 ? ( … <h3>Arbitration Queue Clear</h3>
```
A 403/500 on `/cases/{id}/candidates` empties `tasks` and the page tells the reviewer there is nothing to review.
**Fix:** read `error` and render an error/denied state before the empty state; same for `loadTaskById` errors.

### FE-003 · P1 · A successful reveal is never shown in the entity drawer (expiry = now)
`services/api/revealApi.ts:21`, `stores/revealStore.ts:108-122`, `components/graph/drawers/EntityDrawer.tsx:133-135`
```ts
expiresAt: new Date().toISOString(),                                         // revealApi
const isNotExpired = new Date(reveal.expiresAt).getTime() > Date.now();     // revealStore.isRevealed
isMasked={!isRevealed(entity.entity_id, "id")}                               // drawer
```
The stored reveal is already expired when the next render checks it, so `isRevealed` is always `false`,
`getRevealedValue` always `null`, and the drawer stays masked after an audited reveal (the value appears only once,
inside the modal). The "Re-mask" path is unreachable.
**Fix:** treat a server-approved reveal as valid for the session (no `expiresAt`), or use an explicit client TTL; add a test.

### FE-004 · P1 · "Escalate to Supervisory Officer" records a DEFER
`features/hitl/hitl-decision-pane.tsx:136-144`; `services/api/hitlApi.ts:80`
```tsx
onClick={() => setSelectedAction("ESCALATE")} … Escalate to Supervisory Officer
decision: decision.action === "APPROVE_MERGE" ? "APPROVE" : (decision.action === "REJECT_MERGE" ? "REJECT" : "DEFER"),
```
The backend accepts `APPROVE|REJECT|DEFER|REVERSE|STALE|CONTRADICTORY` (`schemas.py:31`); no escalation exists. The
reviewer is told the task goes to a supervisor; the audit log records DEFER. `hitlApi.ts:14` then maps DEFER back to the
status label "ESCALATED".
**Fix:** label the button "Defer (needs more information)" and the status "Deferred"; remove "Supervisory".

### FE-005 · P1 · Failed review decision gives no feedback
`features/hitl/hitl-workspace-page.tsx:78-85`, `hitl-decision-dialog.tsx` (no error prop), `stores/hitlStore.ts:156-160`
```ts
const success = await submitDecision(activeTask.id, pendingDecision);
if (success) { setIsDialogOpen(false); … }          // on failure: nothing
set({ isSubmitting: false, error: "Decision submission failed" });   // generic, and never rendered
```
A 403 (ANALYST/AUDITOR), 409 or 422 leaves the confirmation dialog open with re-enabled buttons and no message; the
server's `detail` is discarded.
**Fix:** keep `ApiError.message`/status in the store and show it inside the dialog.

### FE-006 · P1 · "Organize Map" does nothing on real data; layout is random on every load
`services/api/graphApi.ts:26-27`, `components/graph/engine/GraphEngine.ts:1016-1053`
```ts
x: Math.random() * 100, y: Math.random() * 100,
const canonical = CANONICAL_NODE_POSITIONS[nodeId]; if (canonical) { … }   // only "E-PERS-01" … mock ids
```
Real ids are `ENT-…`, so `organizeMap` only refits the camera. Positions are random per load (no layout algorithm runs;
`graphology-layout-forceatlas2` is installed but never imported), so the same case looks different every visit and
overlapping nodes are never separated. The toolbar's "Pause" state calls the same handler again (`GraphCanvas.tsx:137-143`)
and the effect at `GraphCanvas.tsx:116-123` calls `organizeMap` a second time.
**Fix:** run ForceAtlas2 (or a seeded deterministic layout) on load and on "Organize"; delete the mock-id code.

### FE-007 · P1 · Graph legend and timeline make "verified" claims (§16)
`components/graph/GraphLegend.tsx:87-98, 133`; `features/cases/timeline/case-timeline.tsx:90, 106`
```tsx
How Connections Are Verified … 5: "T5 — Cryptographic Reference (BSA)", 4: "T4 — Verified Records (Bank/CDR)",
Every connection is verified against original evidence records.
Chronological order of verified events … across Jaipur, Mumbai, and Dubai.
```
Edges are candidate relationships with no tier (`evidenceTiers.ts:8-9`, DEF-020); the legend labels also contradict
`EVIDENCE_TIER_CONFIG` (T4 = "Analyst Validated", T5 = "Supervisor Verified"). The city list is hard-coded.
**Fix:** legend: entity shapes/colours + "Candidate relationship (source-linked, not verified)"; timeline: "Source-linked events (candidates for review)", no place list.

### FE-008 · P1 · Legend colours do not match the graph
`components/graph/GraphLegend.tsx:59-80` vs `GraphEngine.ts:47-54` vs `case-graph-page.tsx:146-149`
```tsx
Legend: Person bg-[#17324D] · Event bg-[#6B5B95] · Digital/Cyber bg-[#287C7A]
Engine: PERSON "#287C7A" · EVENT "#475569" · CYBER "#6B5B95"
Hint bar: "🔵 Teal = Person", "🟣 Purple = Phone Handset"
```
The legend tells the user Person is navy and Cyber is teal; the canvas draws Person teal and Cyber purple.
**Fix:** one `ENTITY_STYLE` table consumed by engine, legend and hint bar.

### FE-009 · P1 · Profile "PII Masking" switch only changes a status label
`features/profile/profile-page.tsx:199-213`, `stores/authStore.ts:42`, `components/security/security-status-bar.tsx:60-71`
```tsx
onClick={() => setPiiMasked(!piiMasked)} … "PII masking is off — all identity fields are visible."
{piiMasked ? "PII MASKED (STRICT)" : "PII REVEALED"}
```
`piiMasked` is read nowhere else; masking is server-side. Turning it "off" makes the top bar say **PII REVEALED** in red
while nothing is revealed — a false security status.
**Fix:** remove the switch; show the server's masking policy instead.

### FE-010 · P1 · Demo credentials printed on the login page
`features/auth/login-page.tsx:141-142`
```tsx
Demo user example: <span>investigator</span> / <span>investigator-demo</span>
```
The live demo is public. CLAUDE.md §6 treats `<username>-demo` as a convention, not as something to publish.
**Fix:** remove from the UI (keep in README for operators).

### FE-011 · P1 · Reveal modal: fake clearance selector, broken officer line, "Revoke" that revokes nothing, legal claims
`components/intelligence/reveal-identity-modal.tsx:229-265, 236, 109-111, 125-133, 278, 298`
```tsx
{officerName} () &bull; {officerRole}        // both "" in revealStore → renders " () • "
{ level: 1, label: "Level 1: Observer", desc: "Unauthorized / Denied" } …   // "not sent to the server"
const handleRevoke = async () => { closeRevealModal(); };   // "Revoke & Re-mask Field"
Statutory Identity Unmasking Gateway · BNSS §91 Gate · Denial logged permanently to case audit ledger under Officer.
```
Three interactive tiles that change nothing, a revoke that only closes, and statutory wording the system cannot back.
**Fix:** drop the selector; show the signed-in user's name/role; "Close" instead of "Revoke"; neutral title ("Reveal masked value — audited").

### FE-012 · P1 · Settings "Clear Local Cache" shows a fake success
`features/settings/settings-page.tsx:12-15, 67-69`
```ts
const handleResetSession = () => { setResetMessage("Demonstration session state refreshed to factory defaults."); … };
DRISTI-NET caches graph representations and offline evidence slices locally …
```
Nothing is cleared; nothing is cached. **Fix:** delete the page (or implement a real store reset + `localStorage` clear).

### FE-013 · P1 · Four profile action cards do nothing
`features/profile/profile-page.tsx:224-253`
```tsx
label="Manage Profile" … onClick={() => {}}     label="Change Password" … onClick={() => {}}
label="Security & Sessions" … onClick={() => {}} label="Role & Permissions" … onClick={() => {}}
```
Full-width buttons with chevrons that look like navigation. **Fix:** remove or implement.

### FE-014 · P1 · Audit ledger presents blockchain semantics it disclaims
`features/cases/audit/case-audit-view.tsx:67-69 vs 138-139`, `audit-event-card.tsx:158-159`, `audit-filter-bar.tsx:113`
```tsx
events are not hash-chained, so a deleted event is not detected by the signature alone.
<span>Displaying {n} of {m} Blocks</span> <span>Sequence Linked</span>   #{String(blockNumber).padStart(2,"0")}
<option value="ASC">Oldest First (Genesis)</option>
```
"Blocks", "Sequence Linked", "Genesis" contradict the notice and §16 ("tamper-evident audit trail", not "private
blockchain"). Block numbers are client-side ordinal positions of the 200 loaded rows.
**Fix:** "Events", "Oldest first", show `audit_id` only.

---

## P2

### FE-015 · P2 · Unknown kinds/rel-types can crash the graph: non-multi graph with per-(source,target,rel_type) edges *(latent)*
`GraphEngine.ts:123, 369`; backend `services/graph.py:153-160`
```ts
this.graph = new Graph({ multi: false, type: "directed" });
this.graph.addEdgeWithKey(e.id, e.source, e.target, {...});
```
The API returns one edge per `(source, target, rel_type)`. Two rel-types between the same ordered pair make graphology
throw `UsageError` inside `loadGraphData`, which runs in a `useEffect` with no error boundary (no `errorElement` in the router).
**Fix:** `multi: true` (and draw parallel edges with curvature), or merge by pair; add an error boundary.

### FE-016 · P2 · Graph engine mixes cases when the route's case changes on a mounted page *(latent)*
`components/graph/GraphCanvas.tsx:58-70`, `stores/graphStore.ts:127`
```ts
if (engineRef.current.getNodeCount() === 0 || nodes.length < prevNodesCountRef.current) loadGraphData(...)
else engineRef.current.applyDelta(nodes, edges);   // adds new nodes, never removes old ones
```
`loadGraph` empties `nodes`, but the effect skips `nodes.length === 0`, so going from case A to a larger case B on the
same mounted page (URL change) keeps A's nodes. `applyDelta` also sets `label: n.isMasked ? n.maskedLabel : n.label`
(`:391`) — `maskedLabel` is never set.
**Fix:** key `GraphCanvas` by `caseId`, or always `loadGraphData` when `caseId` changes.

### FE-017 · P2 · Active toolbar buttons lose their background (undefined token wins in tailwind-merge)
`components/graph/GraphToolbar.tsx:151-156, 182-187`
```tsx
variant={isLayoutRunning ? "primary" : "ghost"} className={cn("…", isLayoutRunning && "bg-teal-primary text-white")}
```
`--color-teal-primary` is not defined; `twMerge` keeps `bg-teal-primary` and drops the variant's `bg-electric-blue`
(verified in Node), so "Pause"/"Filter" render white text on no background. `teal-primary` is used on 16 lines in 11 files;
`bg-bg-base` in 9 files; `bg-surface-base` in login; `shadow-card` in the legend — all no-ops.
**Fix:** define the tokens or replace with existing ones; add a lint rule/grep in CI for unknown theme classes.

### FE-018 · P2 · TypeScript `strict` is off; 86 `any`
`apps/web/tsconfig.app.json` (no `"strict"`, `noUnusedLocals: false`); services return `ApiResponse<any>`.
`tsc` passing is therefore weak evidence; e.g. `case-reviews-view.tsx:105` `tone={decisionTone(r.decision) as any}` hides the invalid `"green"` tone.
**Fix:** enable `strict`, type the API responses (generate from FastAPI OpenAPI).

### FE-019 · P2 · No 401 handling: an expired token leaves the user on broken pages
`services/api/real_client.ts:34-38`
```ts
if (!res.ok) { … throw new ApiError(res.status, detail, trace) }
```
Only `restoreSession` logs out on failure. After token expiry every page shows per-widget errors (or silent empties, see FE-022) instead of returning to login.
**Fix:** on 401 call `logout()` once (preserve `location` for return).

### FE-020 · P2 · Login ignores the preserved destination
`components/auth/protected-route.tsx:18` vs `features/auth/login-page.tsx:28`
```tsx
return <Navigate to="/login" state={{ from: location }} replace />;
if (result.success) { navigate("/"); }
```
Deep links (e.g. a review task URL) always land on the dashboard. Also `/login` while signed in still shows the form.
**Fix:** `navigate(location.state?.from?.pathname ?? "/", { replace: true })`.

### FE-021 · P2 · Global audit page calls `/audit` before its role check
`features/audit/global-audit-page.tsx:37, 56`
```ts
useEffect(() => { load(); }, []);                         // runs for every role
if (user?.role !== "AUDITOR" && user?.role !== "ADMIN") { return <Access Denied/> }
```
Investigators trigger a 403 (`GET /audit?limit=500`, screenshot finding #8) on every visit; the denial is audited server-side as noise.
**Fix:** guard inside the effect (or route-level guard).

### FE-022 · P2 · Errors swallowed → false zeros and empty lists
`case-overview-view.tsx:26-29`, `command-center-page.tsx:40`, `cases-directory-page.tsx:21`, `hitlStore.ts:65, 176-178, 187-189`, `graphStore.ts:172-174`
```ts
getCaseStats(caseId).then((r) => setStats(r.data)).catch(() => {});   // ×4 in overview
.catch((e) => console.error("Failed to load cases", e))              // dashboard → "No cases assigned to your account."
} catch { // Keep selectedNodeId }                                      // entity drawer never opens, no message
```
An auditor's overview fires a 403 on `/stats` (screenshot finding #8) and shows "—"; a dashboard failure reads as "no cases"; a failed entity fetch leaves a selected node with no drawer and no message.
**Fix:** per-widget error state; distinguish 403 ("not available for your role") from failure.

### FE-023 · P2 · HITL stats show 0 when `/stats` is forbidden
`features/hitl/hitl-workspace-page.tsx:165, 169, 177`; backend `/cases/{id}/stats` requires REVIEWER/INVESTIGATOR/ADMIN
```tsx
Pending: <strong>{stats?.pendingCount ?? 0}</strong> … Critical Contradictions: {stats?.criticalCount ?? 0} … Resolved: {stats?.resolvedCount ?? 0}
```
ANALYST/AUDITOR see "Pending: 0" next to a list of pending tasks. "Critical" is just `conflicts.length > 0`; "Candidates" duplicates "Total".
**Fix:** derive counts from `tasks` when stats are unavailable; rename "Critical Contradictions" → "With conflicts".

### FE-024 · P2 · No UI role gating on write actions the server will refuse
| Control | file:line | Server roles |
| --- | --- | --- |
| Decision form + "Record decision" | hitl-decision-pane.tsx:108-188 | REVIEWER, INVESTIGATOR, ADMIN |
| Claim "Override decision" ×4 | case-reviews-view.tsx:122-136 | REVIEWER, INVESTIGATOR, ADMIN |
| Upload | case-evidence-view.tsx:93-118 | EVIDENCE_OFFICER, INVESTIGATOR, ADMIN |
| Create Anchor | case-overview-view.tsx:176 | INVESTIGATOR, REVIEWER, ANALYST, ADMIN |
| Report / Integrity PDF | reports-page.tsx:129-136 | INVESTIGATOR, REVIEWER, ANALYST, ADMIN |
| Reveal identity (`canRequestReveal={true}`) | EntityDrawer.tsx:136 | server-side role check |
Only download (`RAW_DOWNLOAD_ROLES`) and the sidebar Audit link are gated. Users click, then get a 403 (often rendered poorly, FE-005).
**Fix:** a single `can(role, capability)` table mirrored from the API, used to hide or show `restricted` buttons with a reason.

### FE-025 · P2 · Evidence upload: raw `fetch`, no busy state, unhandled rejection, unlabeled native input
`features/cases/evidence/case-evidence-view.tsx:94-118`
```tsx
<input type="file" onChange={…} className="text-sm border …" />
<Button onClick={async () => { … const res = await fetch(`/api/v1/cases/${…}/evidence`, …) … }}>Upload</Button>
```
Ignores `VITE_API_BASE_URL` (unlike `real_client`), duplicates the unused `evidenceApi.uploadEvidence`, can be double-submitted,
a network error rejects unhandled (no message), the selected file is not cleared after success, and the file input has no label.
**Fix:** use `uploadEvidence`, disable while pending, `try/catch`, labelled drop-zone.

### FE-026 · P2 · Court-PDF export also bypasses the API client
`features/reports/reports-page.tsx:47-55`
```ts
const res = await fetch(`/api/v1/cases/${caseId}/report/court-pdf`, …)
```
Hard-coded base URL; two unused service functions do the same (`integrityApi.ts:19`, `reportApi.ts:9`). `real_client.api` already returns a Blob for `application/pdf` (`real_client.ts:40-42`).
**Fix:** use the client.

### FE-027 · P2 · CSV export is not escaped
`features/cases/audit/audit-integrity-header.tsx:20-23`
```ts
`${l.created_at},${l.action},${l.actor_id || ""},${l.target_kind || ""},${l.target_id || ""},${l.outcome}`
```
No quoting, so commas/quotes/newlines break rows, and values starting with `=`,`+`,`-`,`@` are interpreted as formulas when opened in a spreadsheet (CSV injection). `detail` is omitted.
**Fix:** RFC-4180 quoting and prefix risky leading characters with `'`.

### FE-028 · P2 · Timeline date filter: end date excluded, zones mixed
`stores/timelineStore.ts:96-104`, `timeline-filter-bar.tsx:83-99`
```ts
const eventTime = e.time ? new Date(e.time).getTime() : 0;      // "2019-03-04 10:00:00" → browser-local
const endMs = new Date(filters.endDate).getTime();               // "YYYY-MM-DD" → 00:00 UTC
if (eventTime > endMs) return false;
```
Events on the chosen end day are dropped; naive timestamps are parsed in the browser zone while date inputs are UTC — the opposite of DEF-079's intent (`lib/utils.ts:12-16`). Undated events get time 0 and are removed by any start date.
**Fix:** compare `recordedDateKey(e.time)` strings to the input strings.

### FE-029 · P2 · Timeline "Map" button never focuses the event in the graph
`features/cases/timeline/timeline-event-row.tsx:41-46`, `stores/graphStore.ts:127, 167-168`
```ts
selectNode(event.source.entity_id); navigate(`/cases/${caseId}/graph`);
loadGraph: set({ …, selectedNodeId: null, selectedEdgeId: null, selectedEntityDetail: null })
```
The graph page's `loadGraph` clears the selection it was just given; if a previous case was loaded, `selectNode` first
fetches the entity with the *previous* case id.
**Fix:** navigate with `?entity=<id>` and select after load.

### FE-030 · P2 · Audit "open in context" links go nowhere useful
`features/cases/audit/audit-event-card.tsx:129-144`
```ts
`/cases/${log.case_id}/graph?entityId=…`   `/cases/${log.case_id}/evidence?evidenceId=…`   `/cases/${log.case_id}/notes?targetId=…`
```
Graph and evidence pages ignore these params; `/notes` silently renders Overview (router.tsx:39).
**Fix:** support the params or link plainly to the tab.

### FE-031 · P2 · Graph page header/actions: "Case" instead of title, Share with no handler, Export always restricted
`features/cases/case-graph-page.tsx:86-88, 120-123, 125-133`
```tsx
<span …>Case</span>
<Button variant="ghost" …><Share2 …/>Share</Button>                           // no onClick
<Button variant="restricted" restrictedReason="Supervisor clearance required for dossier export">
```
`caseTitle` is already in `graphStore`. Export works on `/reports` for 4 roles.
**Fix:** show title; remove Share; link Export to Reports with a role gate.

### FE-032 · P2 · Graph "Hide Panel" cannot hide while something is selected
`features/cases/case-graph-page.tsx:50-51, 113`
```ts
const isDrawerOpen = Boolean(selectedNodeId || selectedEdgeId) || !isDrawerCollapsed;
onClick={() => setIsDrawerCollapsed(isDrawerOpen)}
```
With a selection, `isDrawerOpen` stays true, so the button does nothing visible.
**Fix:** separate "panel visible" from "selection".

### FE-033 · P2 · Entity drawer "Links" rows look clickable but have no handler
`components/graph/drawers/EntityDrawer.tsx:154-166`
```tsx
<button key={e.id} type="button" className="… hover:bg-surface-3 …">   // no onClick
```
Also shows only the rel-type and count, not the other endpoint. **Fix:** `onClick={() => selectEdge(e.id)}` and show the counterpart label.

### FE-034 · P2 · "Conflicting Clues Only" filter is a label with no control
`components/graph/filters/GraphFilterPanel.tsx:84-104`
```tsx
<label htmlFor="filter-contradictions-only" className="… cursor-pointer …"> … Conflicting Clues Only </label>   // no input
```
**Fix:** remove (no edge carries a contradiction flag) or wire to `/contradictions`.

### FE-035 · P2 · Notifications bell has no handler; "Lock" is a logout
`components/security/security-status-bar.tsx:79-95`
```tsx
<Button variant="ghost" size="icon" … aria-label="Notifications"><Bell …/></Button>   // no onClick
aria-label="Lock workstation session" onClick={() => { logout(); navigate("/login"); }}
```
"Lock" ends the session (and all in-memory state, by design `authStore.ts:133-137`) — label it "Sign out". Also duplicated
separators (`:73, :77`) and the role is shown twice (`:38, :44`).

### FE-036 · P2 · People shown as raw IDs
`case-detail-sidebar.tsx:69, 85-89`, `case-overview-view.tsx:69`, `case-workspace-page.tsx:225`, `cases-directory-page.tsx:128`,
`evidence-card.tsx:85`, `evidence-row.tsx:74`, `case-reviews-view.tsx:117`, `hitlApi.ts:51,56`, `audit-event-card.tsx:147`, `timeline-event-row.tsx:126-145`
```tsx
{caseData.owner_id}   {memberId}   {item.uploaded_by}   Reviewer: {r.reviewer_id}   <span>{entId}</span>
```
`USR-…` / `ENT-…` everywhere a person or entity name is expected (screenshot finding #4). Timeline entity chips show
`ENT-…` although the event carries `source.label` / `target.label`.
**Fix:** resolve user ids via `/users` (or the new `people` field) and use entity labels.

### FE-037 · P2 · Evidence status badges are always blue
`evidence-card.tsx:63-65`, `evidence-row.tsx:89`, `case-evidence-view.tsx:86-90`, `hitl-evidence-pane.tsx` (HEAD :106)
```tsx
<Badge tone="blue" …>{item.status}</Badge>
```
`INFECTED`, `QUARANTINED`, `INTEGRITY_MISMATCH` look identical to `ACCEPTED`. **Fix:** a status→tone map (the `--status-*` tokens exist).

### FE-038 · P2 · Icon-only controls without an accessible name
| file:line | Control |
| --- | --- |
| ProvenanceViewer.tsx:44 | close (X) |
| EntityDrawer.tsx:52 | close (X) |
| EdgeDrawer.tsx:33 | close (X) |
| audit-detail-drawer.tsx:114, :226 | close (X), copy trace |
| audit-event-card.tsx:229, :243 | copy trace, chevron (title only) |
| hitl-decision-dialog.tsx:43 | close (X) |
| hitl-queue-filters.tsx:36 (HEAD) | clear search (X) |
| case-evidence-view.tsx:68, :75 | grid / table toggle |
| evidence-card.tsx:102 | copy hash |
| case-detail-sidebar.tsx:44 | collapse panel |
| GraphToolbar.tsx:299 | clear search (×) |
| hitl-workspace-page.tsx:143 | refresh (title only) |
| sidebar.tsx:15-27 (collapsed) | nav links render only an icon; tooltip is not a name |
**Fix:** `aria-label` on each; `aria-pressed` on toggles.

### FE-039 · P2 · Clickable non-buttons, nested interactive elements, hover-only actions
- `audit-event-card.tsx:152-155` clickable `<div onClick>` without role/tabIndex/keyboard handler.
- `<Link><Button>` (anchor wrapping button) at case-overview-view.tsx:101-120, command-center-page.tsx:137-147,156-161,173-196,
  cases-directory-page.tsx:132-145 (HEAD), hitl-workspace-page.tsx:128-139.
- `evidence-row.tsx:92` actions `opacity-0 group-hover:opacity-100` — invisible to keyboard and touch users.
- SVG location dots (`investigation-map-view.tsx:115`) are mouse-only.
**Fix:** `Button asChild` + `Link`; `focus-within:opacity-100`; real buttons.

### FE-040 · P2 · Form labels not associated with inputs
`login-page.tsx:71, 91` (HEAD) `<label>` without `htmlFor` (inputs have ids `officer-id`, `password`); `hitl-decision-pane.tsx:151-164`
(textarea has no id); `reports-page.tsx:99, 118`; search inputs with placeholder only: evidence-filter-bar.tsx:17, audit-filter-bar.tsx:38,
cases-directory-page.tsx:61 (HEAD), global-audit-page.tsx (HEAD :87), hitl-queue-filters.tsx (HEAD :28), GraphToolbar.tsx:289, ProvenanceViewer.tsx:83;
audit `<select>`s (audit-filter-bar.tsx:65-114) labelled only by an icon.

### FE-041 · P2 · Custom dialogs lack dialog semantics
`hitl-decision-dialog.tsx:26`, `ProvenanceViewer.tsx:33` (second branch has no `role="dialog"`), `audit-detail-drawer.tsx:101`
No `role="dialog"`/`aria-modal`, no Escape, no focus trap or return focus; background stays tabbable. Only the Radix dialog is correct.
**Fix:** build all on `components/ui/dialog.tsx` (Radix) or a Radix-based Sheet.

### FE-042 · P2 · Case pages use four different layouts; HITL and Reports leave the case
`case-workspace-page.tsx:120`, `case-graph-page.tsx:62`, `hitl-workspace-page.tsx:88-153`, `reports-page.tsx:77-84`
Graph has a 5-item nav vs 9 elsewhere; HITL has its own header and `h-[calc(100vh-3.5rem)]` although the top bar is `h-10` (2.5 rem);
Reports has no case nav or back link (screenshot findings #1, #2, #7). Five overlapping navigation paths (FE inventory §5).
**Fix:** one `CaseLayout` with tabs + breadcrumb (the redesign in progress does this).

### FE-043 · P2 · Phones get only a notice for every case page
`layouts/InvestigationShell/investigation-shell.tsx:45, 94-106`
```tsx
<div className="hidden … md:flex"> … <div className="… md:hidden"> Best experienced on tablet or desktop
```
Overview, evidence, timeline, audit and reviews are list pages that would work at 390 px. **Fix:** apply the desktop-only rule to the graph only.

### FE-044 · P2 · Client-side masking hard-codes demo people and accounts
`lib/pii.ts:110-128`
```ts
res = res.replace(/\b990123456789\b/g, "********6789"); …
res = res.replace(/\bVikram Sharma\b/gi, "Vikram S******"); … /\bAmit Goyal\b/gi
```
Data-specific code in the product (and real-looking names in source). It also gives a false sense of protection: any
other name passes unmasked. Masking is the server's job (`mask_label`, `mask_text`). **Fix:** delete; render server-masked labels as-is.

---

## P3

### FE-045 · P3 · Filter counts off by one; "Clear" selects one type
`GraphToolbar.tsx:70-73`, `GraphFilterPanel.tsx:33-36`, `graphStore.ts:270, 285-286`
```ts
if (activeRelationshipTypes.size < 6) activeFilterCount++;   // there are 7 relationship types
clearEntityTypes: () => set({ activeEntityTypes: new Set(["PERSON"]) }),
clearRelationshipTypes: () => set({ activeRelationshipTypes: new Set<RelationshipType>(["CALLED"]) }),
```
Unchecking one relationship type is not counted; "Clear" means "Person only"/"Called only". Toggle refuses to remove the last type silently.

### FE-046 · P3 · "Nodes passing" is always all nodes
`components/graph/filters/ConfidenceRangeFilter.tsx:14-16`
```ts
const passingNodes = nodes.filter((n) => (1) >= minConfidence).length;
```

### FE-047 · P3 · Duplicate entity-type filter in toolbar (2xl only)
`GraphToolbar.tsx:219-282` duplicates `EntityTypeFilter.tsx`; the dropdown never closes on outside click; search filter checks the same condition twice (`:85-87`).

### FE-048 · P3 · Graph/audit/timeline filters persist across cases
`graphStore.ts:296-308` (filters only reset by button), `auditStore.ts` (global; `targetId` from a deep link survives navigation, `resetFilters` keeps `sortOrder`),
`timelineStore.ts`. Opening another case can show "No matching audit events" because of a previous case's filter.

### FE-049 · P3 · Reviews view: error is never cleared; invalid tone
`features/cases/reviews/case-reviews-view.tsx:16-22, 50-54`
```ts
const load = () => { …; setIsLoading(true); getCaseReviews(caseId)…  // no setError("")
if (d === "APPROVE" || d === "ALLOWED") return "green";   // Badge has no "green" tone
```
After one failure, "Refresh" keeps the error forever. Same invalid tone in `global-audit-page.tsx:10,12` (HEAD).

### FE-050 · P3 · `window.prompt` for audited reasons
`evidence-card.tsx:35`, `evidence-row.tsx:35`, `case-reviews-view.tsx:31` — blocked in some embedded browsers, unstyled, no length hint; card and row duplicate the handler.

### FE-051 · P3 · Provenance reveal reason: no minimum, persists between records
`components/evidence/ProvenanceViewer.tsx:9, 27-30, 90`
```ts
const [reason, setReason] = useState("");   // component never unmounts; reason kept for the next document
if (!reason.trim()) return;                  // server requires ≥5 → raw 422 text
```

### FE-052 · P3 · HITL search reloads the API on every keystroke
`hitlStore.ts:125-129` `setFilter` → `loadTasks`, which also clears `tasks` (`:62`) → list flashes; search could be client-side (the API ignores it, `hitlApi.ts:67-71`).

### FE-053 · P3 · HITL resolved view shows decision as officer badge; evidence pane claim is false
`hitlApi.ts:52` `officerBadge: last.decision` → "Officer: USR-… (APPROVE)" (`hitl-decision-pane.tsx:99`);
`hitl-evidence-pane.tsx` (HEAD :116-117) "the specific lines behind each signal are listed in the decision pane" — they are not;
the pane always loads `line: 1` (HEAD :35). `new_evidence_since_snapshot` (DEF-099) is returned by the API but never mapped.

### FE-054 · P3 · Reveal/decision reason minimums differ from the server
Client 15 chars (`reveal-identity-modal.tsx:92`, `hitl-decision-pane.tsx:39`) vs server 5 / 3 (`schemas.py:32,37`); message says "legally required".

### FE-055 · P3 · `restoreSession` writes the string "undefined"
`stores/authStore.ts:96` `setSession(token, undefined as any)` → `localStorage.setItem(USER_KEY, JSON.stringify(undefined))` stores `"undefined"`; `currentUser()` then throws/parses null until `/auth/me` returns. Download role check (`evidence-card.tsx:31`) reads this.

### FE-056 · P3 · Test hooks exposed in production
`GraphEngine.ts:145, 263` `window.__graph`, `window.__sigma`; `case-graph-page.tsx:55-57` `window.__graphStore` (used by `tests/e2e/test_ui_demo.py`). Gate behind `import.meta.env.DEV` or a test flag.

### FE-057 · P3 · Timestamp formatting inconsistent and partly wrong
`audit-detail-drawer.tsx:49-65` appends " IST" to a browser-zone time; `formatters.ts` forces IST; `utils.recordedTime` shows zone-less; `toLocaleDateString` elsewhere (inventory §5).

### FE-058 · P3 · Temporal slider edge cases
`TemporalSlider.tsx:147` `step={(max-min)/100}` → `0` when all edges share a timestamp (invalid range step); `graphStore.ts:89-90` falls back to hard-coded Feb-2026 dates when no edge is dated; `formatCompactTimestamp` converts naive times to IST (FE-057).

### FE-059 · P3 · Case workspace loading/error states
`case-workspace-page.tsx:115-116`
```tsx
if (isLoading) { return <div className="flex h-screen …">Loading Workspace...</div>; }
if (!caseData) { return <div role="alert" className="p-8 text-center text-text-muted">Could not load case …</div>; }
```
`h-screen` inside the shell overflows; a 403 is one grey line with no explanation or way back (screenshot finding #8).

### FE-060 · P3 · Unused code and dependencies
10 unreachable files, 14 unused exports, 6 unused packages, 104 unused-variable warnings (see inventory §4, §11).

## P2.1 audit (2026-11-13, `frontend-audit/P21_UI_AUDIT.md`)

Browser sweep of 21 routes × 2 widths (axe-core 4.10.2) plus a static scan; all fixed on branch `worktree-auth-login-ratelimit`.

| ID | Severity | Finding | Status |
|---|---|---|---|
| FE-062 | P2 | 8,624 visible text elements under the 12px minimum (`text-micro` token was 11px; 28 hard-coded 9–11px sizes) | Fixed: token 12px, sizes → `text-xs`; sweep 0 |
| FE-063 | P2 | Users, Case assignments and global Audit log had no `<h1>` (ad-hoc uppercase mono `<h2>` bars) | Fixed: `PageHeader`; sweep 0 pages without one H1 |
| FE-064 | P2 | Global Audit log: actor shown as internal `USR-` key, outcome by colour only, unlabelled action filter (axe `select-name`), list not keyboard-scrollable | Fixed: semantic table with username/role/office, outcome words, labelled filters |
| FE-065 | P2 | `window.confirm` for retiring a user ID, removing a case member and handing over a case | Fixed: `ConfirmDialog` |
| FE-066 | P3 | axe: `scrollable-region-focusable` (request detail), `link-in-text-block` (Decisions), `button-name` (graph Organize at <640px) | Fixed |
| FE-067 | P3 | Patterns: entity type ran into the name ("ORGANIZATIONRiverside Traders"); jargon headings; palette colours | Fixed |
| FE-068 | P3 | 47 Tailwind palette colour classes instead of tokens (low contrast `emerald-400`/`amber-400` on white) | Fixed: 0 left |
| FE-069 | P3 | Ad-hoc spinners and plain-text empty states on newer pages | Fixed: `LoadingState`/`EmptyState`/`ErrorState` |

