# Frontend ↔ backend API mapping

Audited read-only. Backend paths are under `/api/v1` (`main.py:82`). `file:line` refers to commit `817bfd0`; the uncommitted `case_routes.py` edit moves its lines by about 5.
Base URL in the client: `import.meta.env.VITE_API_BASE_URL || "/api/v1"` (`real_client.ts:32`). The **three direct `fetch` call sites hard-code `/api/v1`** and ignore `VITE_API_BASE_URL` (upload, court PDF), or partly respect it (download).

Match values:
- **OK**: the call and the response fields line up.
- **PATH MISMATCH**: the frontend calls a path the backend doesn't serve.
- **FIELD MISMATCH**: the frontend reads a field the backend doesn't send, or sends a parameter the backend ignores.
- **BACKEND MISSING**: no backend endpoint exists for the call.
- **UNUSED BY UI**: the function exists but nothing in the UI calls it.

## 1. Forward map: every frontend call

### 1.1 Auth / session (`stores/authStore.ts`, dynamic import of `real_client`)
| Function | Method + path | Body / params | Response fields used | Backend | Auth | Match |
|---|---|---|---|---|---|---|
| `login` | POST `/auth/login` | `{username, password}` | `token`, `user` (then discarded in favour of `/auth/me`) | `auth_routes.py:19` | public (Redis throttle → 429) | OK |
| `login` / `restoreSession` | GET `/auth/me` | — | `user_id, username, display_name, role, jurisdiction, assigned_cases` | `auth_routes.py:47` | current_user | OK. `assigned_cases` lists `CaseAssignment` rows only, so it is wrong for ADMIN/AUDITOR, who see all cases. The Profile page shows it as "N cases". |
| `logout` | none (client only) | — | — | — | — | No server logout or revocation endpoint exists (JWT, 8 h TTL). BACKEND MISSING (only needed if revocation is wanted). |

### 1.2 Cases (`services/api/casesApi.ts`)
| Function | Method + path | Params | Response fields used | Backend | Auth | Match |
|---|---|---|---|---|---|---|
| `listCases` | GET `/cases` | — | mapped: `case_id→id, title, purpose, classification, jurisdiction, authority_reference, owner_id, opened_at, evidence_count, pending_reviews, assigned` | `case_routes.py:22` | current_user (assigned and same jurisdiction; ADMIN/AUDITOR see all) | OK. `sensitivity` is **dropped**. Defaults are invented: title "Untitled Case", classification "RESTRICTED", `opened_at = now()`. No pagination or search on the server. |
| `getCaseDetails` | GET `/cases/{id}` | — | same mapper | `case_routes.py:47` | `authorize_case` (writes a CASE_VIEW audit row on every call) | OK (same caveats). The working tree now also returns `people[]`; the mapper drops it. |
| `getCaseStats` | GET `/cases/{id}/stats` | — | `totalTasks, pendingCount, resolvedCount, contradictionsCount` (overview); `totalTasks, pendingCount, criticalCount, resolvedCount` (HITL) | `review_routes.py:107` | **REVIEWER/INVESTIGATOR/ADMIN** + case | OK for fields. Role mismatch: called for every role and the 403 is swallowed. `identityMergesCount`, `activeAnalysts` and `inReviewCount` are unused. Note that `resolvedCount` counts APPROVE+REJECT only. |
| `getCaseContradictions` | GET `/cases/{id}/contradictions` | — | `claim_id, rel_type, attribute` | `review_routes.py:160` | case | OK. Most `claim_out` fields are unused (see the data dictionary). |
| `getCaseLocations` | GET `/cases/{id}/locations` | — | `locations[].{entity_id,label,lat,lon,has_coords,kind_detail}, total, truncated` | `graph_routes.py:92` | case | OK |
| `getCaseAnalysis` | GET `/cases/{id}/analysis` | `t_from, t_to` supported, **never passed** | `degree[]`, `bridge_candidates[]`, `communities[]`, `rules[]`, `language_note` | `graph_routes.py:123` | case | **FIELD MISMATCH**: the UI reads `bridge_candidates[].touches_communities` (not sent, so always "—") and `communities[].stability` (not sent, so "n/a"). `weighted_degree[]` is not shown. A community entry can be `{"error": …}`, which the UI renders as "Community N, 0 members". |
| `getCaseReviews` | GET `/cases/{id}/reviews` | — | `review_id, target_kind, target_id, decision, reason, reviewer_id, created_at, supersedes_id` | `review_routes.py:152` | case | OK |
| `assignCase` | POST `/cases/{id}/assign` | `{username, purpose="investigator"}` | — | `case_routes.py:55` | owner or ADMIN + case | **UNUSED BY UI**. The default purpose "investigator" differs from the backend default "investigation". |
| — | POST `/cases` | — | — | `case_routes.py:33` | INVESTIGATOR/ADMIN | **UNUSED BY UI** (no create-case screen) |

