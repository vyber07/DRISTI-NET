# Graph loading and rendering (P1.4)

Status: **FIXED ON BRANCH — NOT DEPLOYED** (branch `worktree-auth-login-ratelimit`, 2026-11-12). Decision record:
ADR-021.
Code:
- `apps/api/app/services/graph.py`, `services/neo4j_store.py`, `routes/graph_routes.py`, `graph/constraints.cypher`;
- `apps/web/src/components/graph/engine/{GraphEngine.ts,layout.ts}`, `features/cases/case-graph-page.tsx`.

Tests: `apps/api/app/tests/test_graph_projection_sync.py`. Browser check: `scripts/reliability/verify_graph_ui.mjs`.

## 1. How a graph view works

1. `GET /cases/{id}/graph` checks case access (`authorize_case`). Unassigned users, other jurisdictions and unknown
   cases get 403 (audited).
2. `build_projection` builds the case's graph in memory from the authoritative claims: ALLOWED, APPROVE and
   CONTRADICTORY claims, with approved identity merges applied.
3. When `DRISHTI_NEO4J_URI` is set, the unfiltered view keeps a copy of that projection in Neo4j and reads the bounded
   node listing back from it. Without Neo4j the same bounded listing is computed in process.
4. Nodes are masked (`mask_node`), edges are aggregated per pair and relationship type, and the response carries
   `truncated`, `total_nodes`, `projection_stale` and `bounds`. Hops are capped at 2, nodes at 150, and supernode
   fan-out at 12.
5. The browser maps the response (`graphApi.ts`) into the store and draws it with Sigma and graphology
   (`GraphEngine.ts`).

## 2. Reproduction (isolated server, throwaway stores; the live demo was not touched)

The setup was an isolated API on 127.0.0.1:8003 using a throwaway SQLite store seeded with `seed --ingest` (CASE-0001:
57 entities, 119 aggregated relationships), a disposable `neo4j:5-community`, an E2E web build, and real Chromium
over CDP.

| Check | Without Neo4j | With Neo4j (as deployed) |
| --- | --- | --- |
| CASE-0001 drawn vs API | 57/57 nodes, 119/119 edges | same |
| First view | 76 ms | **4.3 s** |
| 10 concurrent viewers | – | p50 2.5 s, max 8.3 s |
| 20 concurrent viewers | – | p50 4.5 s, max 9.7 s, **Neo4j deadlocks** in the log, 1 response flagged stale |
| Layout (CASE-0001) | 118 overlapping node pairs; 53 of 57 nodes touching another; nodes used 18 % of the canvas | same |
| Empty case | blank canvas; footer said "no relationship carries a date" | same |

Live logs could not show the production symptom: the live API container had restarted on 2026-11-11 and held 4 log
lines.

## 3. Root causes

1. **Every graph-related request rewrote the case's whole projection in Neo4j.** `build_projection` synced to Neo4j
   on every call. That included the graph view, `/analysis`, the report and the integrity anchor, even when nothing
   had changed. Concurrent viewers of one case deadlocked on Entity locks; the driver retried, so requests queued for
   seconds while holding API threads and database connections. A deadlocked request fell back to the in-process graph
   with "The graph is being rebuilt" shown. On the 2-vCPU host, with the 30 s client timeout and the existing
   capacity limit (about 100 active users before 503 BUSY), this is how views time out or fail.
2. **A time-filtered view overwrote the Neo4j copy with its subset.** `t_from`/`t_to` were applied before the sync.
   A concurrent unfiltered view could then read the subset back. Every ID in the subset is a real node, so the DEF-072
   consistency check passed, and the graph silently showed only part of the case.
3. **The first page of a large case was effectively random under Neo4j.** The uncentered listing was ordered by
   `entity_id`, so the 100 nodes in the first view were alphabetical IDs, not the connected core. In-process it was
   ranked by connections; the two backends disagreed.
4. **Unreadable layout.**
   - ForceAtlas2 ran with inferred settings (strong gravity) plus `adjustSizes` in arbitrary units. The camera fit then
     mapped one layout unit to 0.54 px, so 32 px discs sat about 22 px apart.
   - Dead mock-data code ran on every layout: a table of positions for fake IDs, a special label for `E-CYB-01`, and a
     "re-anchor on E-PERS-01" step.
5. **No empty state** for a case with nothing projected.

## 4. Fix

