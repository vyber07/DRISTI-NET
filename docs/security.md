# Security & safety controls — and how each is demonstrated

| # | Control | Implementation | Demonstration / test |
|---|---------|----------------|----------------------|
| 1 | Assigned user can view the case | `auth.authorize_case` (assignment + jurisdiction + role) | login `investigator` → CASE-0001 opens |
| 2 | Unassigned user denied **by the server** | same; every case-scoped route calls it; denial audited as `ACCESS_DENIED` | login `unassigned` → "Test: request CASE-0001 directly" → 403; `test_unassigned_user_denied_server_side` |
| 3 | Jurisdiction mismatch denied even if assigned | `authorize_case` | `outsider` (District B) → 403; `test_jurisdiction_mismatch_denied` |
| 4 | Phone/account masked by default | `services/masking.py` applied to graph, timeline, claims, snippets, report | every screen shows `+91 •••••• 901`; `test_masking_and_audited_reveal` |
| 5 | Reveal requires a reason and is audited | `POST /entities/{id}/reveal`, role-gated, writes `UNMASK` | Graph → node → Reveal; Audit tab shows `UNMASK` with reason |
| 6 | Altered evidence produces a hash mismatch | SHA-256 manifest at upload; `GET /evidence/{id}/verify`; re-extraction refuses on mismatch | Evidence → *Demo: tamper stored object* (admin) → *Verify hash*; `test_hash_manifest_and_tamper_detection` |
| 7 | Scan failure never becomes CLEAN | `services/scanner.py` returns explicit states; only `CLEAN` promotes out of quarantine | upload with scanner dropdown = `SCAN_FAILED`; upload `eicar_test.txt`; `test_scan_gate_fail_closed` |
| 8 | Frontend cannot query the graph store | there is no graph-store endpoint; NetworkX lives in-process; UI only calls `/api/v1` | `test_frontend_cannot_reach_graph_store`; Vite proxy config |
| 9 | No credentials in the repository | `.env.example` only; demo passwords are derived (`<user>-demo`) and documented as such | `test_no_secrets_in_repo` |
| 10 | Upload validation | extension allow-list, size cap, magic bytes (PDF), UTF-8/CSV/JSON structure, safe file names | `test_upload_validation_rejects_bad_files` |
| 11 | Graph query bounds | hops ≤ 2, nodes ≤ 150, supernode fan-out cap — enforced server-side regardless of request | `test_graph_is_bounded_and_edges_trace_to_source` |
| 12 | No automatic person-level merge | matcher only creates `MatchCandidate`; projection merges only on `APPROVE`; `REVERSE` undoes | `test_candidates_are_explainable_and_never_auto_merged`, `test_review_decisions` |
| 13 | Every decision has reviewer, reason, timestamp, evidence, audit | `Review` row + `REVIEW_DECISION` audit; reason min length enforced | Review tab decision history; Audit tab |
| 14 | Trace IDs across requests | `X-Trace-Id` middleware; stored on jobs and audit rows | response headers; Evidence → Jobs |
| 15 | Neutral language | analysis output uses *candidate bridge*, *high-volume node*, *review priority* | `test_analysis_uses_neutral_language` |

## Threat-model notes for the prototype

- Authentication is JWT (HS256) with a demo secret; rotate `DRISHTI_SECRET_KEY` and put TLS in front (NGINX) before any shared deployment.
- Audit rows are append-only by API design (no update/delete route). Database-level immutability (WORM storage, hash chaining) is roadmap.
- The `testgate` scanner recognises only the EICAR string. It exists to prove fail-closed *behaviour*; it is not antivirus.
- `/demo/tamper` exists only to demonstrate integrity checking and must be removed outside the demo.
