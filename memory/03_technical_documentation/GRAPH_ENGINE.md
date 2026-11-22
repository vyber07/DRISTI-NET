# DRISTI-NET — Master Graph Engine Technical Documentation

**Authority:** `graph/README.md`, `graph/constraints.cypher`, `docs/adr/002-graph-store.md`, `docs/GRAPH_LOADING.md`, `docs/GRAPH_FULLSCREEN.md`  
**Consolidation Date:** 2026-11-19  

---

## 1. Analytical Graph Philosophy & Boundaries

- **Analytical Projection Only (ADR-002):** The Neo4j graph store is an analytical cache and projection engine. It is **not** an authoritative database. If Neo4j crashes, experiences corruption, or becomes unavailable, the system automatically falls back to an in-process NetworkX graph projection with `projection_stale: true`. The complete graph can be reprojected from PostgreSQL relational rows at any time.
- **Strict Query Bounds:** To prevent supernode explosions and denial-of-service on high-degree nodes:
  - Default traversal depth is bounded to $k \le 2$ (maximum $k = 3$).
  - Returned subgraphs are capped at a maximum of $N = 500$ nodes.
  - Server-enforced query execution timeout is 5,000 milliseconds.

---

## 2. POLE+ Graph Ontology & Cypher Schema

### 2.1 Node Labels & Schema Constraints
Enforced via `graph/constraints.cypher`:
- `:Case {id, case_number, title}`: Unique constraint on `c.id`.
- `:Evidence {id, case_id, filename, sha256}`: Unique constraint on `e.id`.
- `:Entity {id, case_id, kind, label, canonical_name}`: Unique constraint on `n.id`.
  - Node kinds: `PERSON`, `OBJECT`, `LOCATION`, `EVENT`, `ORGANIZATION`, `VEHICLE`, `DOCUMENT`, `ACCOUNT`, `COMMUNICATION`.

### 2.2 Relationship Types
- `:HAS_EVIDENCE`: Links `Case` to `Evidence`.
- `:EXTRACTED_FROM`: Links `Entity` or claim to `Evidence`.
- Domain relationships between entities:
  - `:CALLED {observed_at, duration, call_type, confidence}`
  - `:TRANSFERRED_MONEY {observed_at, amount, currency, transaction_ref, confidence}`
  - `:ASSOCIATED_WITH {observed_at, relationship_desc, confidence}`
  - `:LOCATED_AT {observed_at, location_type, confidence}`
  - `:PARTICIPATED_IN {observed_at, role, confidence}`
  - `:OWNED_BY {observed_at, asset_type, confidence}`

---

## 3. Temporal Decay Engine

To reflect changing real-world relationships over time without deleting historical evidence:
- Edges carry an `observed_at` UTC timestamp.
- The decay service (`apps/api/app/services/graph.py`) calculates edge weight decay using an exponential half-life equation:
  $$W(t) = W_0 \cdot 2^{-\frac{\Delta t}{\tau}}$$
  where $\Delta t$ is elapsed time from the query anchor date and $\tau$ is the half-life parameter (e.g. 180 days for call records).
- Stale or inactive relationships fade on the visual canvas, highlighting active network structures while preserving historical playback capabilities via the timeline slider.

---

## 4. Frontend Rendering & Performance (Sigma.js + WebGL)

- **Engine:** Built with Sigma.js v2 and Graphology on an HTML5 WebGL canvas, allowing smooth rendering of hundreds of nodes at 60 FPS without DOM overhead.
- **Layout:** ForceAtlas2 physics simulation running in a background Web Worker.
- **Interactive Full-Screen Mode:** Native Fullscreen API with full-window fallback (`F` to toggle, `Esc` to exit). Dialogs and detail drawers portal directly into the fullscreen container to maintain accessibility.
- **Change-Driven Projection Sync (ADR-021):** Neo4j synchronization occurs strictly when claims are added or modified, guarded by per-case mutex locks to prevent deadlocks during concurrent extractions.