- **Sync only when needed** (`graph.ensure_synced`):
  - only the unfiltered graph view syncs (`build_projection(..., sync_neo4j=True)`); analysis, report and integrity
    never touch Neo4j;
  - a content fingerprint of exactly what is written (`projection_fingerprint`, `p1:<sha256>`) is stored on a
    `(:Projection {case_id})` node in the same transaction as the projection;
  - an unchanged case costs one indexed read.
- **Serialised writers, no deadlocks.**
  - Within a process, one thread per case writes while the others wait (bounded by `DRISHTI_NEO4J_QUERY_TIMEOUT_S`;
    on timeout the request is served in process and flagged `projection_stale`).
  - Across processes, every write transaction first locks the case's `:Projection` node and re-checks the fingerprint
    under that lock.
  - The marker node is created in its own transaction that tolerates the uniqueness race, and the write is retried
    on `ConstraintError`. New constraint: `projection_case`.
- **Time-filtered views are served from the in-process graph only** (`bounded_subgraph(..., use_neo4j=False)`); they
  never write or read the Neo4j copy.
- **One ranking on both backends** (`graph.rank_nodes` = the Cypher `ORDER BY`): most relationships first, then
  `entity_id`. Paging stays exact and the first page is the connected core.
- **Layout** (`engine/layout.ts`):
  - seeded ForceAtlas2 without strong gravity;
  - computed in screen pixels for the exact area the camera fit uses;
  - node radius chosen from the room available (16 px, never below 6 px);
  - a bounded overlap-removal pass;
  - deterministic. The mock-ID code is removed.
- **Empty state**: "No relationships to show yet", with a reason (no evidence, or not yet processed and reviewed) and
  links to Evidence and the Review queue. The time slider is hidden when there is nothing to play through.

Authorization and masking are unchanged: the same `authorize_case` gate, `mask_node` on every node, and server-side
bounds.

## 5. Results after the fix (same setup)

| Check | Result |
| --- | --- |
| Sequential view (Neo4j) | 60–75 ms (was 280–1,220 ms) |
| 10 / 20 / 40 concurrent viewers | p50 0.75 / 1.5 / 3.0 s, max 0.84 / 1.7 / 3.6 s; all complete; 0 deadlocks; 0 stale |
| CASE-0001 layout | 0 overlapping pairs (was 118), all nodes on the canvas |
| CASE-BIG (418 entities, synthetic 1,400-call log through the real pipeline) | 100-node first view with 632 relationships (156 before ranking); banner "Showing 100 of 418"; 0 overlaps at a 10.5 px radius; page 2 disjoint from page 1 |
| Browser walkthrough | 16 of 16 (`verify_graph_ui.mjs`): drawn = API for three cases, no overlaps, banner only when truncated, no page errors, in-app case switch, list view, 403 page, empty state |
| Backend suites | SQLite 536 passed, 16 skipped; with live Neo4j 543 passed, 9 skipped, 0 deadlock messages |

## 6. Deployment and rollback

- **Deploy:** no database migration.
  - Neo4j gets the `projection_case` constraint from `graph/constraints.cypher` (applied at API start-up, as before).
  - Existing Neo4j copies have no fingerprint, so each case is rewritten once on its first view, then only when its
    claims change.
  - Rebuild the web bundle.
- **Rollback:** revert the commit. The `:Projection` nodes and the constraint are harmless to the old code and can be
  removed with `MATCH (p:Projection) DETACH DELETE p` and `DROP CONSTRAINT projection_case`.

## 7. Known limitations

- Not verified on the live Compose stack.
- Each request still rebuilds the in-process projection from the claims. That CPU work is why 40 concurrent viewers
  on one process see p50 3 s. Caching the projection per claims version is the next step if needed (see the capacity
  item in the deferred backlog).
- Pending identity matches (`candidate_edges`, "possibly the same person") are returned by the API but not drawn. That
  was already so before this change.
- Relationships in both directions between the same two entities (13 pairs in CASE-0001) are drawn on top of each
  other. A self-loop (1 in CASE-0001) is counted but not visible.
- Text labels can still overlap in dense regions (Sigma's label placement); node discs do not.
- The UI shows the first page (up to 100 entities) of a large case; paging is available in the API (`offset`,
  `next_offset`) but not in the UI.
- Live Neo4j checks used a disposable `neo4j:5-community`; Enterprise and clustered Neo4j were not tested.
