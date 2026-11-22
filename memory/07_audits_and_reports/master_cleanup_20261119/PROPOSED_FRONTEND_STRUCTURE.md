# DRISTI-NET — Proposed Feature-Oriented Frontend Architecture

**Audit Date:** 2026-11-19  
**Status:** Proposal for User Review & Approval  

---

## Candidate Future Structure (Feature-Oriented)

```
apps/web/src/
├── app/
│   ├── routes/                  # Route configuration & route guards
│   ├── providers/               # QueryClient, ThemeProvider, ToastProvider
│   └── layouts/                 # AppShell, Sidebar, Header
│
├── features/                    # Feature domain modules (Co-located UI, hooks, API)
│   ├── auth/                    # Login, session guard, token storage
│   ├── profile/                 # Profile page, password change modal, active sessions
│   ├── cases/                   # Case list, case details, case team assignments
│   ├── evidence/                # Evidence list, chunked upload drawer, quarantine inspector
│   ├── graph/                   # Sigma.js canvas, filters, toolbars, node/edge drawers
│   ├── timeline/                # Historical temporal event sequence
│   ├── map/                     # Geocoded location points projection
│   ├── reviews/                 # HITL candidate arbitration workspace
│   ├── audit/                   # Case audit log & global cross-case audit view
│   └── reports/                 # Evidence dossier PDF preview and download
│
├── components/                  # Shared presentation components
│   ├── ui/                      # Button, Dialog, Tooltip, Input, Badge, Table, ConfirmDialog
│   └── common/                  # EmptyState, ErrorBoundary, PageHeader, LoadingSpinner
│
├── services/                    # Core API transport & interceptors
│   └── api/
│       ├── client.ts            # Typed fetch client with Bearer auth & error normalization
│       └── endpoints.ts         # Endpoint URL constants
│
├── stores/                      # Client-side UI & session stores
│   ├── authStore.ts
│   ├── caseStore.ts
│   ├── graphStore.ts
│   ├── revealStore.ts
│   └── uiStore.ts
│
├── types/                       # Shared domain TypeScript contracts
└── styles/                      # Tailwind directives and tokens.css
```