### 1.3 Evidence (`services/api/evidenceApi.ts`, `stores/evidenceStore.ts`, `stores/provenanceStore.ts`, `case-evidence-view.tsx`)
| Function | Method + path | Body / params | Response fields used | Backend | Auth | Match |
|---|---|---|---|---|---|---|
| `listEvidence` (evidenceStore) | GET `/cases/{id}/evidence` | `_filter` is ignored. The store's `entityId` scope is **not sent**, because the backend has no filter. | `evidence_id, filename, detected_type, size_bytes, sha256, status, source_label, uploaded_by, created_at` | `evidence_routes.py:90` | case | OK for fields. **FIELD MISMATCH (scope)**: the "scope by entity" UI implies a server filter that doesn't exist. No pagination. |
| direct `fetch` (case-evidence-view.tsx:101) | POST `/cases/{id}/evidence` (multipart) | `file`, `source_label="manual"`; `process` not sent (server default true) | `status, scan_result, detail` | `evidence_routes.py:32` | **EVIDENCE_OFFICER/INVESTIGATOR/ADMIN** + case | OK. Hard-codes `/api/v1`, reads the token from `localStorage` directly, and is shown to every role. A duplicate upload returns the prior record with 201, and the UI reports "Uploaded: status …" without saying it was a duplicate. |
| `uploadEvidence` | POST `/cases/{id}/evidence` | same | — | same | same | **UNUSED BY UI** (duplicate of the direct `fetch`) |
| `getEvidenceById` (hitl-evidence-pane) | GET `/evidence/{id}` | — | `evidence_id, filename, status, sha256, record_type` (+`error`) | `evidence_routes.py:104` | case | OK. `jobs[]` and `claim_count` are returned but not shown anywhere. |
| `getEvidenceContext` (hitl-evidence-pane) | GET `/evidence/{id}/context` | `row/page/line/window` (never passed from HITL) | `lines[].{n,text,hit}`, `filename` | `evidence_routes.py:140` | case + scan/integrity gate (409) | OK. HITL always opens at line 1 because the candidate has no locator. |
| provenanceStore `openProvenanceForRecord` | GET `/evidence/{id}/context` | `page, line, row, json_path` | `filename, hash_match, locator, lines[]` | same | same | OK |
| provenanceStore `revealContext` | POST `/evidence/{id}/context/reveal` | `{reason, ...locator, window:2}` | same as context | `evidence_routes.py:172` | **INVESTIGATOR/REVIEWER/ADMIN** (inline) + case + gate | OK. The client checks only that the reason is non-empty (server needs ≥5, so a short reason fails with 422). Shown to all roles. |
| `revealEvidenceContext` | same | `{reason, row/page/line}` | — | same | same | **UNUSED BY UI** (the store posts directly) |
| `downloadEvidence` (card/row) | POST `/evidence/{id}/download` | JSON `{reason}` (≥5, checked on the client) | blob, `X-Trace-Id` | `evidence_routes.py:218` | **INVESTIGATOR/REVIEWER/ADMIN** + case. 409 while quarantined (except ADMIN). | OK. The UI gate matches the backend. The `X-Evidence-SHA256` response header is not checked against the stored hash. |
| `processEvidence` | POST `/evidence/{id}/process` | — | — | `evidence_routes.py:109` | OFFICER/INV/ADMIN + case | **UNUSED BY UI**. No way to retry SCAN_FAILED, SCANNER_UNAVAILABLE or EXTRACTION_FAILED items from the UI. |
| `verifyEvidence` | GET `/evidence/{id}/verify` | — | — | `evidence_routes.py:120` | case | **UNUSED BY UI** (hash re-verification is a core integrity feature, §8.2) |
| `getEvidenceClaims` | GET `/evidence/{id}/claims?limit=` | — | — | `evidence_routes.py:233` | case | **UNUSED BY UI** (per-document claim list) |

