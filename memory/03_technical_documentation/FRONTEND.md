# DRISTI-NET — Master Frontend Technical Documentation

**Authority:** `apps/web/`, `docs/FRONTEND_ARCHITECTURE.md`, `docs/frontend/NAVIGATION.md`, `frontend-design/DESIGN_SYSTEM.md`  
**Consolidation Date:** 2026-11-19  

---

## 1. Frontend Architecture & Technology Stack

The frontend is a modern, responsive Single-Page Application (SPA) built with:
- **Framework:** React 18 with TypeScript 5.
- **Build Tool:** Vite 5 with Hot Module Replacement (HMR).
- **Styling & Tokens:** Tailwind CSS with custom design tokens (`apps/web/src/styles/tokens.css`). Strict minimum text size floor of 12px for maximum legibility.
- **UI Primitives:** Radix UI accessible headless primitives (Dialog, Tooltip, Dropdown, Tabs).
- **Icons:** Lucide React icons.
- **Graph Visualization:** Sigma.js WebGL canvas engine powered by Graphology data models.
- **State Management:** Zustand stores with TypeScript interfaces.

---

## 2. Directory Layout & Organization

```
apps/web/src/
├── app/
│   ├── routes/                  # React Router DOM v6 route definitions
│   └── App.tsx                  # Root application component and provider tree
│
├── layouts/
│   └── AppShell/
│       ├── index.tsx            # Main application shell with header, sidebar, and body
│       ├── header.tsx           # Command center bar, case switcher, notifications bell, user menu
│       └── sidebar.tsx          # Accessible collapsible navigation with role-based section gating
│
├── features/                    # Domain feature modules
│   ├── cases/                   # Case management & views
│   │   ├── case-list-page.tsx   # Case index with search and jurisdiction filters
│   │   ├── case-detail-page.tsx # Case overview and key metrics
│   │   ├── evidence/            # Evidence table, chunked upload drawer, quarantine inspector
│   │   ├── graph/               # Sigma.js interactive POLE+ network view with filters & drawers
│   │   ├── timeline/            # Chronological event sequence and temporal playback
│   │   ├── map/                 # Geographic location map view with local lat/lon projection
│   │   ├── reviews/             # HITL candidate arbitration workspace
│   │   ├── audit/               # Case audit log view with HMAC chain verification
│   │   └── reports/             # Dossier PDF download and report generator
│   │
│   ├── admin/                   # Administrative oversight
│   │   ├── user-management-page.tsx     # User CRUD, role assignment, active session control
│   │   ├── case-assignments-page.tsx   # Multi-investigator case assignment matrix
│   │   └── permission-overrides-page.tsx# Temporary emergency elevation manager
│   │
│   ├── profile/                 # User self-service
│   │   └── profile-page.tsx     # Display name editing, password update, active sessions, security log
│   │
│   └── audit/                   # Global system audit
│       └── global-audit-page.tsx# Cross-case audit log explorer with semantic filtering
│
├── components/                  # Reusable presentation components
│   ├── ui/                      # Base primitives (Button, Dialog, Badge, Input, Table, Card, ConfirmDialog)
│   ├── graph/                   # Graph toolbar, legend, filter panel, edge/node detail drawers
│   └── common/                  # EmptyState, ErrorBoundary, LoadingSpinner, PageHeader
│
├── services/                    # Typed API client wrappers
│   └── api/
│       ├── client.ts            # Base fetch wrapper with Bearer token injection and error normalization
│       ├── authApi.ts           # Authentication and session endpoints
│       ├── accountApi.ts        # Self-service profile, password, session endpoints
│       ├── casesApi.ts          # Case CRUD and assignment endpoints
│       ├── evidenceApi.ts       # Evidence upload, status, streaming download
│       ├── graphApi.ts          # POLE+ graph and timeline queries
│       ├── reviewApi.ts         # HITL candidate arbitration endpoints
│       ├── integrityApi.ts      # Merkle roots, Besu ledger anchors, dossier PDF
│       └── auditApi.ts          # Audit logs and verification
│
├── stores/                      # Zustand client-side state stores
│   ├── authStore.ts             # Active session, JWT token, current user profile
│   ├── caseStore.ts             # Selected case ID, case metadata, members
│   ├── graphStore.ts            # Filter states, selected node/edge, layout parameters
│   ├── revealStore.ts           # Sensitive identifier unmasking state and modal visibility
│   └── uiStore.ts               # Sidebar collapse state, theme, modal focus management
│
└── styles/
    ├── index.css                # Global Tailwind directives
    └── tokens.css               # Design system tokens (colors, typography, spacing, shadows)
```

---

## 3. Accessibility & Usability Standards (WCAG 2.1 AA)

- **Zero Axe-Core Violations:** The frontend is audited continuously with axe-core; zero accessibility violations across all 42 primary views.
- **Keyboard Navigation:** Every interactive button, link, and input is reachable via Tab and Enter/Space. Full-screen graph mode toggles via `F` and closes via `Esc`.
- **Focus Trapping:** Mobile sidebar drawer traps focus inside the modal dialog below 1024px. Esc key or backdrop tap dismisses the drawer and returns focus cleanly to the trigger button.
- **Typography Floor:** All visible body and metadata text enforces a minimum 12px computed floor (`text-micro`), eliminating unreadable small labels.
