# ADR-002: Graph projection store

## Problem

Approved claims and reviews need to be projected into a graph for bounded-traversal queries (k-hop
expansion, degree, betweenness, community detection) that would be awkward and slow to express as
repeated relational joins.

## Options considered

- **NetworkX only, rebuilt in-process per request** — no external service, but doesn't demonstrate a real
  persisted graph engine or its query-time guarantees (parameterized Cypher, server-side bounded traversal
  enforced by the database itself rather than just application code).
- **Neo4j only** — matches the target architecture but requires every dev/test environment to run it.
- **NetworkX by default, Neo4j when configured** — `services/graph.py::bounded_subgraph` delegates to
  `neo4j_store.read_bounded` when `DRISHTI_NEO4J_URI` is set; otherwise builds an equivalent in-process
  graph from the same Postgres claims.

## Decision

NetworkX in-process by default; real Neo4j via parameterized Cypher (`services/neo4j_store.py`) when
configured. Neo4j is never treated as a second source of truth — `write_projection()` always rebuilds it
from Postgres's approved claims, and `wipe_all()` (test-only) proves this by construction: if Neo4j is
deleted, the same projection logic reconstructs it.

## Reason

The graph is documented (`docs/context.md` §17) as a *rebuildable analytical projection*, never the
authoritative store — so the in-process fallback isn't a compromise on data integrity, only on query
performance and on which layer enforces traversal bounds. Neo4j is worth having specifically because the
bounded-query enforcement (`hops`, `max_nodes`, supernode fan-out cap) is then a real, parameterized,
server-side guarantee — the exact thing that must never be left to "the browser is well-behaved."

## Trade-offs

Running two implementations of the same read/write contract (in-process traversal and Cypher) means a
behavioral difference between them is a real bug class. This actually happened (see Verification) and was
caught only by testing against live Neo4j with real, shared entities across cases — not by inspecting the
Cypher.

## Security implications

Neo4j is never reachable from the browser — only the backend issues parameterized Cypher through
`neo4j_store.py`, and no endpoint accepts raw Cypher or exposes `cypher`/`neo4j`/`bolt` in its surface
(enforced by `test_frontend_cannot_reach_graph_store`).

## Performance implications

Not load-tested at scale (Roadmap). The in-process NetworkX rebuild is fast enough for the demo graph
sizes bounded by `DRISHTI_GRAPH_MAX_NODES` (150); Neo4j's real advantage would show up at graph sizes this
prototype doesn't yet exercise.

## Migration

`graph/constraints.cypher` — applied once at API startup when Neo4j is configured (see ADR risk noted
below: this call must not be allowed to crash the whole process, see `TASK_BOARD.md` Phase 8).

## Rollback

Unset `DRISHTI_NEO4J_URI`; the in-process fallback is exercised by the same code path and the same test
suite (25/27 tests still run, 2 Neo4j-specific live tests skip cleanly rather than fail).

## Verification

Live-verified twice (`TASK_BOARD.md` Phase 3, Phase 7) against real Neo4j 5. Found and fixed a real bug:
entities are a *global* registry in Postgres (one row can be referenced by claims from more than one
case), but an early version stored a scalar `case_id` per Neo4j node, so projecting case B silently
overwrote case A's ownership of a shared entity. Fixed by making case-membership a growable/prunable set.
A second bug (stale entities never pruned from that set) was found later under repeated live test runs and
fixed with a reconciling sync instead of only ever growing membership. Also failure-injection tested
(Phase 8): found and fixed a startup crash and a 56.6s-to-fail hang when Neo4j is unreachable — see
ADR-004 for the "no queue" decision this doesn't affect and `TASK_BOARD.md` Phase 8 for the full writeup.