### 1.4 Graph / entities / claims / timeline
| Function | Method + path | Params | Response fields used | Backend | Auth | Match |
|---|---|---|---|---|---|---|
| `getCaseGraph` (graphStore) | GET `/cases/{id}/graph` | **none**: `center, hops, max_nodes, offset, t_from, t_to, include_candidates` are all left at defaults (hops 1, max 100, offset 0) | nodes: `entity_id, label, kind, degree, masked`; edges: `source, target, rel_type, count, weight, min_confidence, evidence_ids, claim_ids, first_seen, last_seen, relevance` | `graph_routes.py:48` | case | **FIELD MISMATCH**: reads `rawData.case_title`, which is not sent (falls back to "Case {id}"). Ignores `truncated, next_offset, total_nodes, total_edges, projection_stale, bounds, reference_time, snapshot_hash, candidate_edges`. Node `merged_from` and `flags.supernode` are ignored. Edge `methods, missing_count, decay_score, age_days, jurisdiction, access_class, authority_reference, governance_mixed, snapshot_id` are ignored. Positions are random. |
| `getEntityDetails` (graphStore) | GET `/entities/{id}?case_id=` | — | `entity_id, kind, label, masked, attributes, cross_case.{visible_cases,restricted_case_count}` | `graph_routes.py:196` | case + entity-in-case check | OK. `claims[]` (up to 200, with provenance), `access_class` and `cross_case.total_cases` are not shown. |
| `getEdgeDetails` (graphStore) | GET `/cases/{id}/edge` | `source, target, rel_type` | `claims[].{evidence.{evidence_id,filename}, confidence, method, method_version, state, provenance[0].{locator,snippet}}` | `graph_routes.py:172` | case | OK. `limit` is not passed (default 50, no "more" indicator). Only `provenance[0]` is shown per claim. |
| `getClaimById` (timeline row) | GET `/claims/{id}` | — | `provenance[0].locator` | `graph_routes.py:187` | case | OK (used only to find the locator) |
| `makeClaimDecision` (reviews view) | POST `/claims/{id}/decision` | `{decision, reason}` | `state` (status text) | `review_routes.py:130` | **REVIEWER/INVESTIGATOR/ADMIN** + case | OK. Shown to every role. Offers APPROVE/REJECT/CONTRADICTORY/REVERSE; DEFER and STALE are not offered. `reason \|\| ""` would 422 (the prompt guards against it). |
| `getTimelineEvents` (timelineStore) | GET `/cases/{id}/timeline` | `entity_id` only; `t_from/t_to` supported but the UI filters dates on the client | `events[].{claim_id,time,rel_type,source,target,evidence_id,confidence,missing}` | `graph_routes.py:143` | case | **FIELD MISMATCH**: `missing` is the missingness **object** (default `{}`, truthy), typed as `boolean`. `relevance` is unused in the row (it is in the type). `limit` is not passed (server default 500, max 2000); `count` and `reference_time` are unused. |
| `requestPiiReveal` (revealStore) | POST `/entities/{id}/reveal` | `{case_id, reason}` | `value, audit_id` | `graph_routes.py:223` | case + **INVESTIGATOR/REVIEWER/ADMIN** (DENIED is audited) | OK on the wire. **Fabricated fields:** `status:"APPROVED"`, `authorizedBy = local role`, `authorizedAt = now`, **`expiresAt = now`**, which makes `isRevealed()` false immediately. The client requires ≥15 characters; the server requires 5–500. |

