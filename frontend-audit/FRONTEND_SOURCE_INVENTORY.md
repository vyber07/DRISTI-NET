# Frontend source inventory — apps/web/src

**Baseline audited:** git `HEAD` = `817bfd0` (the code the live demo's `apps/web/dist` was built from).
While this audit ran, the working tree under `apps/web/src` was being changed by the redesign (router, sidebar,
status bar, profile page, new `case-layout.tsx`, `components/layout/`, `lib/permissions.ts`, …). To keep the audit
consistent, every file was read at `HEAD` (working-tree reads were checked against `git diff`; `profile-page.tsx`
was re-read with `git show HEAD:`), and tsc/oxlint were re-run on a `git archive HEAD` export in `/tmp/fe-head`.
Line numbers in all three documents refer to `HEAD`.

**Scope:** 115 files, 13,572 lines (the brief's "~130 files" was an estimate; `find apps/web/src -type f` at HEAD = 115).
**Method:** each file read in full with `cat -n` / Read; "Imported by" is computed by a resolver over every
`import … from`, `import()` and CSS `@import` (alias `@/` and relative paths), then reachability from `src/main.tsx`.
Static code reading only — nothing here is browser-verified.

## 1. Tooling results (read-only, Node 24)

| Check | Result |
| --- | --- |
| `npx tsc -b --noEmit` (HEAD export and working tree at start) | **exit 0, no errors** — but `tsconfig.app.json` has **no `"strict"`** (so `strictNullChecks`/`noImplicitAny` are off) and `noUnusedLocals`/`noUnusedParameters` are `false`. The clean result therefore proves little. |
| `npx oxlint src` | **117 warnings, 0 errors** (identical on HEAD export and on the working tree at audit start) |
| — `eslint(no-unused-vars)` | 104 (unused imports/params/locals). Worst: audit-detail-drawer 19, EntityDrawer 14, case-evidence-view 10, evidence-row 8, evidence-card 8, EdgeDrawer 7, GraphToolbar 7 |
| — `react(set-state-in-effect)` | 7: case-analysis-page:27, investigation-map-view:41, case-reviews-view:25, global-audit-page:37 & :51, hitl-decision-pane:28, hitl-evidence-pane:53 |
| — `react-hooks(exhaustive-deps)` | 3 (missing `load`): case-analysis-page:27, investigation-map-view:41, case-reviews-view:25 |
| — `react(static-components)` | 1: EntityDrawer.tsx:43 (`Icon` chosen during render) |
| — `react(only-export-components)` | 2: button.tsx:95, badge.tsx:46 |
| `.oxlintrc.json` | Only `rules-of-hooks` (error) and `only-export-components` (warn) configured explicitly. |

## 2. File table

Status legend: ACTIVE = reachable from `main.tsx` and used; PARTIAL = reachable but with unused/fake parts;
UNUSED = not reachable from `main.tsx` (grep-verified, no importer or only unreachable importers);
DEAD CODE = empty or unreachable code inside a file; DUPLICATE = second implementation of something that exists elsewhere;
PLACEHOLDER = rendered UI that does nothing real. "APIs called" = direct `get/post/fetch` calls in that file
(pages reach the API through services/stores, see the interaction register for per-control APIs).


**File status counts (115 files):** ACTIVE 97, UNUSED 9, PARTIAL 7, DEAD 1, PLACEHOLDER 1. Files marked ACTIVE may still contain dead code — see §4.

| File | Lines | Purpose | Key exports | Imported by (grep-verified) | APIs called (direct) | Status |
| --- | ---: | --- | --- | --- | --- | --- |
| `App.tsx` | 13 | Providers + RouterProvider | App | main.tsx | — | ACTIVE |
| `app/providers/app-providers.tsx` | 23 | Restores session before render; TooltipProvider | AppProviders | App.tsx | — | ACTIVE |
| `app/router/router.tsx` | 51 | Route table (22 routes) | router | App.tsx | — | ACTIVE (contains dead routes: /notes, /report dup, /settings unlinked, * silent redirect) |
| `components/auth/protected-route.tsx` | 22 | Redirects unauthenticated users to /login with state.from | ProtectedRoute | app/router/router.tsx | — | ACTIVE (state.from never consumed by login) |
| `components/evidence/ProvenanceViewer.tsx` | 102 | Full-screen source-context viewer + context reveal | ProvenanceViewer | features/cases/case-graph-page.tsx, features/cases/case-workspace-page.tsx, features/hitl/hitl-workspace-page.tsx | — | ACTIVE |
| `components/evidence/SvgBoundingBoxOverlay.tsx` | 142 | Bounding-box overlay | SvgBoundingBoxOverlay | NONE | — | UNUSED |
| `components/graph/GraphCanvas.tsx` | 166 | Mounts GraphEngine, syncs store → engine | GraphCanvas | features/cases/case-graph-page.tsx | — | ACTIVE |
| `components/graph/GraphLegend.tsx` | 138 | Legend (tiers, colours) — disagrees with engine | GraphLegend | components/graph/GraphCanvas.tsx | — | ACTIVE (content not derived) |
| `components/graph/GraphToolbar.tsx` | 336 | Zoom/fit/organize/filter/type dropdown/search | GraphToolbar | components/graph/GraphCanvas.tsx | — | ACTIVE |
| `components/graph/TemporalSlider.tsx` | 181 | Playback scrubber | TemporalSlider | features/cases/case-graph-page.tsx | — | ACTIVE |
| `components/graph/drawers/EdgeDrawer.tsx` | 140 | Relationship detail + per-claim provenance | EdgeDrawer | features/cases/case-graph-page.tsx | — | ACTIVE |
| `components/graph/drawers/EmptyDrawer.tsx` | 54 | Graph overview panel | EmptyDrawer | features/cases/case-graph-page.tsx | — | ACTIVE |
| `components/graph/drawers/EntityDrawer.tsx` | 175 | Entity profile, reveal, links tab | EntityDrawer | features/cases/case-graph-page.tsx | — | ACTIVE (Links rows have no handler) |
| `components/graph/engine/GraphEngine.ts` | 1091 | Sigma/graphology wrapper, canvas overlay, mock-ID layout | GraphEngine, CANONICAL_NODE_POSITIONS | components/graph/GraphCanvas.tsx | — | ACTIVE (contains DEAD CODE for mock ids E-*/R-17) |
| `components/graph/filters/ConfidenceRangeFilter.tsx` | 91 | Min confidence slider/presets | ConfidenceRangeFilter | components/graph/filters/GraphFilterPanel.tsx | — | ACTIVE ("Nodes passing" is fake) |
| `components/graph/filters/DateRangeFilter.tsx` | 158 | Observation window | DateRangeFilter | components/graph/filters/GraphFilterPanel.tsx | — | ACTIVE |
| `components/graph/filters/EntityTypeFilter.tsx` | 82 | Entity type checkboxes | EntityTypeFilter | components/graph/filters/GraphFilterPanel.tsx | — | ACTIVE (DUPLICATE of toolbar dropdown) |
| `components/graph/filters/GraphFilterPanel.tsx` | 144 | Filter panel container | GraphFilterPanel | components/graph/GraphCanvas.tsx | — | ACTIVE (contains non-functional "Conflicting Clues Only") |
| `components/graph/filters/RelationshipTypeFilter.tsx` | 73 | Relationship checkboxes | RelationshipTypeFilter | components/graph/filters/GraphFilterPanel.tsx | — | ACTIVE |
| `components/graph/filters/TierFilter.tsx` | 84 | Tier checkboxes | TierFilter | NONE | — | UNUSED (removed per DEF-020) |
| `components/intelligence/confidence-meter.tsx` | 63 | Confidence bar | ConfidenceMeter | features/command-center/foundation-preview-page.tsx, features/hitl/hitl-decision-pane.tsx, features/hitl/hitl-task-card.tsx | — | ACTIVE |
| `components/intelligence/entity-badge.tsx` | 41 | Entity type badge | EntityBadge, ENTITY_TYPE_CONFIG | components/graph/filters/EntityTypeFilter.tsx, features/command-center/foundation-preview-page.tsx | — | ACTIVE |
| `components/intelligence/evidence-tier-badge.tsx` | 60 | Tier badge | EvidenceTierBadge | features/command-center/foundation-preview-page.tsx | — | UNUSED (only foundation-preview) |
| `components/intelligence/pii-field.tsx` | 101 | Masked field + reveal button | PIIField | components/graph/drawers/EntityDrawer.tsx, features/command-center/foundation-preview-page.tsx | — | ACTIVE |
| `components/intelligence/relationship-badge.tsx` | 55 | Relationship badge | RelationshipBadge | components/graph/filters/RelationshipTypeFilter.tsx, features/command-center/foundation-preview-page.tsx | — | ACTIVE |
| `components/intelligence/reveal-identity-modal.tsx` | 366 | Entity reveal dialog (legal wording, fake clearance selector) | RevealIdentityModal | layouts/AppShell/app-shell.tsx | — | ACTIVE |
| `components/security/security-status-bar.tsx` | 101 | Global top bar (user, role, jurisdiction, PII flag, bell, lock) | SecurityStatusBar | layouts/AppShell/app-shell.tsx | — | ACTIVE |
| `components/ui/badge.tsx` | 46 | Badge (cva tones) | Badge, badgeVariants | components/graph/drawers/EdgeDrawer.tsx, components/graph/drawers/EmptyDrawer.tsx, components/graph/drawers/EntityDrawer.tsx, components/intelligence/… (32 files) | — | ACTIVE |
| `components/ui/button.tsx` | 95 | Button (cva variants incl. restricted) | Button, buttonVariants | components/evidence/ProvenanceViewer.tsx, components/graph/GraphToolbar.tsx, components/graph/TemporalSlider.tsx, components/graph/drawers/EdgeDrawer.… (43 files) | — | ACTIVE |
| `components/ui/checkbox.tsx` | 28 | Radix checkbox | Checkbox | components/graph/filters/EntityTypeFilter.tsx, components/graph/filters/GraphFilterPanel.tsx, components/graph/filters/RelationshipTypeFilter.tsx, com… (4 files) | — | ACTIVE |
| `components/ui/dialog.tsx` | 116 | Radix dialog wrapper | Dialog… | components/intelligence/reveal-identity-modal.tsx | — | ACTIVE (only reveal modal uses it) |
| `components/ui/separator.tsx` | 23 | Divider | Separator | components/security/security-status-bar.tsx, features/command-center/foundation-preview-page.tsx, features/profile/profile-page.tsx, layouts/AppShell/… (5 files) | — | ACTIVE |
| `components/ui/status-dot.tsx` | 47 | Status dot | StatusDot | features/cases/components/case-header.tsx | — | ACTIVE (1 use: hard-coded "Active Investigation") |
| `components/ui/tabs.tsx` | 55 | Radix tabs | Tabs… | components/graph/drawers/EntityDrawer.tsx | — | ACTIVE (EntityDrawer only) |
| `components/ui/tooltip.tsx` | 27 | Radix tooltip | Tooltip… | app/providers/app-providers.tsx, components/graph/GraphToolbar.tsx, components/graph/TemporalSlider.tsx, components/intelligence/evidence-tier-badge.t… (6 files) | — | ACTIVE |
| `constants/evidenceTiers.ts` | 96 | Tier 2–6 label/colour/line table | EVIDENCE_TIER_CONFIG, EVIDENCE_TIER_ORDER, EvidenceTier | components/graph/GraphLegend.tsx, components/graph/GraphToolbar.tsx, components/graph/engine/GraphEngine.ts, components/graph/filters/TierFilter.tsx, … (9 files) | — | PARTIAL (backend emits no tier; only legend/unused badge read it) |
| `constants/navigation.ts` | 27 | Global sidebar items | PRIMARY_NAV_ITEMS, SYSTEM_NAV_ITEMS, ALL_NAV_ITEMS | layouts/AppShell/sidebar.tsx | — | ACTIVE (ALL_NAV_ITEMS unused) |
| `features/audit/global-audit-page.tsx` | 142 | Global audit list | GlobalAuditPage | app/router/router.tsx | — | ACTIVE |
| `features/auth/login-page.tsx` | 146 | Login form | LoginPage | app/router/router.tsx | — | ACTIVE |
| `features/cases/analysis/case-analysis-page.tsx` | 169 | Degree/bridges/communities/rules | CaseAnalysisPage | features/cases/case-workspace-page.tsx | — | ACTIVE |
| `features/cases/audit/audit-detail-drawer.tsx` | 247 | Audit record drawer | AuditDetailDrawer | features/cases/audit/case-audit-view.tsx | — | ACTIVE |
| `features/cases/audit/audit-event-card.tsx` | 254 | Audit row card ("block #") | AuditEventCard | features/cases/audit/case-audit-view.tsx | — | ACTIVE |
| `features/cases/audit/audit-filter-bar.tsx` | 119 | Audit search/selects | AuditFilterBar | features/cases/audit/case-audit-view.tsx | — | ACTIVE |
| `features/cases/audit/audit-integrity-header.tsx` | 75 | Header + CSV export | AuditIntegrityHeader | features/cases/audit/case-audit-view.tsx | — | ACTIVE |
| `features/cases/audit/case-audit-view.tsx` | 161 | Case audit ledger | CaseAuditView | features/cases/case-workspace-page.tsx | GET targetId | ACTIVE |
| `features/cases/case-graph-page.tsx` | 220 | Graph page with its own 5-item nav | CaseGraphPage | app/router/router.tsx | — | ACTIVE (DUPLICATE case nav) |
| `features/cases/case-workspace-page.tsx` | 242 | Case workspace (8 tabs) + inline placeholder | CaseWorkspacePage | app/router/router.tsx | GET tab | ACTIVE (inline CasePlaceholderView DUPLICATE) |
| `features/cases/cases-directory-page.tsx` | 153 | Case directory + search | CasesDirectoryPage | app/router/router.tsx | — | ACTIVE |
| `features/cases/components/case-detail-sidebar.tsx` | 153 | Right "Case information" panel | CaseDetailSidebar | features/cases/case-workspace-page.tsx | — | ACTIVE (repeats overview) |
| `features/cases/components/case-header.tsx` | 70 | Case header (title, map, reports) | CaseHeader | features/cases/case-workspace-page.tsx | — | ACTIVE |
| `features/cases/components/case-overview-view.tsx` | 213 | Overview: properties, stats, modules, contradictions, reviews, anchors | CaseOverviewView | features/cases/case-workspace-page.tsx | — | ACTIVE |
| `features/cases/components/case-placeholder-view.tsx` | 148 | Placeholder with planned capabilities | CasePlaceholderView | NONE | — | UNUSED (DUPLICATE of inline version) |
| `features/cases/components/case-stats-grid.tsx` | 49 | Stats grid | CaseStatsGrid | NONE | — | UNUSED |
| `features/cases/evidence/case-evidence-view.tsx` | 185 | Evidence list, upload, view toggle | CaseEvidenceView | features/cases/case-workspace-page.tsx | fetch /api/v1/cases/{}/evidence | ACTIVE |
| `features/cases/evidence/evidence-card.tsx` | 121 | Evidence card | EvidenceCard | features/cases/evidence/case-evidence-view.tsx | — | ACTIVE (DUPLICATE logic with row) |
| `features/cases/evidence/evidence-filter-bar.tsx` | 37 | Evidence search | EvidenceFilterBar | features/cases/evidence/case-evidence-view.tsx | — | ACTIVE |
| `features/cases/evidence/evidence-row.tsx` | 104 | Evidence table row | EvidenceRow | features/cases/evidence/case-evidence-view.tsx | — | ACTIVE (DUPLICATE logic with card) |
| `features/cases/map/investigation-map-view.tsx` | 166 | SVG location plot | InvestigationMapView | features/cases/case-workspace-page.tsx | — | ACTIVE |
| `features/cases/reviews/case-reviews-view.tsx` | 148 | Review decisions + claim override | CaseReviewsView | features/cases/case-workspace-page.tsx | — | ACTIVE |
| `features/cases/timeline/case-timeline.tsx` | 244 | Timeline grouped by day | CaseTimeline | features/cases/case-workspace-page.tsx | GET entityId | ACTIVE |
| `features/cases/timeline/timeline-event-icon.tsx` | 1 | Empty file (1 blank line) | — | NONE | — | DEAD CODE |
| `features/cases/timeline/timeline-event-row.tsx` | 159 | Timeline event card | TimelineEventRow | features/cases/timeline/case-timeline.tsx | — | ACTIVE |
| `features/cases/timeline/timeline-filter-bar.tsx` | 109 | Timeline search/date | TimelineFilterBar | features/cases/timeline/case-timeline.tsx | — | ACTIVE |
| `features/command-center/command-center-page.tsx` | 203 | Dashboard: 3 stat cards, 6 cases, quick actions | CommandCenterPage | app/router/router.tsx | — | ACTIVE |
| `features/command-center/foundation-preview-page.tsx` | 171 | Phase-1 design-system preview | FoundationPreviewPage | NONE | — | UNUSED (not routed; links to /graph, /cases/preview) |
| `features/hitl/hitl-decision-dialog.tsx` | 107 | Custom confirm modal | HITLDecisionDialog | features/hitl/hitl-workspace-page.tsx | — | ACTIVE (DUPLICATE dialog system) |
| `features/hitl/hitl-decision-pane.tsx` | 236 | Signals + decision form | HITLDecisionPane | features/hitl/hitl-workspace-page.tsx | — | ACTIVE |
| `features/hitl/hitl-evidence-pane.tsx` | 141 | Supporting evidence tabs | HITLEvidencePane | features/hitl/hitl-workspace-page.tsx | — | ACTIVE |
| `features/hitl/hitl-queue-filters.tsx` | 86 | Queue search + status | HITLQueueFilters | features/hitl/hitl-workspace-page.tsx | — | ACTIVE |
| `features/hitl/hitl-task-card.tsx` | 91 | Queue card | HITLTaskCard | features/hitl/hitl-workspace-page.tsx | — | ACTIVE |
| `features/hitl/hitl-workspace-page.tsx` | 262 | Review queue + two-pane review (own chrome) | HITLWorkspacePage | app/router/router.tsx | — | ACTIVE |
| `features/profile/profile-page.tsx` | 275 | Profile, PII toggle, 4 no-op action cards | ProfilePage | app/router/router.tsx | — | ACTIVE (PARTIAL: 4 no-op cards) |
| `features/reports/reports-page.tsx` | 160 | Report + court PDF export (no case layout) | ReportsPage | app/router/router.tsx | fetch /api/v1/cases/{}/report/court-pdf | ACTIVE |
| `features/settings/settings-page.tsx` | 88 | Settings with fake "Clear Local Cache" | SettingsPage | app/router/router.tsx | — | PLACEHOLDER (routed, not in nav) |
| `index.css` | 142 | Font imports, Tailwind theme mapping, focus/scrollbar | — | main.tsx | — | ACTIVE |
| `layouts/AppShell/app-shell.tsx` | 27 | Authenticated shell: sidebar + status bar + reveal modal | AppShell | app/router/router.tsx | — | ACTIVE |
| `layouts/AppShell/sidebar.tsx` | 200 | Global left nav, profile button, collapse | Sidebar | layouts/AppShell/app-shell.tsx | — | ACTIVE |
| `layouts/InvestigationShell/investigation-shell.tsx` | 111 | 3-pane case layout; <768px shows notice only | InvestigationShell | features/cases/case-graph-page.tsx, features/cases/case-workspace-page.tsx | — | ACTIVE |
| `lib/formatters.ts` | 152 | IST timestamp formatters | formatCompactTimestamp, formatDetailedTimestamp, formatDateOnly, formatTimeOnly | components/graph/TemporalSlider.tsx | — | PARTIAL (only TemporalSlider; formatTimeOnly unused; conflicts with utils.recordedTime) |
| `lib/pii.ts` | 132 | Client-side masking helpers incl. hard-coded demo names/accounts | maskPersonName, maskSensitiveText, … | components/evidence/SvgBoundingBoxOverlay.tsx, components/graph/GraphToolbar.tsx, components/graph/engine/GraphEngine.ts | — | PARTIAL (maskAccountNumber/maskImei/maskGenericPii unused; demo-data specific regexes) |
| `lib/utils.ts` | 31 | cn(); recordedDateKey/recordedTime (zone-less timestamps) | cn, recordedDateKey, recordedTime | components/evidence/ProvenanceViewer.tsx, components/evidence/SvgBoundingBoxOverlay.tsx, components/graph/GraphCanvas.tsx, components/graph/GraphLegen… (40 files) | — | ACTIVE |
| `main.tsx` | 10 | React root mount | — | NONE | — | ACTIVE |
| `services/api/auditApi.ts` | 13 | Case + global audit lists | listAuditLogs, listGlobalAuditLogs | features/audit/global-audit-page.tsx, stores/auditStore.ts | GET /cases/{}/audit | ACTIVE |
| `services/api/casesApi.ts` | 65 | Case list/detail/stats/contradictions/locations/analysis/reviews | listCases, getCaseDetails, getCaseStats, … assignCase | features/cases/analysis/case-analysis-page.tsx, features/cases/case-workspace-page.tsx, features/cases/cases-directory-page.tsx, features/cases/compon… (7 files) | GET /cases; GET /cases/{}; GET /cases/{}/contradictions; GET /cases/{}/locations; GET /cases/{}/reviews; GET /cases/{}/stats; POST /cases/{}/assign | ACTIVE (assignCase unused) |
| `services/api/claimsApi.ts` | 11 | Claim detail + claim decision | getClaimById, makeClaimDecision | features/cases/reviews/case-reviews-view.tsx, features/cases/timeline/timeline-event-row.tsx | GET /claims/{}; POST /claims/{}/decision | ACTIVE |
| `services/api/demoApi.ts` | 7 | POST /demo/tamper | tamperEvidence | NONE | POST /demo/tamper/{} | UNUSED |
| `services/api/entityApi.ts` | 7 | Entity detail | getEntityDetails | stores/graphStore.ts | GET /entities/{} | ACTIVE |
| `services/api/evidenceApi.ts` | 89 | Evidence list/detail/context/download | listEvidence, getEvidenceById, getEvidenceContext, downloadEvidence, RAW_DOWNLOAD_ROLES, (+5 unused) | features/cases/evidence/evidence-card.tsx, features/cases/evidence/evidence-row.tsx, features/hitl/hitl-evidence-pane.tsx, stores/evidenceStore.ts | GET /cases/{}/evidence; GET /evidence/{}; GET /evidence/{}/claims; GET /evidence/{}/verify; GET X-Trace-Id; POST /cases/{}/evidence; POST /evidence/{}/context/reveal; POST /evidence/{}/process; fetch {}/evidence/{}/download | PARTIAL (uploadEvidence, processEvidence, verifyEvidence, getEvidenceClaims, revealEvidenceContext unused) |
| `services/api/graphApi.ts` | 78 | Graph projection + edge detail; random x/y positions | getCaseGraph, getEdgeDetails | stores/graphStore.ts | GET /cases/{}/edge; GET /cases/{}/graph | ACTIVE |
| `services/api/hitlApi.ts` | 95 | Candidate → HITLTask mapping (fabricates priority/SLA/caseTitle) | listHITLTasks, getHITLTask, submitTaskDecision, getHITLStats, assignTask | stores/hitlStore.ts | GET /candidates/{}; GET /cases/{}/candidates; GET /cases/{}/stats; POST /candidates/{}/assign; POST /candidates/{}/decision | ACTIVE |
| `services/api/integrityApi.ts` | 24 | Integrity anchors + duplicate court-PDF call | createIntegrityAnchor, listIntegrityAnchors, getIntegrityProof, generateCourtPdf | features/cases/components/case-overview-view.tsx | GET /cases/{}/integrity/anchors; GET /cases/{}/integrity/anchors/{}/proof/{}; POST /cases/{}/integrity/anchor; POST /cases/{}/report/court-pdf | PARTIAL (getIntegrityProof, generateCourtPdf unused) |
| `services/api/real_client.ts` | 52 | fetch wrapper, token storage, ApiError | api, get, post, postForm, ApiError, TOKEN_KEY, currentUser, setSession, clearSession | features/cases/evidence/evidence-card.tsx, features/cases/evidence/evidence-row.tsx, services/api/auditApi.ts, services/api/casesApi.ts, services/api/… (16 files) | fetch {}{} | ACTIVE (no 401 handling) |
| `services/api/reportApi.ts` | 12 | Case report + duplicate court-PDF call | generateCaseReport, generateCourtPdf | features/reports/reports-page.tsx | POST /cases/{}/report; POST /cases/{}/report/court-pdf | PARTIAL (generateCourtPdf unused; page uses raw fetch) |
| `services/api/revealApi.ts` | 25 | Entity reveal; sets expiresAt = now | requestPiiReveal | stores/revealStore.ts | POST /entities/{}/reveal | ACTIVE (BROKEN expiry — see FE-003) |
| `services/api/timelineApi.ts` | 17 | Timeline events | getTimelineEvents | stores/timelineStore.ts | — | ACTIVE |
| `stores/auditStore.ts` | 149 | Case audit logs + filters (global singleton) | useAuditStore | features/cases/audit/audit-detail-drawer.tsx, features/cases/audit/audit-filter-bar.tsx, features/cases/audit/audit-integrity-header.tsx, features/cas… (4 files) | — | ACTIVE |
| `stores/authStore.ts` | 139 | Login/logout/restore; piiMasked client flag | useAuthStore, Role, UserProfile | app/providers/app-providers.tsx, components/auth/protected-route.tsx, components/security/security-status-bar.tsx, features/audit/global-audit-page.ts… (10 files) | POST /auth/login | ACTIVE |
| `stores/evidenceStore.ts` | 101 | Evidence list + search; entityScope ignored by API | useEvidenceStore | features/cases/evidence/case-evidence-view.tsx, features/cases/evidence/evidence-filter-bar.tsx | — | ACTIVE (entityScope is DEAD) |
| `stores/graphStore.ts` | 326 | Graph data, selection, filters, temporal playback | useGraphStore | components/graph/GraphCanvas.tsx, components/graph/GraphToolbar.tsx, components/graph/TemporalSlider.tsx, components/graph/drawers/EdgeDrawer.tsx, com… (15 files) | — | ACTIVE (tier/core/hover state unused) |
| `stores/hitlStore.ts` | 191 | Review queue, decision submit | useHITLStore | features/hitl/hitl-workspace-page.tsx | — | ACTIVE (assignAnalyst never called) |
| `stores/provenanceStore.ts` | 64 | Source-context modal + reveal | useProvenanceStore | components/evidence/ProvenanceViewer.tsx, components/graph/drawers/EdgeDrawer.tsx, features/cases/evidence/evidence-card.tsx, features/cases/evidence/… (6 files) | GET /evidence/{}/context${q ; POST /evidence/{}/context/reveal | ACTIVE |
| `stores/revealStore.ts` | 123 | Reveal modal + session reveals (hard-coded requester fields) | useRevealStore | components/graph/drawers/EntityDrawer.tsx, components/intelligence/reveal-identity-modal.tsx | — | ACTIVE |
| `stores/timelineStore.ts` | 120 | Timeline events + filters | useTimelineStore | features/cases/timeline/case-timeline.tsx, features/cases/timeline/timeline-filter-bar.tsx | — | ACTIVE |
| `stores/uiStore.ts` | 24 | Sidebar + case-info panel collapse | useUIStore | features/cases/case-workspace-page.tsx, layouts/AppShell/sidebar.tsx | — | ACTIVE |
| `styles/tokens.css` | 156 | Design tokens (light palette despite "Dark Cinematic" header) | — | index.css | — | ACTIVE |
| `styles/typography.css` | 33 | Base typography | — | index.css | — | ACTIVE |
| `types/alert.ts` | 38 | Alert types (no feature) | AlertItem… | NONE | — | UNUSED |
| `types/audit.ts` | 32 | Audit entry types | AuditLogEntry, AuditActionType | features/cases/audit/audit-event-card.tsx, features/cases/audit/audit-filter-bar.tsx, stores/auditStore.ts | — | ACTIVE |
| `types/case.ts` | 28 | Case types | CaseSummary, CaseDetail, CaseStats | features/cases/case-workspace-page.tsx, features/cases/cases-directory-page.tsx, features/cases/components/case-detail-sidebar.tsx, features/cases/com… (8 files) | — | ACTIVE (CaseStats only used by unused grid) |
| `types/entity.ts` | 234 | Entity/edge/provenance types | GraphNodeAttributes, … RELATIONSHIP_TYPES | components/evidence/SvgBoundingBoxOverlay.tsx, components/graph/GraphToolbar.tsx, components/graph/engine/GraphEngine.ts, components/graph/filters/Ent… (11 files) | — | PARTIAL (ProvenanceRecord, ChainOfCustodyEntry, AnalystSignoff, BoundingBox, Contradiction*, EntitySummary unused) |
| `types/evidence.ts` | 46 | Evidence item types | EvidenceItem | features/cases/evidence/evidence-card.tsx, features/cases/evidence/evidence-row.tsx, services/api/evidenceApi.ts, stores/evidenceStore.ts | — | ACTIVE |
| `types/hitl.ts` | 95 | Review task types | HITLTask… | features/hitl/hitl-decision-dialog.tsx, features/hitl/hitl-decision-pane.tsx, features/hitl/hitl-evidence-pane.tsx, features/hitl/hitl-queue-filters.t… (8 files) | — | ACTIVE |
| `types/note.ts` | 45 | Analyst note types (no feature) | AnalystNote… | NONE | — | UNUSED |
| `types/reveal.ts` | 30 | Reveal request/result | RevealRequest, RevealResult | services/api/revealApi.ts, stores/revealStore.ts | — | ACTIVE |
| `types/timeline.ts` | 30 | Timeline types | TimelineEvent… | features/cases/timeline/case-timeline.tsx, features/cases/timeline/timeline-event-row.tsx, services/api/timelineApi.ts, stores/timelineStore.ts | — | ACTIVE |

## 3. Line coverage (honest)

Every file was read completely. `GraphEngine.ts` (1,091 lines) was read in three ranges (1–400, 400–750, 750–1,092);
all other files in one pass. `profile-page.tsx` was read at HEAD via `git show` because the working copy changed mid-audit.

| File | Total lines | Ranges read |
| --- | ---: | --- |
| `App.tsx` | 13 | 1–13 (full) |
| `app/providers/app-providers.tsx` | 23 | 1–23 (full) |
| `app/router/router.tsx` | 51 | 1–51 (full) |
| `components/auth/protected-route.tsx` | 22 | 1–22 (full) |
| `components/evidence/ProvenanceViewer.tsx` | 102 | 1–102 (full) |
| `components/evidence/SvgBoundingBoxOverlay.tsx` | 142 | 1–142 (full) |
| `components/graph/GraphCanvas.tsx` | 166 | 1–166 (full) |
| `components/graph/GraphLegend.tsx` | 138 | 1–138 (full) |
| `components/graph/GraphToolbar.tsx` | 336 | 1–336 (full) |
| `components/graph/TemporalSlider.tsx` | 181 | 1–181 (full) |
| `components/graph/drawers/EdgeDrawer.tsx` | 140 | 1–140 (full) |
| `components/graph/drawers/EmptyDrawer.tsx` | 54 | 1–54 (full) |
| `components/graph/drawers/EntityDrawer.tsx` | 175 | 1–175 (full) |
| `components/graph/engine/GraphEngine.ts` | 1091 | 1–400, 400–749, 750–1091 (full, three ranges) |
| `components/graph/filters/ConfidenceRangeFilter.tsx` | 91 | 1–91 (full) |
| `components/graph/filters/DateRangeFilter.tsx` | 158 | 1–158 (full) |
| `components/graph/filters/EntityTypeFilter.tsx` | 82 | 1–82 (full) |
| `components/graph/filters/GraphFilterPanel.tsx` | 144 | 1–144 (full) |
| `components/graph/filters/RelationshipTypeFilter.tsx` | 73 | 1–73 (full) |
| `components/graph/filters/TierFilter.tsx` | 84 | 1–84 (full) |
| `components/intelligence/confidence-meter.tsx` | 63 | 1–63 (full) |
| `components/intelligence/entity-badge.tsx` | 41 | 1–41 (full) |
| `components/intelligence/evidence-tier-badge.tsx` | 60 | 1–60 (full) |
| `components/intelligence/pii-field.tsx` | 101 | 1–101 (full) |
| `components/intelligence/relationship-badge.tsx` | 55 | 1–55 (full) |
| `components/intelligence/reveal-identity-modal.tsx` | 366 | 1–366 (full) |
| `components/security/security-status-bar.tsx` | 101 | 1–101 (full) |
| `components/ui/badge.tsx` | 46 | 1–46 (full) |
| `components/ui/button.tsx` | 95 | 1–95 (full) |
| `components/ui/checkbox.tsx` | 28 | 1–28 (full) |
| `components/ui/dialog.tsx` | 116 | 1–116 (full) |
| `components/ui/separator.tsx` | 23 | 1–23 (full) |
| `components/ui/status-dot.tsx` | 47 | 1–47 (full) |
| `components/ui/tabs.tsx` | 55 | 1–55 (full) |
| `components/ui/tooltip.tsx` | 27 | 1–27 (full) |
| `constants/evidenceTiers.ts` | 96 | 1–96 (full) |
| `constants/navigation.ts` | 27 | 1–27 (full) |
| `features/audit/global-audit-page.tsx` | 142 | 1–142 (full) |
| `features/auth/login-page.tsx` | 146 | 1–146 (full) |
| `features/cases/analysis/case-analysis-page.tsx` | 169 | 1–169 (full) |
| `features/cases/audit/audit-detail-drawer.tsx` | 247 | 1–247 (full) |
| `features/cases/audit/audit-event-card.tsx` | 254 | 1–254 (full) |
| `features/cases/audit/audit-filter-bar.tsx` | 119 | 1–119 (full) |
| `features/cases/audit/audit-integrity-header.tsx` | 75 | 1–75 (full) |
| `features/cases/audit/case-audit-view.tsx` | 161 | 1–161 (full) |
| `features/cases/case-graph-page.tsx` | 220 | 1–220 (full) |
| `features/cases/case-workspace-page.tsx` | 242 | 1–242 (full) |
| `features/cases/cases-directory-page.tsx` | 153 | 1–153 (full) |
| `features/cases/components/case-detail-sidebar.tsx` | 153 | 1–153 (full) |
| `features/cases/components/case-header.tsx` | 70 | 1–70 (full) |
| `features/cases/components/case-overview-view.tsx` | 213 | 1–213 (full) |
| `features/cases/components/case-placeholder-view.tsx` | 148 | 1–148 (full) |
| `features/cases/components/case-stats-grid.tsx` | 49 | 1–49 (full) |
| `features/cases/evidence/case-evidence-view.tsx` | 185 | 1–185 (full) |
| `features/cases/evidence/evidence-card.tsx` | 121 | 1–121 (full) |
| `features/cases/evidence/evidence-filter-bar.tsx` | 37 | 1–37 (full) |
| `features/cases/evidence/evidence-row.tsx` | 104 | 1–104 (full) |
| `features/cases/map/investigation-map-view.tsx` | 166 | 1–166 (full) |
| `features/cases/reviews/case-reviews-view.tsx` | 148 | 1–148 (full) |
| `features/cases/timeline/case-timeline.tsx` | 244 | 1–244 (full) |
| `features/cases/timeline/timeline-event-icon.tsx` | 1 | 1–1 (full) |
| `features/cases/timeline/timeline-event-row.tsx` | 159 | 1–159 (full) |
| `features/cases/timeline/timeline-filter-bar.tsx` | 109 | 1–109 (full) |
| `features/command-center/command-center-page.tsx` | 203 | 1–203 (full) |
| `features/command-center/foundation-preview-page.tsx` | 171 | 1–171 (full) |
| `features/hitl/hitl-decision-dialog.tsx` | 107 | 1–107 (full) |
| `features/hitl/hitl-decision-pane.tsx` | 236 | 1–236 (full) |
| `features/hitl/hitl-evidence-pane.tsx` | 141 | 1–141 (full) |
| `features/hitl/hitl-queue-filters.tsx` | 86 | 1–86 (full) |
| `features/hitl/hitl-task-card.tsx` | 91 | 1–91 (full) |
| `features/hitl/hitl-workspace-page.tsx` | 262 | 1–262 (full) |
| `features/profile/profile-page.tsx` | 275 | 1–275 (full, via `git show HEAD:`) |
| `features/reports/reports-page.tsx` | 160 | 1–160 (full) |
| `features/settings/settings-page.tsx` | 88 | 1–88 (full) |
| `index.css` | 142 | 1–142 (full) |
| `layouts/AppShell/app-shell.tsx` | 27 | 1–27 (full) |
| `layouts/AppShell/sidebar.tsx` | 200 | 1–200 (full) |
| `layouts/InvestigationShell/investigation-shell.tsx` | 111 | 1–111 (full) |
| `lib/formatters.ts` | 152 | 1–152 (full) |
| `lib/pii.ts` | 132 | 1–132 (full) |
| `lib/utils.ts` | 31 | 1–31 (full) |
| `main.tsx` | 10 | 1–10 (full) |
| `services/api/auditApi.ts` | 13 | 1–13 (full) |
| `services/api/casesApi.ts` | 65 | 1–65 (full) |
| `services/api/claimsApi.ts` | 11 | 1–11 (full) |
| `services/api/demoApi.ts` | 7 | 1–7 (full) |
| `services/api/entityApi.ts` | 7 | 1–7 (full) |
| `services/api/evidenceApi.ts` | 89 | 1–89 (full) |
| `services/api/graphApi.ts` | 78 | 1–78 (full) |
| `services/api/hitlApi.ts` | 95 | 1–95 (full) |
| `services/api/integrityApi.ts` | 24 | 1–24 (full) |
| `services/api/real_client.ts` | 52 | 1–52 (full) |
| `services/api/reportApi.ts` | 12 | 1–12 (full) |
| `services/api/revealApi.ts` | 25 | 1–25 (full) |
| `services/api/timelineApi.ts` | 17 | 1–17 (full) |
| `stores/auditStore.ts` | 149 | 1–149 (full) |
| `stores/authStore.ts` | 139 | 1–139 (full) |
| `stores/evidenceStore.ts` | 101 | 1–101 (full) |
| `stores/graphStore.ts` | 326 | 1–326 (full) |
| `stores/hitlStore.ts` | 191 | 1–191 (full) |
| `stores/provenanceStore.ts` | 64 | 1–64 (full) |
| `stores/revealStore.ts` | 123 | 1–123 (full) |
| `stores/timelineStore.ts` | 120 | 1–120 (full) |
| `stores/uiStore.ts` | 24 | 1–24 (full) |
| `styles/tokens.css` | 156 | 1–156 (full) |
| `styles/typography.css` | 33 | 1–33 (full) |
| `types/alert.ts` | 38 | 1–38 (full) |
| `types/audit.ts` | 32 | 1–32 (full) |
| `types/case.ts` | 28 | 1–28 (full) |
| `types/entity.ts` | 234 | 1–234 (full) |
| `types/evidence.ts` | 46 | 1–46 (full) |
| `types/hitl.ts` | 95 | 1–95 (full) |
| `types/note.ts` | 45 | 1–45 (full) |
| `types/reveal.ts` | 30 | 1–30 (full) |
| `types/timeline.ts` | 30 | 1–30 (full) |

## 4. Unused files (grep-verified: not reachable from `src/main.tsx`)

| File | Lines | Evidence |
| --- | ---: | --- |
| `features/command-center/foundation-preview-page.tsx` | 171 | No importer. Not in `router.tsx`. Links to `/graph` and `/cases/preview`, neither of which is a route. |
| `features/cases/components/case-placeholder-view.tsx` | 148 | No importer. `case-workspace-page.tsx:33` defines its own inline `CasePlaceholderView`. Contains banned wording ("Immutable SHA-256 chained audit logs", "Direct chain-of-custody cryptographic verification", lines 44, 63, 66). |
| `features/cases/components/case-stats-grid.tsx` | 49 | No importer. Its only consumer type `CaseStats` (`types/case.ts:7`) is therefore unused too. |
| `features/cases/timeline/timeline-event-icon.tsx` | 1 | Empty file (one blank line). |
| `components/evidence/SvgBoundingBoxOverlay.tsx` | 142 | No importer. The API returns no bounding boxes. |
| `components/graph/filters/TierFilter.tsx` | 84 | No importer (removed from `GraphFilterPanel.tsx:116` per DEF-020); still reads `e.evidenceTier`, which no edge has. |
| `components/intelligence/evidence-tier-badge.tsx` | 60 | Only importer is the unused foundation preview. |
| `services/api/demoApi.ts` | 7 | No importer (`tamperEvidence`). |
| `types/alert.ts` | 38 | No importer. |
| `types/note.ts` | 45 | No importer (no notes feature, although `/cases/:id/notes` is routed). |

Unused exports inside reachable files (grep-verified, zero references besides the definition):
`ALL_NAV_ITEMS` (navigation.ts:27), `assignCase` (casesApi.ts:62), `formatTimeOnly` (formatters.ts:131),
`generateCourtPdf` (integrityApi.ts:19 **and** reportApi.ts:9 — both unused; the page uses raw `fetch`),
`getIntegrityProof` (integrityApi.ts:14), `uploadEvidence`, `processEvidence`, `verifyEvidence`, `getEvidenceClaims`,
`revealEvidenceContext` (evidenceApi.ts:14–55), `maskAccountNumber`, `maskImei`, `maskGenericPii`, `maskIpAddress` (pii.ts),
store actions never called from UI: `assignAnalyst`, `toggleLayout`, `setHoveredNode/Edge`, `toggleShowCoreConnectionsOnly`,
`setShowCoreConnectionsOnly`, `selectEvidence`, `selectEvent`, `selectLog`; GraphEngine `fitToExtent`, `startLayout`,
`isLayoutActive`; `CANONICAL_NODE_POSITIONS` matches only mock ids (`E-PERS-01` …) that the API never returns.
Unused types in `types/entity.ts`: `EntitySummary`, `EntityIdentifier` (only via reveal types), `RelationshipSummary`,
`ContradictionSource`, `ContradictionDetails`, `BoundingBox` (only unused overlay), `AnalystSignoff`, `ChainOfCustodyEntry`, `ProvenanceRecord`.

**Dead code inside active files**
- `GraphEngine.ts:56-84` `CANONICAL_NODE_POSITIONS` (mock ids), `:191-193` special-case `"E-CYB-01"`, `:600-641` special-case edge `"R-17"` ("MAINTAINED AT"), `:775-801` custom label for `E-CYB-01` with fallback text `"IMEI 3589********102"`, `:1031-1042` re-anchor on `E-PERS-01`. `organizeMap()` therefore never moves a real node.
- `GraphEngine.ts:546-579` tier-2/3/6 edge overlays and `:582-598` contradiction badge: no edge carries `evidenceTier` or `hasContradiction`.
- `audit-event-card.tsx:35-42` and `audit-detail-drawer.tsx:35-42` `maskIpAddress` (unused; IP is the constant `"(No IP Logged)"`).
- `audit-event-card.tsx:73-100` action labels for actions the backend never emits (`VIEW_GRAPH`, `FILTER_GRAPH`, `EXPAND_NODE`, `VIEW_EVIDENCE`, `UPDATE_TIER`, `CREATE/UPDATE/DELETE_NOTE`); backend emits `GRAPH_VIEW`, `EDGE_VIEW`, `EVIDENCE_DOWNLOAD`, … which fall to the default.
- `GraphFilterPanel.tsx:84-104` "Conflicting Clues Only" label with `htmlFor` but no input.
- `evidence-row.tsx:25-26`, `evidence-card.tsx:25-26`: `caseId`, `onScopeEntity`, `currentEntityScope`, `navigate` unused; `evidenceStore.entityScope` is sent nowhere (`evidenceApi.ts:4` ignores `_filter`).
- `EntityDrawer.tsx:23-28` `onFocusNode`, `navigate`, `nodes`, `isExpanding` unused.
- `case-timeline.tsx:26` `events` unused; `EdgeDrawer.tsx:12` `showAdvanced` unused.
- `hitlApi.ts:19-21,59` fabricated `caseTitle`, `priority: "HIGH"`, `slaDeadline = now+24h` (never displayed, but carried in state).

## 5. Duplicate component systems

| Concern | Implementations (file:line) | Notes |
| --- | --- | --- |
| Case navigation | `case-workspace-page.tsx:21` `CASE_NAV_TABS` (9 items) · `case-graph-page.tsx:29` `CASE_NAV_ITEMS` (5 items) · `case-overview-view.tsx:95-121` "Investigation Modules" buttons · `case-header.tsx:52-66` "Investigation Map"/"Export Reports" · dashboard/directory "Graph" buttons · `hitl-workspace-page.tsx:128-139` "Graph View"/"Case Overview" | Labels disagree: "Investigation Map" = graph, "Location Map" = map, but `investigation-map-view.tsx:61` titles the map "Investigation Map". |
| Case page chrome | `CaseWorkspacePage` (InvestigationShell + CaseHeader + sidebar) · `CaseGraphPage` (InvestigationShell + own header) · `HITLWorkspacePage` (own header, `h-[calc(100vh-3.5rem)]`) · `ReportsPage` (no case chrome) | Four different case layouts. |
| Placeholder view | inline `CasePlaceholderView` `case-workspace-page.tsx:33` · `components/case-placeholder-view.tsx` (unused) | |
| Modal / dialog | Radix `components/ui/dialog.tsx` (reveal modal only) · custom overlay `hitl-decision-dialog.tsx:26` · full-screen overlay `ProvenanceViewer.tsx:16,33` · slide-over `audit-detail-drawer.tsx:94-106` · `window.prompt` (`evidence-card.tsx:35`, `evidence-row.tsx:35`, `case-reviews-view.tsx:31`) | Only the Radix one has focus trap / Escape / `aria-modal`. |
| "Reason" capture | reveal modal (≥15 chars, client) · HITL pane (≥15) · provenance reveal (any non-empty) · `window.prompt` (≥5) | Server minimums: decision 3, reveal/context/download 5 (`schemas.py:32-50`). |
| Audit UI | case: `auditStore` + `AuditEventCard` + `AuditDetailDrawer` · global: `global-audit-page.tsx` local state, own row markup, own `ACTION_TONES` | Two tone maps; global one uses invalid tone `"green"`. |
| Timestamp formatting | `lib/utils.ts:18-31` (zone-less, DEF-079) · `lib/formatters.ts` (forces IST) · `audit-event-card.tsx:49` & `audit-detail-drawer.tsx:49` local `formatDetailedTimestamp` (browser zone; drawer appends " IST") · `toLocaleDateString("en-IN")` in 9 places · `substring(0,10/19)` in 5 places | Same instant renders differently per page. |
| PII masking | `lib/pii.ts` · local `maskPhoneNumbersInText` in `audit-event-card.tsx:44` and `audit-detail-drawer.tsx:44` (different regex) · server masking | Client masking duplicates server policy with hard-coded demo names (`pii.ts:111-128`). |
| Entity type → icon/colour | `GraphToolbar.tsx:36` `POLE_ICONS` · `EntityDrawer.tsx:11` `getEntityIcon` · `entity-badge.tsx:12` `ENTITY_TYPE_CONFIG` · `GraphEngine.ts:47` `ENTITY_COLORS` · `GraphLegend.tsx:58-81` hex swatches · `case-graph-page.tsx:146-149` emoji legend | Legend colours contradict the engine (FE-008). |
| Entity-type filter | `GraphToolbar.tsx:219-282` dropdown (2xl only) · `EntityTypeFilter.tsx` in filter panel | Same state, two controls. |
| Evidence download / copy | `evidence-card.tsx:31-52` and `evidence-row.tsx:31-52` (identical handlers, `formatFileSize` duplicated) | |
| Upload | `evidenceApi.uploadEvidence` (unused) · raw `fetch` in `case-evidence-view.tsx:95-118` | |
| Court PDF | `integrityApi.generateCourtPdf` · `reportApi.generateCourtPdf` · raw `fetch` `reports-page.tsx:48` | Two unused service functions. |
| Loading/empty/error states | ≥8 bespoke spinner/skeleton blocks; no shared `EmptyState`/`ErrorState` | |
| Page header styles | `font-mono uppercase` headers (directory, map, analysis, reviews, global audit, profile) vs sentence-case headers (dashboard, reports, timeline, audit) | |

## 6. Oversized components / modules

| File | Lines | Why it matters |
| --- | ---: | --- |
| `components/graph/engine/GraphEngine.ts` | 1,091 | Renderer, filtering, overlay drawing, hover HUD, camera, mock layout in one class; ~25 % mock-specific dead code; 49 hex literals. |
| `components/intelligence/reveal-identity-modal.tsx` | 366 | Form, presets, fake clearance selector, success view in one file. |
| `components/graph/GraphToolbar.tsx` | 336 | Duplicate type filter + search autocomplete inline. |
| `stores/graphStore.ts` | 326 | Data, selection, filters, playback and unused tier/core state in one store. |
| `features/profile/profile-page.tsx` | 275 | 4 no-op action cards. |
| `features/hitl/hitl-workspace-page.tsx` | 262 | Queue + review + stats + dialog orchestration. |
| `features/cases/audit/audit-event-card.tsx` | 254 | Half of it is dead mapping/masking code. |
| `features/cases/audit/audit-detail-drawer.tsx` | 247 | 19 unused imports; duplicated helpers. |
| `features/cases/timeline/case-timeline.tsx` | 244 | |
| `features/cases/case-workspace-page.tsx` | 242 | Tab routing by `pathname.endsWith`, inline placeholder, footer. |

## 7. `any` hotspots (86 occurrences of `: any`, `as any`, `any[]`, `<any>`)

case-overview-view 8 · casesApi 7 · evidenceApi 6 · case-analysis-page 6 · hitlApi 5 · reportApi 4 · integrityApi 4 ·
hitl-evidence-pane 4 · case-reviews-view 4 · global-audit-page 4 · types/hitl 3 · graphStore 3 · graphApi 3 · others ≤2.
Every service returns `ApiResponse<any>` for stats, analysis, locations, reviews, contradictions, anchors, claims, edge,
entity; `real_client.ts:27,46-48` default `T = any`. Combined with `strict` off, a backend field rename cannot fail the build.
`ApiResponse.meta` is fabricated in every service (`requestId: "req"`, `securityClassification: "REAL"`, `durationMs: 0`).

## 8. Hard-coded colours vs tokens

- **Hex/rgba literals (76):** `GraphEngine.ts` 49 (node/edge/tier/halo/HUD colours duplicating tokens), `SvgBoundingBoxOverlay.tsx` 12 (unused),
  `investigation-map-view.tsx:116-117` 6, `GraphLegend.tsx:59-79` 6 (`bg-[#17324D]` …), `graphApi.ts:29,52` 2, `audit-detail-drawer.tsx:217` 1.
  `index.css:19` claims "never a raw hex value".
- **Raw Tailwind palette classes bypassing tokens (113):** profile-page 26, reports-page 12, reveal-identity-modal 12, case-analysis-page 9,
  case-overview-view 8, command-center-page 7, case-reviews-view 7, audit-detail-drawer 5, global-audit-page 4, map 3, login 3, ProvenanceViewer 3, others.
  Typical: `text-emerald-400`, `text-amber-400`, `text-red-400`, `bg-red-500/10` — these are tuned for dark UIs and have low contrast on the light `--background: #F6F7F5`.
- **Classes that reference tokens that do not exist** (Tailwind emits nothing):
  `bg-bg-base` ×9 files (app-providers, directory, map, analysis, reviews, reports, global audit, profile, login), `bg-surface-base` (login inputs),
  `teal-primary` ×16 lines in 11 files, `shadow-card` (GraphLegend). With `tailwind-merge`, `bg-teal-primary` *replaces* the Button's
  `bg-electric-blue` (verified: `twMerge("bg-electric-blue text-white … bg-teal-primary text-white")` → `"… bg-teal-primary text-white"`), so the active
  "Pause"/"Filter" toolbar buttons render white text on no background (`GraphToolbar.tsx:155,186`).
- `animate-in`, `fade-in`, `slide-in-from-*`, `zoom-in-95` used in 4 files but no `tailwindcss-animate`/`tw-animate-css` is installed — no-ops.
- Token naming misleads: `--electric-blue` is teal `#287C7A`; `tokens.css:3` says "Dark Cinematic" for a light palette; `--court-purple`.
- Invalid Badge tones: `"green"` in `case-reviews-view.tsx:51` and `global-audit-page.tsx:10,12` (cast `as any`) → unstyled badge.

## 9. Text shown to users that is not derived from data

| file:line | Text | Problem |
| --- | --- | --- |
| command-center-page.tsx:67 | "SYSTEM ONLINE" | Static; no health call. |
| case-header.tsx:45 | "Active Investigation" (+ verified dot) | Static; the case has no status field read. |
| case-workspace-page.tsx:219 | "PII Masking: Strict" | Static. |
| case-workspace-page.tsx:232 | "Secure Integration" | Static. |
| security-status-bar.tsx:70 | "PII MASKED (STRICT)" / "PII REVEALED" | Driven by a client flag toggled on the profile page; has no effect on masking (FE-012). |
| hitl-workspace-page.tsx:98,101,104 | "Evidentiary Arbitration", "STAGE 4 VALIDATION", "CONFIDENTIAL // LEA SENSITIVE" | Static badges, not case classification. |
| hitl-workspace-page.tsx:161-177 | Pending / Critical Contradictions / Resolved = `?? 0` | Shows 0 when `/stats` is 403 (ANALYST, AUDITOR). |
| hitl-workspace-page.tsx:223-225 | "Arbitration Queue Clear … tier elevation requests" | Also shown when the queue failed to load. |
| hitl-decision-pane.tsx:65,72 | "Pipeline Phase 4", "OPTIONAL AUDIT" | Static / invented category. |
| hitl-decision-pane.tsx:99 | "Officer: {reviewer_id} ({decision})" | `officerBadge` is mapped to the decision (`hitlApi.ts:52`). |
| case-timeline.tsx:90,106 | "verified events", "across Jaipur, Mumbai, and Dubai" | Candidate claims; place list hard-coded. |
| case-timeline.tsx:180-181 | "CDR intercepts", "resetting min tier requirements" | No tier filter exists. |
| GraphLegend.tsx:94-95,133 | "T5 — Cryptographic Reference (BSA)", "T4 — Verified Records (Bank/CDR)", "Every connection is verified against original evidence records." | No edge has a tier; contradicts `EVIDENCE_TIER_CONFIG`; violates §16. |
| GraphLegend.tsx:58-81 | colour swatches | Do not match `GraphEngine.ts:47-54`. |
| case-graph-page.tsx:87 | "Case" | Should be the case title (`caseTitle` is in the store). |
| case-graph-page.tsx:128 | "Supervisor clearance required for dossier export" | Always restricted regardless of role; export exists on Reports. |
| EmptyDrawer.tsx:46 | "Graph Analytics Enabled" | Static. |
| EntityDrawer.tsx:118 | "+N Classified Cases" | Server field is `restricted_case_count`. |
| case-audit-view.tsx:138-139 | "Blocks", "Sequence Linked" | Contradicts the notice two cards above ("events are not hash-chained"). |
| audit-integrity-header.tsx:44 | "LIVE" | No polling. |
| audit-filter-bar.tsx:113 | "Oldest First (Genesis)" | Blockchain wording (§16). |
| audit-event-card.tsx:147-149, audit-detail-drawer.tsx:88-90 | "USER"/"SYSTEM", "IP: (No IP Logged)", "Badge/ID" = actor id | Constants presented as record fields. |
| audit-detail-drawer.tsx:64 | "… IST" suffix | Time is formatted in the browser zone. |
| case-detail-sidebar.tsx:72,143-146 | "Owner / Lead", "Controlled Case File … fully logged" | Static. |
| case-overview-view.tsx:207 | "All sensitive attributes masked per PII protocols." | Static. |
| reveal-identity-modal.tsx:125,129,236,240-244,278,298 | "Statutory Identity Unmasking Gateway", "BNSS §91 Gate", "{officerName} () • {officerRole}" (both empty), clearance Level 1–3 (not sent), "Denial logged permanently … under Officer." | Legal claims + broken interpolation. |
| reveal-identity-modal.tsx:36 | preset "…case-filed synthetic bank statement…" | Demo-specific. |
| settings-page.tsx:13,27,68 | "refreshed to factory defaults", "Configure local environment variables", "caches graph representations and offline evidence slices" | Nothing is cached or reset. |
| login-page.tsx:56,133,135,141-142 | "Tactical Workstation", "Connection Secure", "v2.0 (Verified)", "Authorized SIH 2026 personnel only", demo credentials | Static claims; credentials on a public page. |
| sidebar.tsx:123 | "Investigation Platform" | Fine as tagline (low). |
| profile-page.tsx:24-29 | role descriptions | Hard-coded, partly wrong ("Reviewer: … reverse candidates" — REVERSE is a claim decision). |
| revealStore.ts:81-84 | requester "INV-DEMO"/"Investigator"/clearance 3 | Not sent, but kept in state. |
| hitlApi.ts:19-24 | "Case {id}", "Candidate Match: A <-> B", "Automated match generated by …" | Template text, acceptable but `caseTitle` is fake. |

## 10. Dead or misleading routes (`router.tsx`)

| Route / link | Behaviour |
| --- | --- |
| `cases/:caseId/notes` (router.tsx:39) | Renders `CaseWorkspacePage`; `pathname.endsWith` has no `notes` branch → silently shows Overview. `audit-event-card.tsx:138` links here. |
| `cases/:caseId/report` (router.tsx:40) | Duplicate of `/reports`. |
| `settings` (router.tsx:46) | Not in navigation; reachable only from a profile action card; page is a placeholder. |
| `*` (router.tsx:48) | Every unknown URL (`/reports`, `/review`, `/evidence`, typos) redirects to `/command-center` with no message. |
| `/cases/:id?tab=<x>` | Unknown `tab` → "Feature currently unavailable in UI" placeholder (case-workspace-page.tsx:66,191). |
| Links with ignored params | `/graph?entityId=` (audit-event-card.tsx:132), `/evidence?evidenceId=` (:135) — the target pages never read them. |
| Foundation preview links | `/graph`, `/cases/preview` (foundation-preview-page.tsx:139,142) — not routes (file is unreachable anyway). |
| `/login` state.from | `ProtectedRoute` stores the intended URL (protected-route.tsx:18) but `login-page.tsx:28` always `navigate("/")`. |

## 11. Unused `package.json` dependencies (grep-verified: no import in `src`)

| Package | Section | Note |
| --- | --- | --- |
| `@radix-ui/react-dropdown-menu` | dependencies | 0 imports |
| `@radix-ui/react-radio-group` | dependencies | 0 imports |
| `@radix-ui/react-select` | dependencies | 0 imports (native `<select>` used instead) |
| `@radix-ui/react-switch` | dependencies | 0 imports (profile hand-rolls a switch) |
| `graphology-layout-forceatlas2` | dependencies | 0 imports — "Organize Map" uses mock coordinates instead (FE-006) |
| `autoprefixer`, `postcss` | devDependencies | No `postcss.config.*`; Tailwind 4 runs through `@tailwindcss/vite`. |

All other dependencies are imported (fontsource ×3 via index.css, radix checkbox/dialog/slot/tabs/tooltip, cva, clsx,
graphology, sigma, lucide-react, react-router-dom, tailwind-merge, zustand).
