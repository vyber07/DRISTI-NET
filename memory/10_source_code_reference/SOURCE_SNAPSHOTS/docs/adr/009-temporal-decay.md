# ADR-009: Temporal relevance decay

## Problem

A relationship observed years ago should be visually and analytically less prominent than one observed
last week, without ever rewriting or deleting the historical fact that it happened.

## Options considered

- **No decay** — treats a call from 2019 identically to one from last week in ranking/prominence; loses a
  genuinely useful analytical signal.
- **Hard cutoff (relationships older than N days simply disappear)** — directly violates the directive's
  explicit rule ("Decay must NOT delete evidence... erase relationships... destroy audit history").
  Rejected outright.
- **Exponential decay on a *relevance* score, source facts untouched** — what was implemented
  (`services/graph.py`): `decay_score = exp(-age_days * ln(2) / HALF_LIFE_DAYS)`, a standard half-life
  formulation.

## Decision

Exponential half-life decay applied only to a `relevance`/`decay_score` field computed at query time. The
underlying `Claim`'s `observed_time`, `valid_from`/`valid_to`, and all provenance are never modified by
this computation.

## Reason

This is the only option consistent with the directive's own explicit constraint (§19): "Temporal decay
changes current relevance; it does not rewrite history." A half-life formulation is a standard,
explainable choice (as opposed to an arbitrary linear or step function) and the parameter
(`HALF_LIFE_DAYS`) is a named, documented constant rather than a magic number buried in the formula.

## Trade-offs

A single global half-life does not distinguish between relationship types that plausibly decay at
different real-world rates (a financial transaction pattern vs. a family relationship, say). The directive
itself anticipates this ("λ must be relationship-specific and configurable") but this codebase currently
uses one constant for all types — a real, acknowledged simplification, not claimed as relationship-aware
decay.

## Security implications

None — this is a ranking/display computation, not an access-control decision. A stale relationship is
still fully visible and traceable to its source; decay affects prominence, not visibility or access.

## Performance implications

Computed per query over the already-bounded result set (`DRISHTI_GRAPH_MAX_NODES`); negligible cost.

## Migration

Making the half-life relationship-type-specific would mean keying `HALF_LIFE_DAYS` by `rel_type` instead
of a single constant — a config/data change, not an architectural one.

## Rollback

N/A — removing decay would mean treating `decay_score` as always 1.0; no separate code path exists for
"decay off" today.

## Verification

The UI's "Current View" vs. showing historical relationships toggle (`showHist` in `GraphView.tsx`, ADR-006)
and the timeline's "show historical" control are both exercised by the Playwright E2E suite
(`test_timeline_analysis_report`). The formula itself is covered by unit-level assertions in
`apps/api/app/tests` on `relevance`/`age_days` fields in graph API responses.
