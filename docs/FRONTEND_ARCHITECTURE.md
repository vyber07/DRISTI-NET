# Frontend Architecture

React 18 + TypeScript + Vite in `apps/web` (Tailwind 4 tokens in `src/styles/tokens.css`, Radix primitives, zustand stores,
Sigma/graphology for the graph). Redesigned 2026-11-04. The full design is in `frontend-design/`; the audit and test evidence is in `frontend-audit/`.

- `src/app/router/router.tsx`: routes. Every case page renders inside `features/cases/case-layout.tsx`. Old URLs redirect.
- `src/layouts/AppShell/`: shell, sidebar (sections from `constants/navigation.ts`; collapsible and remembered; a modal drawer below
  1024 px), skip link. `components/security/security-status-bar.tsx` is the top bar. See `docs/frontend/NAVIGATION.md`.
- `src/components/layout/page.tsx`: page header and body, sections, and the loading, empty, error and denied states.
- `src/components/ui/`: Button, Badge, StatusBadge (the one place that maps state codes to labels), ReasonDialog, Dialog.
- `src/features/`: `command-center` (Home), `cases` (layout, overview, evidence, graph tab, timeline, map, analysis, decisions, audit),
  `review` (review queue), `reports`, `audit` (global), `profile` (Account), `auth`, `not-found`.
- `src/lib/permissions.ts`: role → capability hints, mirroring the backend's `require_roles`. The server always decides.
- `src/lib/fullscreen.ts`: `useElementFullscreen` (browser Fullscreen API with a full-window fallback) used by the graph tab;
  while active, `stores/portalStore.ts` makes `ui/dialog.tsx` and `ui/tooltip.tsx` portal into the full-screen element so they stay
  visible (docs/GRAPH_FULLSCREEN.md).
- `src/services/api/`: the API client (`real_client.ts`: bearer token; a 401 sends you to sign-in and back) and per-domain calls.

Build for tests with `npx vite build --outDir <dir>` and serve it with `DRISHTI_WEB_DIST=<dir>`. `make build-web` writes `apps/web/dist`,
which a running deployment serves.
