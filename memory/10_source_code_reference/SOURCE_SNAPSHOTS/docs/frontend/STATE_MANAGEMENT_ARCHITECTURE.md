# DRISTI-NET — Frontend State Management Architecture

**Established:** 2026-11-06  
**Authority:** `docs/engineering/CODING_STANDARDS.md`

---

## 1. State categories

| Category | Examples | Storage |
|---|---|---|
| **Server state** | Cases, evidence records, graph data, audit events | Zustand (current), react-query (target) |
| **Local UI state** | Open modal, active tab, hovered node, expanded row | `useState` in component |
| **Cross-feature state** | Active case context, PII reveal state | Zustand store |
| **Auth / session** | JWT token, user identity, role | `authStore.ts` |
| **URL-driven state** | Search filters, pagination offset, selected node | URL search params |

---

## 2. Current Zustand stores

| Store | Purpose | State type | Quality notes |
|---|---|---|---|
| `authStore.ts` | JWT token, user identity, login/logout | Auth | Good — single responsibility |
| `graphStore.ts` | Graph data, filters, selected node | Server + UI | Mixes server data with UI state; no invalidation |
| `auditStore.ts` | Audit event list | Server | Thin; no pagination state |
| `timelineStore.ts` | Timeline events, type/date filters | Server + UI | Mixes server and filter state |
| `revealStore.ts` | PII reveal workflow state | UI workflow | Good — focused scope |
| `provenanceStore.ts` | Provenance viewer data | Server | Good |
| `uiStore.ts` | Sidebar open/closed, theme | UI | Good — pure UI state |

---

## 3. What belongs where

### Local `useState` (do not put in stores)

```tsx
// Open/closed state for a modal
const [modalOpen, setModalOpen] = useState(false);

// Active tab within a component
const [activeTab, setActiveTab] = useState<"overview" | "evidence">("overview");

// Hover state
const [hovered, setHovered] = useState<string | null>(null);
```

### URL search params (filterable, shareable state)

```tsx
// Filter and pagination state that should survive page refresh
// or be shareable as a link
const [searchParams, setSearchParams] = useSearchParams();
const status = searchParams.get("status") ?? "";
const page = parseInt(searchParams.get("page") ?? "1");
```

### Zustand store (cross-component, persisted in memory)

Use for:
- Auth state (accessed from every protected route)
- Graph rendering state (shared between toolbar, canvas, drawers)
- PII reveal workflow (multi-step, persisted while navigating)

Do not use for:
- Data that lives in a single component subtree
- Data that should be re-fetched when the user navigates back
- Data that should be invalidated after a mutation

### Server state (target: react-query or SWR)

Currently in Zustand stores; the target is to move server-fetched data to a
dedicated server-state library for:
- Automatic refetching
- Loading / error states
- Cache invalidation after mutations
- Background refresh

---

## 4. API data flow

```
Component mounts
    │
    ▼
useEffect or useQuery
    │
    ▼
services/api/<domain>Api.ts     (HTTP call)
    │
    ▼
Zustand store update            (or react-query cache)
    │
    ▼
Component re-renders with data
```

The component should never call `fetch()` directly. All HTTP calls go through the
typed service functions in `services/api/`.

---

## 5. Auth state pattern

```ts
// stores/authStore.ts
interface AuthState {
  token: string | null;
  user: { username: string; role: string; jurisdiction: string } | null;
  setAuth(token: string, user: AuthState["user"]): void;
  clearAuth(): void;
}
```

Access via `useAuthStore()`. Never pass the token as a prop — the API client
reads it from the store directly via `real_client.ts`.

---

## 6. Known issues and targets

| Issue | Current | Target |
|---|---|---|
| Graph store mixes server + UI state | Single graphStore | Split into graphDataStore + graphUiStore |
| No loading state in timeline store | Manual tracking | react-query `isLoading` flag |
| No cache invalidation after review | Store not updated | Invalidate on mutation |
| Stale data risk | Manual refetch | react-query automatic refetch |

---

*This document describes the current state and the target architecture. Migrations should be
done incrementally without breaking the existing officer workflows.*