### 1.5 Review / HITL (`services/api/hitlApi.ts`, `stores/hitlStore.ts`)
| Function | Method + path | Params / body | Response fields used | Backend | Auth | Match |
|---|---|---|---|---|---|---|
| `listHITLTasks` | GET `/cases/{id}/candidates` | `state` supported, **not sent**: status and search are filtered on the client | `candidate_id, case_id, state, confidence, matcher_version, left/right.{entity_id,label,kind}, evidence_ids, conflicts, positive_signals, counter_evidence, missing, reviews[], assigned_to, created_at` | `review_routes.py:47` | case | OK. Mapper fabricates `priority:"HIGH"`, `type:"ENTITY_MERGE"`, `caseTitle:"Case …"`, `description`, `slaDeadline = now+24h`, `updatedAt = created_at`, `flagManualReview = state==REVIEW_REQUIRED`. Status mapping: DEFER→"ESCALATED"; REVERSE, STALE and CONTRADICTORY pass through unmapped (the queue filter has no options for them). |
| `getHITLTask` | GET `/candidates/{id}` | — | as above plus detailed `left/right.attributes` | `review_routes.py:56` | case | **FIELD MISMATCH (unused)**: the detailed entity summary (`names, aliases, phones, accounts, orgs, dob, address, evidence_ids`) and `new_evidence_since_snapshot`, `block_key` are returned but not mapped. Only `attributes` (filtered to dob, address, person_id, source_document, mention_of) is mapped, into `proposedMatch`, which **nothing renders**. |
| `submitTaskDecision` | POST `/candidates/{id}/decision` | `{decision: APPROVE\|REJECT\|DEFER, reason}` | candidate (re-mapped) | `review_routes.py:65` | **REVIEWER/INVESTIGATOR/ADMIN** + case | OK. Shown to every role. REVERSE is not reachable (the backend supports it and it is the only way to undo a merge). The "ESCALATE" UI action is silently sent as DEFER. |
| `getHITLStats` | GET `/cases/{id}/stats` | — | `totalTasks, pendingCount, criticalCount, resolvedCount` | `review_routes.py:107` | REV/INV/ADMIN | OK. The 403 is swallowed for other roles. |
| `assignTask` (via `hitlStore.assignAnalyst`) | POST `/candidates/{id}/assign` | body `{analyst}`, **which the backend ignores** (it assigns to the caller) | — | `review_routes.py:91` | REV/INV/ADMIN + case | **UNUSED BY UI** + FIELD MISMATCH (body ignored). |

