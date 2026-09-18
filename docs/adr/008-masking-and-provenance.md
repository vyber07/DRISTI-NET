# ADR-008: Dynamic masking and provenance

## Problem

Sensitive identifiers (phone numbers, account numbers) must not be exposed by default, and every
analytically important relationship must be traceable back to the exact evidence it came from — not just
"this file produced this claim," but the exact page/row/line/cell.

## Options considered

For masking: **mask everywhere with no reveal** (too restrictive for legitimate investigation) vs.
**client-side masking only** (not a real control — the data would already be in the API response) vs.
**server-side masking by default with an authorized, audited reveal endpoint** (what was implemented,
`services/masking.py`).

For provenance: **store only "this file produced this claim"** (matches nothing to an exact location, the
directive's explicitly-called-out failure mode: "generic file reference only") vs. **store exact
page/row/line/column/JSON-path spans per source type** (what was implemented — `Provenance` records with
`row`/`column`/`json_path`/`page`/`line`/`char_offset` fields depending on source type).

## Decision

Server-side default-on masking with an authorized, reasoned, audited reveal (`POST
/entities/{id}/reveal`). Every `Claim` carries a `Provenance` record with the exact source span for its
source type, and the graph API's edges carry `provenance_ids` so a UI can click an edge and open the exact
evidence context.

## Reason

Masking done client-side is not a security control at all — the unmasked value is already present in the
HTTP response and any reveal is trivially bypassed. Server-side masking with the plaintext never sent
unless explicitly (and auditably) requested is the only version of this that actually restricts access.
Provenance at the level of "a file was involved" would fail the directive's own release gate ("important
relationship opens exact source" = PASS, "generic file reference only" = FAIL) and would make the entire
"evidence-linked" premise of the product hollow.

## Trade-offs

Every extraction path (CSV, JSON, PDF, plain text) has to track and preserve its own kind of location
information, which is more implementation work per source-file type than a single generic
"came-from-this-file" pointer would be. Accepted because it is the whole point of the product.

## Security implications

Every reveal is an audited event (`masking_events`/`AuditEvent`); a reveal without a reason is rejected at
the API layer, not just discouraged in the UI. Masked values must never leak through logs, exports, or
cached responses — this is asserted by `test_masking_and_audited_reveal` but not exhaustively fuzzed
against every export/report code path (a real gap worth a dedicated audit if export functionality grows).

## Performance implications

Negligible — provenance fields are stored alongside the claim they describe, no extra query round-trip to
fetch them.

## Migration

N/A — this has been the design since the initial commit; no prior simpler version to migrate from.

## Rollback

N/A.

## Verification

`test_masking_and_audited_reveal` (masked by default, authorized reveal works, audit event exists);
`test_graph_is_bounded_and_edges_trace_to_source` (every edge in a graph API response resolves to real
provenance); the Playwright E2E suite's `test_graph_edge_to_source` clicks a real edge on the (now Sigma.js
— see ADR-006) canvas and confirms the evidence drawer opens with a `hash verified` real source line, in a
real browser against a real running server.
