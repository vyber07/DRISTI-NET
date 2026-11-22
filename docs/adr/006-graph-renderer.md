# ADR-006: Frontend graph renderer

## Problem

The graph explorer needs to render up to `DRISHTI_GRAPH_MAX_NODES` (150) nodes and their edges with
selection, filtering, and click-through to evidence — and support zoom/pan, which the original
implementation did not have.

## Options considered

- **Custom SVG + d3-force** (the original implementation) — full control over rendering (arbitrary text
  labels, dashed/dotted edge styles, glyphs for merged/contradictory nodes), but no zoom/pan without
  hand-rolling it, and every node/edge is a real DOM element (which is also what made it easy to test with
  Playwright, until it wasn't the right trade-off — see below).
- **Sigma.js + Graphology** (the directive's stated target, and what was actually adopted) — WebGL
  rendering via a Graphology graph model, native zoom/pan/selection, but no per-node arbitrary DOM overlay
  (canvas only) and no built-in dashed-edge program without an extra package.

## Decision

Sigma.js (3.0.3) + Graphology (0.26.0), replacing the SVG+d3-force view entirely (not run alongside it).

## Reason

Zoom/pan was a real, stated requirement (`docs/context.md`/directive §30) that the SVG view never actually
had — Sigma provides it natively (mouse wheel + drag) rather than requiring it to be hand-built on top of
raw SVG transforms. Directive §64 was still applied here rather than skipped: the swap was justified by
this concrete missing capability, not adopted "because the stack says so."

## Trade-offs

The always-visible on-canvas "⧉ merged" / "⚠ contradiction" text glyphs from the SVG version became a
color cue (contradictory nodes render in a distinct color) plus the existing click-to-see-detail
`EntityCard`, which already surfaced the full merged/contradiction/supernode text. This is a real,
documented UX trade-off (WebGL canvas has no arbitrary per-node text overlay the way SVG did), not a
silent feature loss — the underlying data and its presentation on selection are unchanged, only the
always-visible-without-clicking property is gone. Dashed/dotted edge styles similarly became color/width
distinctions rather than literal dash patterns, to avoid pulling in a separate edge-program package for a
cosmetic difference.

A canvas-rendered graph also has no per-node/edge DOM elements to select in tests — `GraphView.tsx`
exposes the live Sigma/Graphology instances on `window.__sigma`/`window.__graph` (read-only, same data the
`/graph` API already returns) purely so Playwright can compute genuine on-screen pixel coordinates and
issue a real `page.mouse.click()`, rather than a synthetic DOM event standing in for a real interaction.

## Security implications

None specific — the graph data rendered is identical to what the bounded, authorized `/graph` API already
returns; nothing new is exposed to the browser by this change.

## Performance implications

Not benchmarked at graph sizes beyond the current `DRISHTI_GRAPH_MAX_NODES` bound (150). WebGL rendering's
real advantage over SVG would show at node counts well beyond what this bound currently allows.

## Migration

`apps/web/package.json` — added `sigma`/`graphology`; `GraphView.tsx` rewritten in place (same component,
same props, same parent usage).

## Rollback

Would require reverting `GraphView.tsx` and the E2E test to their pre-Sigma versions (git history) — not a
config flag, since this was a full rewrite, not a parallel code path.

## Verification

Live-verified against a real running server with real Chromium (`TASK_BOARD.md` Phase 5): full Playwright
E2E suite (5/5) and backend suite (25/27 depending on which real backends were configured for that run) —
zero regressions. Found and fixed two real bugs in the process, not assumed correct on the first attempt:
`sigma.getNodeDisplayData()` returns coordinates in normalized "framed graph" space (not screen pixels),
confirmed by instrumenting a live page rather than trusting documentation from memory; and Sigma's
click/double-click detection tracks timing on the whole stage (not per-target), so two canvas clicks in
quick succession could get the second one promoted to a double-click — reproduced with a screenshot
showing the wrong behavior, then fixed with an explicit pause, not a magic-number guess.