### 1.6 Integrity, reports, audit, demo
| Function | Method + path | Body | Response fields used | Backend | Auth | Match |
|---|---|---|---|---|---|---|
| `listIntegrityAnchors` (overview) | GET `/cases/{id}/integrity/anchors` | — | `anchor_id, anchor_status, merkle_root, leaf_count, created_at` | `integrity_routes.py:116` | INV/REV/ANA/ADMIN/**AUDITOR** + case | OK. Officer 403 is swallowed, showing "No integrity anchors yet" (wrong). `merkle_scheme, tx_hash, block_number, chain_id, endpoint, note, created_by` are unused. |
| `createIntegrityAnchor` (overview) | POST `/cases/{id}/integrity/anchor` | none | (re-lists afterwards) | `integrity_routes.py:79` | INV/REV/ANA/ADMIN + case | OK. Shown to officer and auditor too. 422 "No accepted evidence" is shown in green text (the message colour is always emerald). |
| `getIntegrityProof` | GET `/cases/{id}/integrity/anchors/{aid}/proof/{sha}` | — | — | `integrity_routes.py:132` | INV/REV/ANA/ADMIN/AUDITOR | **UNUSED BY UI** |
| `generateCaseReport` (reports page) | POST `/cases/{id}/report` | `{analyst_comments, format: html\|json}` | whole body (HTML text or JSON), downloaded as a file | `report_routes.py:19` | INV/REV/ANA/ADMIN + case | OK |
| direct `fetch` (reports-page.tsx:48) | POST `/cases/{id}/report/court-pdf` | `{analyst_comments}` | PDF blob | `integrity_routes.py:169` | INV/REV/ANA/ADMIN + case | OK. Hard-codes `/api/v1`. |
| `integrityApi.generateCourtPdf`, `reportApi.generateCourtPdf` | same | — | — | same | same | **UNUSED BY UI** (two duplicate unused wrappers) |
| `listAuditLogs` (auditStore) | GET `/cases/{id}/audit` | `limit` supported (default 200, max 1000), **not sent** | `audit_id, trace_id, actor_id, action, target_kind, target_id, case_id, outcome, detail, created_at` | `audit_routes.py:24` | case | OK. The store discards the error detail. |
| `listGlobalAuditLogs` (global audit page) | GET `/audit?limit=500[&action=]` | `action` supported, **never passed** (the page filters on the client) | same | `audit_routes.py:16` | AUDITOR/ADMIN | OK. Fires before the page's own role check. |
| `tamperEvidence` | POST `/demo/tamper/{id}` | — | — | `demo_routes.py:14` (mounted only for SQLite) | ADMIN | **UNUSED BY UI** |

### 1.7 Calls the UI implies but the backend doesn't provide
| UI element | Implied endpoint | Status |
|---|---|---|
| Case directory search box | server-side case search, filters, pagination | **BACKEND MISSING** (client filter over the full list; 48 cases for auditor/admin) |
| Graph "Search clues…" | entity search across the case | **BACKEND MISSING**. Client filter over ≤100 loaded nodes. `/graph?center=` exists for neighbourhood expansion but has no search-by-label. |
| Evidence "scope by entity" | `GET /cases/{id}/evidence?entity_id=` | **BACKEND MISSING** (the store pretends; the same could be derived from `/entities/{id}` claims' evidence ids or `/evidence/{id}/claims`) |
| Evidence search by filename or hash | server search | client only (fine at current sizes) |
| Notes (`/cases/:id/notes`, `types/note.ts`) | notes API | **BACKEND MISSING** |
| Alerts (`types/alert.ts`) | alerts API | **BACKEND MISSING** |
| Profile "Change Password", "Manage Profile", "Security & Sessions" | user self-service, session list | **BACKEND MISSING** |
| User administration (create user, change role, deactivate, list assignments) | admin endpoints | **BACKEND MISSING** (only `GET /users`, `POST /cases/{id}/assign`) |
| Notifications bell | notifications | **BACKEND MISSING** |
| Graph "Share" | share link | **BACKEND MISSING** |
| Settings "Clear Local Cache" | none | no endpoint needed (purely fake today) |
| Reports history | `Snapshot` rows (kind REPORT/GRAPH) exist in the DB | **BACKEND MISSING** (no list endpoint) |
| Name resolution for `USR-…` in case pages for REVIEWER/ANALYST/OFFICER | `GET /users` is limited to ADMIN/AUDITOR/INVESTIGATOR | **partly missing**; the working tree's new `case_out.people[]` covers assigned users of a case for every case-authorized role |

## 2. Reverse map: every backend `/api/v1` route

| # | Method + path | File:line | Auth | Used by UI? | Where | Worth surfacing? |
|---|---|---|---|---|---|---|
| 1 | GET `/health` | main.py:54 | public | No | — | Low. Could replace the fake "SYSTEM ONLINE" with real scanner mode, storage and graph-store kind. |
| 2 | GET `/ready` | main.py:62 | public | No | — | Low (ops) |
| 3 | POST `/auth/login` | auth_routes.py:19 | public | Yes | login | — |
| 4 | GET `/auth/me` | auth_routes.py:47 | user | Yes | login, restore | — |
| 5 | GET `/users` | auth_routes.py:53 | ADMIN/AUDITOR/INVESTIGATOR | **No** | — | **High**: resolve `USR-…` to display names in the audit log, evidence `uploaded_by`, reviews `reviewer_id`, candidate `assigned_to`, case owner (for the three roles allowed) |
| 6 | GET `/cases` | case_routes.py:22 | user | Yes | dashboard, directory | — |
| 7 | POST `/cases` | case_routes.py:33 | INV/ADMIN | **No** | — | Medium (create case) |
| 8 | GET `/cases/{id}` | case_routes.py:47 | case | Yes | workspace | — |
| 9 | POST `/cases/{id}/assign` | case_routes.py:55 | owner/ADMIN | **No** (wrapper unused) | — | Medium (team management; pairs with `/users`) |
| 10 | POST `/cases/{id}/evidence` | evidence_routes.py:32 | OFF/INV/ADMIN | Yes (direct fetch) | evidence | — |
| 11 | GET `/cases/{id}/evidence` | evidence_routes.py:90 | case | Yes | evidence | — |
| 12 | GET `/evidence/{id}` | evidence_routes.py:104 | case | Yes (HITL only) | HITL pane | **High** on the evidence page: `jobs[]` (scan/extract/resolve/project status, attempts, errors), `claim_count` |
| 13 | POST `/evidence/{id}/process` | evidence_routes.py:109 | OFF/INV/ADMIN | **No** | — | **High**: retry for SCAN_FAILED, SCANNER_UNAVAILABLE and EXTRACTION_FAILED items, and upload-without-process followed by a deliberate process |
| 14 | GET `/evidence/{id}/verify` | evidence_routes.py:120 | case | **No** | — | **High**: "Verify integrity" action showing expected and actual hash plus the note |
| 15 | GET `/evidence/{id}/context` | evidence_routes.py:140 | case + gate | Yes | provenance viewer, HITL | — |
| 16 | POST `/evidence/{id}/context/reveal` | evidence_routes.py:172 | INV/REV/ADMIN | Yes | provenance viewer | — |
| 17 | POST `/evidence/{id}/download` | evidence_routes.py:218 | INV/REV/ADMIN + reason | Yes | evidence | — |
| 18 | GET `/evidence/{id}/claims` | evidence_routes.py:233 | case | **No** | — | **High**: "what was extracted from this document" (claims with provenance, state), and evidence → graph linking |
| 19 | GET `/cases/{id}/candidates` | review_routes.py:47 | case | Yes | HITL queue | Use `?state=` on the server |
| 20 | GET `/candidates/{id}` | review_routes.py:56 | case | Yes | HITL task | Render the detailed left/right summaries and `new_evidence_since_snapshot` |
| 21 | POST `/candidates/{id}/decision` | review_routes.py:65 | REV/INV/ADMIN | Yes (APPROVE/REJECT/DEFER only) | HITL | Add **REVERSE** for decided candidates |
| 22 | POST `/candidates/{id}/assign` | review_routes.py:91 | REV/INV/ADMIN | **No** | — | Medium ("Take this task") |
| 23 | GET `/cases/{id}/stats` | review_routes.py:107 | REV/INV/ADMIN | Yes | overview, HITL | Gate by role or derive from `/candidates` for others |
| 24 | POST `/claims/{id}/decision` | review_routes.py:130 | REV/INV/ADMIN | Yes (only for already-reviewed claims) | Decisions | Surface it on contradictions (overview) and in the claim lists |
| 25 | GET `/cases/{id}/reviews` | review_routes.py:152 | case | Yes | overview, Decisions | — |
| 26 | GET `/cases/{id}/contradictions` | review_routes.py:160 | case | Yes | overview | Show both sides (`flags.contradicts`), the source, and a decision action |
| 27 | GET `/cases/{id}/graph` | graph_routes.py:48 | case | Yes (defaults only) | graph | **High**: `center`+`hops` (expand from an entity), `offset/next_offset` (load more), `t_from/t_to` (server time window), `include_candidates` (POSSIBLE_SAME_AS edges), and `truncated/total_nodes/projection_stale` banners |
| 28 | GET `/cases/{id}/locations` | graph_routes.py:92 | case | Yes | map | — |
| 29 | GET `/cases/{id}/analysis` | graph_routes.py:123 | case | Yes (no window) | analysis | Time window; fix the field names |
| 30 | GET `/cases/{id}/timeline` | graph_routes.py:143 | case | Yes | timeline | Server `t_from/t_to`, `limit`, show `count/reference_time/relevance` |
| 31 | GET `/cases/{id}/edge` | graph_routes.py:172 | case | Yes | edge drawer | `limit` / "more" |
| 32 | GET `/claims/{id}` | graph_routes.py:187 | case | Yes (locator only) | timeline | Claim detail drawer (reviews, flags, state) |
| 33 | GET `/entities/{id}?case_id=` | graph_routes.py:196 | case | Yes | entity drawer | **High**: render `claims[]` (the entity's evidence trail); name resolution for `ENT-…` |
| 34 | POST `/entities/{id}/reveal` | graph_routes.py:223 | INV/REV/ADMIN | Yes | reveal modal | Fix expiry bug; role gate |
| 35 | GET `/audit` | audit_routes.py:16 | AUD/ADMIN | Yes | global audit | Use the `action` filter and limit up to 1000 on the server |
| 36 | GET `/cases/{id}/audit` | audit_routes.py:24 | case | Yes | case audit | `limit` up to 1000 |
| 37 | POST `/cases/{id}/report` | report_routes.py:19 | INV/REV/ANA/ADMIN | Yes | reports | — |
| 38 | POST `/cases/{id}/integrity/anchor` | integrity_routes.py:79 | INV/REV/ANA/ADMIN | Yes | overview | — |
| 39 | GET `/cases/{id}/integrity/anchors` | integrity_routes.py:116 | +AUDITOR | Yes | overview | Show scheme, `tx_hash`, status, `created_by` |
| 40 | GET `/cases/{id}/integrity/anchors/{aid}/proof/{sha}` | integrity_routes.py:132 | +AUDITOR | **No** | — | **Medium-High**: a per-evidence "inclusion proof" (auditor value) |
| 41 | POST `/cases/{id}/report/court-pdf` | integrity_routes.py:169 | INV/REV/ANA/ADMIN | Yes (direct fetch) | reports | — |
| 42 | POST `/demo/tamper/{id}` | demo_routes.py:14 | ADMIN, SQLite only | **No** | — | Demo-only; keep out of the main UI (an admin "demo controls" panel at most) |

### 2.1 Specific capabilities asked about
- **Server-side search (cases, entities, evidence):** none exists. Each list is returned whole (cases, evidence, candidates, reviews) or bounded (graph ≤ `GRAPH_MAX_NODES`, timeline ≤2000, audit ≤1000, edge claims ≤500, entity claims 200, locations ≤ max nodes). The only targeted lookups are by id (`/entities/{id}`, `/claims/{id}`, `/candidates/{id}`, `/evidence/{id}`) and the graph's `center=` traversal.
- **Pagination:** only the graph (`offset` → `next_offset`, uncentered only). Everything else uses `limit` without an offset.
- **Server-side filters:** `GET /cases/{id}/candidates?state=`, `GET /audit?action=`, `GET /cases/{id}/timeline?entity_id=&t_from=&t_to=`, `GET /cases/{id}/graph?t_from=&t_to=&center=&hops=&include_candidates=`, `GET /cases/{id}/analysis?t_from=&t_to=`. The UI uses only `timeline?entity_id=`.
- **Stats:** `GET /cases/{id}/stats` (REV/INV/ADMIN only). `/cases` also carries `evidence_count` and `pending_reviews` for every role. There is no global stats endpoint.
- **Reports:** JSON/HTML report and integrity-reference PDF, both writing a Snapshot and an audit row. No endpoint lists prior reports or snapshots.
- **Evidence download:** POST with `{reason}` (5–500), the reason is audited, 409 while quarantined except for ADMIN. The UI uses it correctly.
- **Reveal:** entity reveal `{case_id, reason}` and context reveal `{reason, locator, window≤10}`. Both are role-gated inline and every attempt is audited.
- **Admin / user endpoints:** only `GET /users` (ADMIN/AUDITOR/INVESTIGATOR) and `POST /cases/{id}/assign` (owner/ADMIN). No user creation, role change, deactivation, password change, unassignment or session revocation.
