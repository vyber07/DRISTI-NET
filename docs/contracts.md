# API contract — `/api/v1`

Auth: `Authorization: Bearer <jwt>` from `POST /auth/login`. Every response carries `X-Trace-Id`.
Errors: `401` unauthenticated · `403` denied (audited, neutral message, does not reveal case existence) · `409` state conflict · `422` validation.

| Method | Path | Roles | Purpose |
|--------|------|-------|---------|
| POST | `/auth/login` | – | `{username,password}` → `{token,user}` |
| GET | `/auth/me` | any | current user + assigned cases |
| GET | `/cases` | any | cases the user may see |
| POST | `/cases` | INVESTIGATOR, ADMIN | create fictional case (own jurisdiction) |
| GET | `/cases/{id}` | assigned | case card (audited CASE_VIEW) |
| POST | `/cases/{id}/assign` | owner, ADMIN | `{username,purpose}` |
| POST | `/cases/{id}/evidence` | EVIDENCE_OFFICER, INVESTIGATOR, ADMIN | multipart `file`, `source_label`, `process` (default true), `force_scan_outcome` (demo) |
| GET | `/cases/{id}/evidence` | assigned | manifest list |
| GET | `/evidence/{eid}` | assigned | manifest + jobs + claim count |
| POST | `/evidence/{eid}/process` | uploader roles | (re)run scan → extract → resolve; `{force_scan_outcome}` |
| GET | `/evidence/{eid}/verify` | assigned | recompute SHA-256 vs manifest (audited) |
| GET | `/evidence/{eid}/context?row=&page=&line=&json_path=` | assigned | masked source lines around a locator; refused while quarantined |
| GET | `/evidence/{eid}/download` | officer/investigator/admin/auditor | raw bytes (audited; quarantined files admin-only) |
| GET | `/evidence/{eid}/claims` | assigned | extracted claims with provenance |
| GET | `/cases/{id}/candidates?state=` | assigned | identity-match queue |
| GET | `/candidates/{cid}` | assigned | full explanation (signals, counter-evidence, conflicts, missing, both profiles) |
| POST | `/candidates/{cid}/decision` | REVIEWER, INVESTIGATOR, ADMIN | `{decision: APPROVE|REJECT|DEFER|STALE|REVERSE, reason}` |
| POST | `/claims/{clid}/decision` | REVIEWER, INVESTIGATOR, ADMIN | same for attribute/relationship claims (e.g. CONTRADICTORY, STALE) |
| GET | `/cases/{id}/reviews` | assigned | decision history |
| GET | `/cases/{id}/contradictions` | assigned | CONTRADICTORY claims |
| GET | `/cases/{id}/graph?center=&hops=&max_nodes=&t_from=&t_to=&include_candidates=` | assigned | bounded, masked projection + candidate edges + snapshot hash |
| GET | `/cases/{id}/edge?source=&target=&rel_type=` | assigned | evidence drawer: claims + provenance behind an aggregated edge |
| GET | `/cases/{id}/analysis?t_from=&t_to=` | assigned | degree, bridge candidates, communities, rule candidates |
| GET | `/cases/{id}/timeline?t_from=&t_to=&entity_id=` | assigned | dated relationship events with CURRENT/HISTORICAL relevance |
| GET | `/entities/{eid}?case_id=` | assigned | entity card + access-filtered cross-case appearances |
| POST | `/entities/{eid}/reveal` | INVESTIGATOR, REVIEWER, ADMIN | `{case_id, reason}` → raw value + audit id |
| GET | `/cases/{id}/audit` | assigned | case audit trail |
| GET | `/audit?action=` | AUDITOR, ADMIN | global audit trail |
| POST | `/cases/{id}/report` | INVESTIGATOR, REVIEWER, ANALYST, ADMIN | `{analyst_comments, format: json|html}` |
| POST | `/demo/tamper/{eid}` | ADMIN | demo only: alter stored bytes → hash mismatch |
| GET | `/health`, `/ready` | – | liveness / DB readiness |

## IDs

`CASE-…` `EVD-…` `ENT-…` `CLM-…` `PRV-…` `MCH-…` `REV-…` `JOB-…` `AUD-…` `SNP-…` `TRC-…` (request trace).

## Locator shapes

`{"row": 12, "columns": ["caller","callee"]}` · `{"json_path": "$[3].phone"}` · `{"page": 1, "line": 9, "char_offset": 480}` (optionally `line_end`).
