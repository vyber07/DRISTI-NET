# ADR-021: Sync the Neo4j graph copy on change, not on every request; one node ranking on both backends

**Status:** Accepted. Tested:
- SQLite: 536 passed;
- disposable Neo4j 5: 543 passed, 0 deadlocks;
- concurrent load before and after;
- browser walkthrough: 16 of 16.

Not deployed. Details: `docs/GRAPH_LOADING.md`.

## Problem

`build_projection` rewrote the whole case into Neo4j on every graph, analysis, report and integrity request.
- With 10–20 concurrent viewers of one case, Neo4j deadlocked and views took 2.5–9.7 s.
- A time-filtered view stored its subset as the case's copy, so a concurrent full view could silently show part of
  the case.
- The uncentered listing ordered nodes by `entity_id` in Neo4j but by connections in process, so the first view of a
  large case differed between backends and was effectively random under Neo4j.

## Options considered

- **Keep rewriting, but add a mutex.** Rejected: it removes deadlocks, but every view still pays a full rewrite.
- **Write the Neo4j copy from the evidence pipeline (event-driven) only.** Rejected for now. Reviews, merges and
  reversals change the projection outside the pipeline as well, and a missed event would leave a stale copy with
  nothing to detect it.
- **Fingerprint on read.** Chosen: compare a content hash of the projection with the hash stored alongside the copy,
  and rewrite only on a mismatch. Writers serialise on a per-case marker node, and a per-process lock avoids redundant
  writes. It is self-healing: any view of a changed case brings the copy up to date, and an unchanged case costs one
  indexed read.

## Decision

- Only the unfiltered graph view syncs Neo4j. Analysis, reports and integrity use the in-memory projection alone.
  Time-filtered views neither write nor read Neo4j.
- `(:Projection {case_id, fingerprint, synced_at})`, with a uniqueness constraint, holds the fingerprint written in
  the same transaction as the copy. It is the lock every writer takes first.
- Uncentered listings rank by number of the case's relationships, then `entity_id`, identically in Cypher and in
  process.
- Frontend: lay out in screen pixels for the area the camera fit uses, pick the radius from the room available, and
  remove overlaps. Remove the mock-ID layout code. Show an empty state.

## Consequences

- No migration; existing copies are rewritten once on first view.
- The in-process build from claims still runs on every request; caching it per claims version is the next lever if
  needed.
- `projection_stale` now means a real fallback (Neo4j failing or busy beyond the query timeout), not a routine
  deadlock.
