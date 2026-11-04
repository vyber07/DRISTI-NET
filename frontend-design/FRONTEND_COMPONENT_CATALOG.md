# Frontend component catalogue

Shared components that pages are built from after the redesign. Use these before writing a new one.

## Layout: `components/layout/page.tsx`
| Component | Use | Notes |
|---|---|---|
| `PageHeader` | Top of a global page (Home, Cases, Account) | Breadcrumb, H1, one-line description, actions on the right |
| `PageBody` | Scrollable content column under `PageHeader` | `max-w-6xl` (`wide` → `max-w-7xl`), 16/24 px gutters |
| `CaseTabBody` | Body of one case tab | H2 title (the case title is the H1), description, actions |
| `Section` | A bordered card with a title row | `id` links the heading for `aria-labelledby` |
| `FactList` | Label/value pairs | `<dl>`, 1–4 columns |
| `Breadcrumbs` | Location within the app | `aria-current="page"` on the last item |
| `LoadingState` / `EmptyState` / `ErrorState` / `DeniedState` | The four non-data states | Error shows the server message, trace ID and Retry; Denied shows the server's reason and a way back (`data-testid="access-denied"`) |

## Case workspace
| Component | File | Notes |
|---|---|---|
| `CaseLayout` | `features/cases/case-layout.tsx` | Loads the case once; header, breadcrumb, tab row (`nav[aria-label="Case sections"]`) and `<Outlet/>`; mounts the source viewer once |
| `CaseProvider` / `useCase()` | `features/cases/case-context.tsx` | `caseId`, `caseData`, `personName(userId)`, `reload()`. A reload of the same case keeps the tabs mounted |
| `CaseTable` | `features/cases/case-table.tsx` | Sortable (`aria-sort`); first cell is a link; the row is clickable too |

## UI primitives: `components/ui/`
| Component | Notes |
|---|---|
| `Button` | Variants `primary` (one per view), `secondary`, `ghost`, `destructive`, `restricted`. Icon-only buttons need `aria-label` |
| `Badge` | Tones; amber and orange use their dark text colours for contrast |
| `StatusBadge` | **The only place** that maps evidence and review state codes to a label, icon, tone and hint. The raw code is kept in `title` and `data-status` |
| `ReasonDialog` | Every audited action that needs a reason (download original, review decision, reversal, claim decision). Minimum length checked with a visible error; the dialog stays open on a server error; the reason is never stored client-side |
| `Dialog` (Radix) | Base for dialogs; sized to fit small screens |

## Domain components
| Component | File | Notes |
|---|---|---|
| `EvidenceDetailDrawer` | `features/cases/evidence/evidence-detail-drawer.tsx` | Summary, integrity (copy, Verify), scan and jobs, claims → exact source |
| `ProvenanceViewer` | `components/evidence/ProvenanceViewer.tsx` | Source lines with the cited line highlighted (`data-hit`, `data-line`); reveal with a reason for permitted roles |
| `ReviewQueuePage` / `CandidateDetail` | `features/review/review-page.tsx` | Queue filters, side-by-side `CompareTable`, signals, decision and history |
| `SourcePane` | `features/review/source-pane.tsx` | A candidate's cited files and their opening lines |
| Graph (`GraphCanvas`, `GraphEngine`, drawers, `GraphLegend`, `TemporalSlider`) | `components/graph/` | Unchanged internals except: multigraph, ForceAtlas2 layout, legend colours from `ENTITY_COLORS`, drawers fill their panel |

## Helpers
| Helper | File | Notes |
|---|---|---|
| `can(role, capability)`, `deniedReason()`, `roleLabel()` | `lib/permissions.ts` | Mirrors the backend's `require_roles`. A UI convenience only; the server decides |
| `formatDate` / `formatDateTime` / `formatBytes` | `case-table.tsx`, `evidence/evidence-format.ts` | `en-IN` display; recorded event times use `lib/utils.recordedTime` (no zone conversion) |

## Removed (do not reintroduce)
- `InvestigationShell`;
- `CaseWorkspacePage` and its `case-header`, `case-detail-sidebar`, `case-placeholder-view` and `case-stats-grid`;
- the HITL page and its store and API (replaced by `features/review`);
- the evidence card, row, filter bar and store;
- `SettingsPage`;
- `FoundationPreviewPage`.
