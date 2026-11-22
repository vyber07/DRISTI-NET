# Frontend data dictionary

Audited read-only against commit `817bfd0` (backend serializers: `case_out`, `evidence_out`, `claim_out`, `candidate_out`, `entity_summary`, `audit_out`, `_anchor_out`, `user_out`, `graph_svc.aggregate/analyze`) and the frontend mappers and views.

Column key:
- **Opt**: optional or nullable.
- **Sens**: sensitive. P = personal identifier, G = governance or legal, S = security.
- **Masked**: masked by the backend by default. `mask_label` masks the PHONE and ACCOUNT kinds; `mask_text` masks phone and account patterns inside free text.
- **Shown on**: page IDs from `FRONTEND_PAGE_INVENTORY.md`; "—" means never shown.
- **UI search/filter/sort**: what the UI lets the user do with the field. Everything listed there is **client-side**.

Masking facts that apply to every table below:
- PERSON, ORGANIZATION, LOCATION and VEHICLE labels, `dob` and `address` are **not** masked.
- Only PHONE and ACCOUNT kinds, and phone or account patterns inside text, are masked.
- Unmasking happens only through `/entities/{id}/reveal` and `/evidence/{id}/context/reveal`.

---

## 1. Case (`GET /cases`, `GET /cases/{id}`, `POST /cases`, `POST /cases/{id}/assign` → `case_out`)
| Field | Type | Meaning | Opt | Sens | Masked | Shown on | UI search/filter/sort | Notes |
|---|---|---|---|---|---|---|---|---|
| case_id | string `^[A-Z0-9-]{4,32}$` | case key | no | — | no | P-03, P-04, P-05 header, P-07 header | search (P-04) | mapped to `id` |
| title | string | case title | no | — | no | P-03, P-04, P-05 header | search (P-04) | Mapper default "Untitled Case" (**fabricated**). Graph, HITL and Reports pages never show it. |
| jurisdiction | string | jurisdiction unit; drives access | no | G | no | P-03, P-04, P-05 (×3: properties, side panel, footer) | search (P-04) | |
| purpose | string | lawful purpose | no | G | no | P-04, P-05 | search (P-04) | |
| authority_reference | string | authorising reference | no | G | no | P-04, P-05 (×2) | search (P-04) | |
| classification | string (default SYNTHETIC_DEMO) | data classification | no | G | no | P-04, P-05 (×2) | — | Mapper default "RESTRICTED" (**fabricated**, and it is a sensitivity value, not a classification) |
| sensitivity | string (RESTRICTED…) | access class; copied to evidence `access_class` | no | G | no | **— (dropped by mapper)** | — | **returned, never shown** |
| owner_id | `USR-…` | case owner (may assign) | no | — | no | P-04, P-05 (properties, side panel, footer) as a **raw id** | — | Name not resolved |
| opened_at | string (date) | opened date | no | — | no | P-04, P-05 | — | Mapper default `now()` (**fabricated**) |
| assigned | `USR-…`[] | assigned user ids | no | — | no | P-04 (count), P-05 (count + **raw id list** in the side panel) | — | |
| evidence_count | int | evidence rows in the case | no | — | no | P-03 (sum), P-04, P-05 | — | default 0 |
| pending_reviews | int | candidates in REVIEW_REQUIRED | no | — | no | P-03 (sum), P-04, P-05 (fallback) | — | |
| people[] *(working tree only)* | `{user_id, display_name, role, purpose, is_owner}[]` | names for `assigned` | — | — | no | — (mapper drops it) | — | Added during the audit (`case_routes.py` diff). It solves name resolution for assigned users only. |
| created_at (model) | datetime | row creation | — | — | — | not serialized | — | |

**Case stats** (`GET /cases/{id}/stats`; REV/INV/ADMIN only): `totalTasks` (P-05, P-16), `pendingCount` (P-05, P-16), `resolvedCount` (APPROVE+REJECT; P-05, P-16), `contradictionsCount` = `criticalCount` = candidates with `conflicts` (P-05 labels this "Contradictions", but `/contradictions` counts CONTRADICTORY **claims**, which is a different thing). `identityMergesCount` (= total), `activeAnalysts` and `inReviewCount` are **returned, never shown**.

## 2. Evidence (`evidence_out`: list, get, upload, process)
| Field | Type | Meaning | Opt | Sens | Masked | Shown on | UI search/filter/sort | Notes |
|---|---|---|---|---|---|---|---|---|
| evidence_id | `EVD-…` | evidence key | no | — | no | P-09 (no), P-17 tabs, edge drawer | — | |
| case_id | string | owning case | no | — | no | — | — | |
| version | int | version (always 1 today) | no | — | no | — | — | |
| filename | string | original name | no | P (may contain names) | no | P-09, P-17, O-02 | search (P-09) | |
| extension | string | normalised extension | no | — | no | — | — | |
| detected_type | MIME | content-detected type | no | — | no | P-09 | — | |
| record_type | calls\|transactions\|people\|aliases\|vehicles\|locations\|fir\|text\|unknown | parser family | no | — | no | P-17 only | — | **Not on the evidence page.** It would be a useful filter. |
| size_bytes | int | size | no | — | no | P-09 | — | |
| sha256 | hex | manifest hash | no | S | no | P-09 (truncated, copy) | search (P-09) | |
| status | §8.2 state | lifecycle and scan state | no | S | no | P-09 (blue badge for every state), P-17 | status chips (counts only, not clickable) | No colour or meaning per state. INFECTED and ACTIVE look the same. |
| storage_area | quarantine\|… | first path segment | no | S | no | — | — | **returned, never shown** |
| source_label | string | user-supplied source label | no | — | no | P-09 | — | Always "manual" from the UI upload |
| uploaded_by | `USR-…` | uploader | no | — | no | P-09 as a **raw id** | — | Name not resolved |
| scan_engine | string | scanner name | yes | S | no | — | — | **returned, never shown** |
| scan_result | string | scanner verdict | yes | S | no | upload message only | — | **never in the list or detail** |
| error | string | last failure reason | yes | S | no | P-17 pane only | — | **not on the evidence page** |
| retention_policy | string | e.g. demo-30d | no | G | no | — | — | **returned, never shown** |
| legal_hold | bool | legal hold flag | no | G | no | — | — | **returned, never shown** |
| tombstoned | bool | logical deletion | no | G | no | — | — | **returned, never shown** |
| created_at | ISO | upload time | no | — | no | P-09 card (date) | — | no sort |
| updated_at | ISO | last change | no | — | no | — | — | |
| classification, jurisdiction, purpose, access_class, authority_reference | string | governance snapshot at acceptance | no | G | no | — | — | **returned, never shown** (constitution §9.2 fields) |
| jobs[] (detail only) | `{job_id, kind SCAN\|EXTRACT\|RESOLVE\|PROJECT, status, attempts, trace_id, error, metrics}` | pipeline jobs | yes | S | no | — | — | **returned, never shown** |
| claim_count (detail only) | int | claims extracted | yes | — | no | — | — | **returned, never shown** |

**Verify response** (`/evidence/{id}/verify`, unused): `evidence_id, match, status, expected_sha256, actual_sha256, note` ("not a chain-of-custody certificate").

## 3. Claim and provenance (`claim_out`: `/claims/{id}`, `/evidence/{id}/claims`, `/cases/{id}/edge`, `/entities/{id}`.claims, `/cases/{id}/contradictions`)
| Field | Type | Meaning | Opt | Sens | Masked | Shown on | UI search/filter/sort |
|---|---|---|---|---|---|---|---|
| claim_id | `CLM-…` | claim key | no | — | no | P-05 contradictions, P-08 row | — |
| case_id | string | case | no | — | no | — | — |
| kind | MENTION\|ATTRIBUTE\|RELATIONSHIP | claim kind | no | — | no | — | — |
| rel_type | string or null | predicate (CALLED, TRANSFERRED_TO, …) | yes | — | no | P-05 contradictions, P-08, O-06 | graph rel-type filter |
| attribute | string or null | attribute name (ATTRIBUTE claims) | yes | — | no | P-05 contradictions | — |
| source / target | `{entity_id, kind, label}` | endpoints | target optional | P | label masked for PHONE/ACCOUNT | P-08 (via timeline) | — |
| original_value / normalized_value | text | value as recorded / normalised | yes | P | `mask_text` | **—** | — |
| observed_time | string, no time zone | when observed in the source | yes | — | no | P-08 (as `time`) | timeline date filter |
| valid_from / valid_to | string | validity interval | yes | — | no | **—** | — |
| method / method_version | string | extractor and version | no | — | no | O-06 | — |
| confidence | float 0–1 | extraction confidence | no | — | no | P-08, O-06 | graph min-confidence (edge level) |
| missingness | object | fields missing in the source | no (default `{}`) | — | no | P-08 (**as a truthy flag on every row**) | — |
| state | ALLOWED + review states | claim state | no | — | no | O-06 | — |
| flags | object (`contradicts`, `supernode`) | flags | no | — | no | **—** (contradiction partners never shown) | — |
| weight | float | edge weight contribution | no | — | no | — | — |
| evidence | `{evidence_id, filename, sha256, status, version, record_type, jurisdiction, access_class, authority_reference}` | source evidence | no | G | no | O-06 (id, filename) | — |
| provenance[] | `{provenance_id, locator{row,column\|page,line,char_offset\|json_path}, snippet, method, method_version}` | source supports | no | P | snippet masked | O-06 (`[0]` only: locator, snippet) | — |
| reviews[] | `{review_id, decision, reason, reviewer_id, created_at}` | claim decisions | no | — | reason masked | **—** (only in the Decisions list) | — |
| access_class | string | source entity's access class | no | G | no | **—** | — |

**Context response** (`/evidence/{id}/context`, `/context/reveal`): `evidence_id, filename, hash_match` (always true when served), `locator`, `lines[].{n, text, hit}`. Text is masked unless revealed. Shown on O-02 and P-17.

## 4. Identity candidate and review decision (`candidate_out`, `entity_summary`, `/cases/{id}/reviews`)
| Field | Type | Meaning | Opt | Sens | Masked | Shown on | UI search/filter/sort | Frontend mapping |
|---|---|---|---|---|---|---|---|---|
| candidate_id | `MCH-…` | candidate key | no | — | no | P-16 card, P-17 header | search | → `id` |
| case_id | string | case | no | — | no | P-16 header | — | → `caseId`. `caseTitle` = "Case "+id (**fabricated**). |
| state | REVIEW_REQUIRED\|APPROVE\|REJECT\|DEFER\|REVERSE\|STALE | candidate state | no | — | no | P-16, P-17 | status filter (client): PENDING/APPROVED/REJECTED/ESCALATED | renamed. DEFER→"ESCALATED". REVERSE and STALE pass through raw and **can't be filtered**. |
| confidence | float | matcher score | no | — | no | P-16, P-17 meter | sort: server orders by confidence desc; the UI has no sort | also → `similarityScore` |
| matcher_version | string | matcher version | no | — | no | P-16 card via the fabricated `description` | — | |
| block_key | string | blocking key | no | P | `mask_block_key` | — | — | dropped |
| positive_signals / counter_evidence / conflicts / missing | lists | matcher reasoning (§9.5) | no | P | no (values can be names or dob) | P-17 `CandidateSignals` | — | `hasContradiction` = conflicts non-empty |
| evidence_ids | string[] | evidence behind the candidate | no | — | no | P-17 evidence tabs (≤6) | — | |
| created_at | ISO | created | no | — | no | P-16 card | — | also → `updatedAt` (**fabricated**) |
| assigned_to / assigned_at | `USR-…` / ISO | self-assignment | yes | — | no | P-16 card (**raw id**) | — | |
| left / right (list) | `{entity_id, label, kind}` | the two records | no | P | label masked for PHONE/ACCOUNT | P-16/17 title | search | |
| left / right (detail) | `{entity_id, kind, label, attributes{dob,address,person_id,source_document,mention_of}, names[], aliases[], phones[] (masked), accounts[] (masked), orgs[], dob[], address[], evidence_ids[]}` | side-by-side profiles | no | **P** (names, aliases, dob, address unmasked) | phones and accounts only | **— (never rendered)** | — | Only `attributes` mapped into `proposedMatch`, which **nothing renders** |
| new_evidence_since_snapshot (detail) | string[] | evidence newer than the signals | no | — | no | **—** | — | dropped |
| reviews[] | `{review_id, decision, reason, reviewer_id, created_at, supersedes_id}` | decision history | no | — | reason masked | P-17 (last only, as "Officer: USR-… (APPROVE)") | — | last → `decision{action, officerName=reviewer_id, officerBadge=decision, justification, arbitratedAt}` |
| *fabricated* | priority "HIGH", type "ENTITY_MERGE", slaDeadline now+24h, description, flagManualReview, similarityMetrics [], candidateReason "" | — | — | — | — | description and flagManualReview are shown ("MANDATORY REVIEW" / "OPTIONAL AUDIT") | — | **fabricated in `hitlApi.mapCandidateToTask`** |

**Review row** (`/cases/{id}/reviews`): `review_id, target_kind MATCH|CLAIM, target_id, decision, reason (masked), reviewer_id, created_at, supersedes_id`. Shown on P-05 (5 most recent: kind > id, decision, date) and P-12 (all fields, ids raw). No filter or sort beyond server order (newest first).
**Decision input** (`DecisionIn`): `decision ∈ APPROVE|REJECT|DEFER|REVERSE|STALE|CONTRADICTORY`, `reason` 3–2000 characters. The UI requires 15+ characters (HITL) or 5+ (claims prompt).

## 5. Graph node and edge (`GET /cases/{id}/graph`)
| Field | Type | Meaning | Opt | Sens | Masked | Shown on | UI search/filter/sort | Frontend mapping |
|---|---|---|---|---|---|---|---|---|
| node.entity_id | `ENT-…` | node key (canonical after approved merges) | no | — | no | O-05 header | — | → `id` |
| node.kind | PERSON\|ORGANIZATION\|PHONE\|ACCOUNT\|VEHICLE\|LOCATION\|DEVICE\|EVENT\|CASE | entity kind | no | — | no | O-05, canvas icon | type filter (client; no VEHICLE/DEVICE/CASE option) | PHONE/DEVICE→"CYBER", ACCOUNT→"FINANCIAL" (`entityType`), raw kept in `sourceKind` |
| node.label | string | display label | no | P | PHONE/ACCOUNT | canvas, O-05 | search (client, ≤100 nodes) | default = entity_id |
| node.degree | int | unique neighbours | no | — | no | canvas sizing | — | |
| node.masked | bool | label is masked | no | — | — | O-05 reveal | — | → `isMasked` |
| node.merged_from | string[] | merged source labels | yes | P | masked | **—** | — | dropped |
| node.flags.supernode / supernode_note | bool / text | degree cap reached | yes | — | no | **—** | — | dropped |
| node.attributes etc. | from projection | — | yes | P | no | — | — | dropped (fetched per node from `/entities`) |
| *fabricated* | x, y = `Math.random()*100`, size 16, color #6b7280 | layout seed | — | — | — | — | — | **fabricated** |
| edge.source / target / rel_type | ids, string | aggregated relationship | no | — | no | canvas, O-06 | rel-type filter | id = `${s}-${t}-${rel}-${i}` (**synthesized**) |
| edge.count | int | supporting claims | no | — | no | O-06, entity Links | — | default 1 |
| edge.weight | float | summed weight | no | — | no | O-06 "Composite Weight" | — | default 1 |
| edge.min_confidence | float | weakest claim confidence | no | — | no | canvas tooltip | min-confidence slider | default 0 |
| edge.first_seen / last_seen | string | observed range | yes | — | no | — | date range, temporal slider | |
| edge.relevance | CURRENT\|HISTORICAL\|UNDATED | time relevance | no | — | no | O-06 | — | default "UNDATED" |
| edge.evidence_ids / claim_ids | lists (claim_ids ≤50) | provenance pointers | no | — | no | O-06 count | — | |
| edge.methods, missing_count, decay_score, age_days | — | method set, missing-field count, half-life decay | no | — | no | **—** | — | dropped |
| edge.jurisdiction, access_class, authority_reference, jurisdictions[], access_classes[], authority_references[], governance_mixed | — | governance of the latest claim / mixture flag | no | G | no | **—** | — | dropped |
| edge.snapshot_id | hash | view snapshot | no | — | no | **—** | — | dropped |
| *fabricated* | `evidenceTier`, `hasContradiction`, `timestamp` read by GraphEngine | tier styling, contradiction filter | — | — | — | GraphLegend documents tiers T2–T6 | — | **never sent by the API**. The legend describes encodings that never occur. |
| response: candidate_edges[] | `{source, target, rel_type:"POSSIBLE_SAME_AS", state, candidate_id, confidence, count, relevance:"CANDIDATE"}` | identity candidates as edges | — | — | — | **—** | — | dropped |
| response: truncated, next_offset, offset, total_nodes, total_edges, bounds{hops,max_nodes,supernode_degree}, projection_stale, reference_time, snapshot_hash, masked | — | bounds and staleness | — | — | — | **—** (only the loaded count is shown) | — | dropped. `case_title` is read but **not sent**. |

**Entity card** (`/entities/{id}?case_id`): `entity_id, kind, label (masked), masked, attributes` (case-scoped, e.g. dob, address, lat/lon, kind; **unmasked**), `access_class`, `cross_case{visible_cases[], restricted_case_count, total_cases}`, `claims[]` (≤200, `claim_out`). O-05 shows the id, kind, label, attributes, visible cases and "+N Classified Cases". `claims[]`, `access_class` and `total_cases` are **never shown**.

## 6. Timeline event (`GET /cases/{id}/timeline`)
| Field | Type | Meaning | Opt | Masked | Shown on | UI search/filter/sort | Notes |
|---|---|---|---|---|---|---|---|
| claim_id | `CLM-…` | claim | no | no | P-08 | — | |
| time | string, no TZ | observed_time | no (filtered not-null) | no | P-08 (grouped by day) | date range (client), sorted ascending by the server | |
| rel_type | string | predicate | no | no | P-08 | search | |
| source / target | `{entity_id, kind, label}` | endpoints | target optional | PHONE/ACCOUNT | P-08 (label in the sentence; **chips show `entity_id`**) | search on labels; entity scope (server `entity_id`) | |
| evidence_id | `EVD-…` | source | no | no | P-08 (View source) | — | |
| relevance | CURRENT\|HISTORICAL | age vs reference | no | no | **—** | — | |
| missing | object | missingness | no | no | P-08 (truthy → amber on every row) | — | typed `boolean` (**wrong**) |
| confidence | float | — | no | no | P-08 | — | |
| response: case_id, reference_time, count | — | — | — | — | **—** | — | |

## 7. Location (`GET /cases/{id}/locations`)
`entity_id`, `label` (**not masked**; locations are not sensitive kinds), `kind_detail`, `lat`, `lon`, `has_coords`. Response: `case_id, locations[], truncated, total`. Everything is shown on P-10 except `entity_id`. Not searchable, filterable or sortable.

## 8. Analysis (`GET /cases/{id}/analysis`)
| Field | Shape | Shown on P-11 | Notes |
|---|---|---|---|
| degree[] | `{entity_id, label (masked), kind, degree}` ×10 | top 8 bars | |
| weighted_degree[] | `{…, weighted_degree}` ×10 | **—** | returned, never shown |
| bridge_candidates[] | `{entity_id, label, kind, betweenness}` ×5 | label, kind, betweenness | UI also reads `touches_communities` (**not sent** → "—") |
| communities[] | `{community_id, size, members[{entity_id,label,kind}] ≤12}` or `{error}` | "Community N", size, 5 members | UI reads `stability` (**not sent** → "n/a"). `community_id` unused. An error entry renders as an empty community. |
| rules[] | `{rule, version, subject (masked), object (masked), source, target, sources[] (masked), …}` | `rule · subject` | object, sources, version and window are dropped |
| language_note | string | shown | the neutral-language disclaimer (§16) |

## 9. Audit event (`audit_out`: `/audit`, `/cases/{id}/audit`)
| Field | Type | Meaning | Opt | Sens | Masked | Shown on | UI search/filter/sort |
|---|---|---|---|---|---|---|---|
| audit_id | `AUD-…` | event key | no | — | no | P-13 drawer | — |
| trace_id | string | request correlation | no | S | no | P-13 drawer (copy) | — |
| actor_id | `USR-…` or null | who | yes | — | no | P-13, P-22 (**raw id**) | actor filter (P-13, ids), search (P-22) |
| action | string (LOGIN, CASE_VIEW, ACCESS_DENIED, EVIDENCE_UPLOAD, REVIEW_DECISION, UNMASK, EXPORT, INTEGRITY_ANCHOR, …) | what | no | — | no | P-13, P-22 | action filter (client; the server supports `?action=` for global) |
| target_kind / target_id | string | object | yes | — | no | P-13 (with deep links, partly dead), P-22 | target-kind filter (P-13), search |
| case_id | string | case | yes | — | no | P-22 | search (P-22) |
| outcome | OK\|DENIED\|ERROR\|DEGRADED | result | no | S | no | P-13, P-22 | — |
| detail | object | action-specific detail; **contains the reveal or download `reason`, `expected/actual` hashes, `merkle_root`** | no | P/S | **not masked by `audit_out`** (the reason text is stored raw) | P-13 drawer (raw JSON) | search (P-13 description) |
| created_at | ISO | when | no | — | no | P-13, P-22 | sort ASC/DESC (P-13) |
| signature (model) | HMAC | per-event signature | — | S | — | **not serialized** | — |

## 10. Integrity anchor (`_anchor_out`) and proof
Anchor: `anchor_id`, `case_id`, `merkle_root`, `merkle_scheme`, `leaf_count`, `anchor_status`, `tx_hash`, `block_number`, `chain_id`, `endpoint`, `note`, `created_at`, `created_by`. P-05 shows `anchor_id`, `anchor_status`, `merkle_root` (40 characters), `leaf_count` and the date, for the 3 most recent anchors. **Never shown:** `merkle_scheme`, `tx_hash`, `block_number`, `chain_id`, `endpoint`, `note`, `created_by`.
Proof (unused): `anchor_id, merkle_root, leaf_sha256, leaf_index, merkle_scheme, proof_root_matches_anchor, siblings[], valid, note`.

## 11. Report
`POST /cases/{id}/report` with `format=json` returns the `build_report` dict: case, evidence list, reviews (candidate left/right labels skip `mask_label` in this route, `report_routes.py:34`, while court-pdf applies it. Candidates are built only from PERSON entities (`services/resolution.py:22`), whose labels are never masked, so this inconsistency leaks nothing today), relationships (top 60, labels masked), analysis (masked), `snapshot_id`, `audit_id`, `analyst_comments`, `access_context{user, role, jurisdiction, trace_id, masked}`. The UI only downloads it; nothing is rendered. Court PDF: binary. No list or history endpoint.

## 12. User and session
`user_out`: `user_id` (`USR-…`), `username`, `display_name`, `role`, `jurisdiction`; `/auth/me` adds `assigned_cases[]`. Token: JWT HS256 {sub, role, jur, iat, exp = 8 h}, stored in `localStorage` under `drishti.token`; the user is stored under `drishti.user`. Shown: sidebar (display_name, role), status bar (display_name, role ×2, jurisdiction), Profile (all fields + assigned count), Settings (display_name, username, role, jurisdiction). Client-only state: `piiMasked` (cosmetic), `officerClearance` (reveal modal, cosmetic), `sidebarCollapsed`, `caseInfoPanelExpanded` (not persisted).

## 13. Reveal
Entity reveal response: `entity_id, kind, value` (**unmasked**), `audit_id`, `reason`. Frontend `RevealResult` adds `requestId = audit_id`, `status:"APPROVED"`, `authorizedBy = local role`, `authorizedAt = now`, **`expiresAt = now`**, `maskedValue`, `identifierType:"id"`, all **fabricated**. Because `expiresAt` is already in the past, `isRevealed()` and `getRevealedValue()` return false or null immediately. The value appears only in the modal's result panel, never in the drawer's `PIIField`. Revealed values live in memory and are cleared by the full reload on logout.

---

## 14. Fields returned but never shown (summary)
- **Case:** `sensitivity`; stats `activeAnalysts`, `inReviewCount`.
- **Evidence:** `record_type` (except HITL), `storage_area`, `scan_engine`, `scan_result`, `error` (except HITL), `retention_policy`, `legal_hold`, `tombstoned`, `updated_at`, the full governance snapshot, `jobs[]`, `claim_count`.
- **Claim:** `original_value`, `normalized_value`, `valid_from/to`, `flags.contradicts`, `reviews[]`, `access_class`, all provenance beyond `[0]`.
- **Candidate:** the detailed left/right profiles, `new_evidence_since_snapshot`, `block_key`, `assigned_at`, review history beyond the last entry.
- **Graph:** `merged_from`, supernode flags, edge `methods/missing_count/decay_score/age_days`, edge governance, `candidate_edges`, `truncated/next_offset/total_*`, `projection_stale`, `bounds`, `reference_time`, `snapshot_hash`.
- **Entity:** `claims[]`, `access_class`, `cross_case.total_cases`.
- **Timeline:** `relevance`, `reference_time`, `count`.
- **Analysis:** `weighted_degree`, `community_id`, rule object, sources and version.
- **Anchor:** `merkle_scheme`, `tx_hash`, `block_number`, `chain_id`, `endpoint`, `note`, `created_by`.

## 15. Fields defaulted or fabricated by the frontend
| Where | Field | What happens |
|---|---|---|
| `casesApi.mapBackendCaseToFrontend` | title / classification / opened_at | defaults "Untitled Case" / "RESTRICTED" / `now()` |
| `graphApi.getCaseGraph` | x, y, size, color; `caseTitle` | random positions; reads a `case_title` field that doesn't exist |
| `hitlApi.mapCandidateToTask` | priority, type, caseTitle, description, slaDeadline, updatedAt, flagManualReview, similarityMetrics, candidateReason; DEFER→ESCALATED | invented |
| `revealApi.requestPiiReveal` | status, authorizedBy, authorizedAt, expiresAt | invented; `expiresAt = now` breaks the drawer reveal |
| `hitl-decision-pane` → dialog | officerName (local display_name), officerBadge (local role) | client-side, not the server's reviewer |
| `audit-detail-drawer` / `audit-event-card` | actorRole "USER" / "SYSTEM", `detail.actionDescription` fallback text | invented |
| GraphEngine / GraphLegend | evidenceTier (T2–T6), hasContradiction | never sent; legend documents phantom encodings |
| Hard-coded copy presented as data | "SYSTEM ONLINE", "Active Investigation", "PII Masking: Strict", "Secure Integration", "LIVE", "STAGE 4 VALIDATION", "CONFIDENTIAL // LEA SENSITIVE", "Pipeline Phase 4", "verified events … Jaipur, Mumbai, and Dubai", "Connection Secure / v2.0 (Verified)", graph emoji legend, "Graph Analytics Enabled" | not derived from any response |

## 16. Can the UI resolve IDs to display names with existing endpoints?

**User IDs (`USR-…`)**: only partly.
- `GET /users` returns every user's `user_id`, `display_name`, `role` and `jurisdiction`, but only **ADMIN, AUDITOR and INVESTIGATOR** may call it. REVIEWER, ANALYST and EVIDENCE_OFFICER get a 403 (which is audited).
- `GET /auth/me` resolves only the current user.
- The working tree's new `case_out.people[]` resolves the **assigned users of a case**, including the owner when the owner is assigned (the case-create route and the seed both assign the owner), for any role allowed to open the case. It does not cover actors who are not assigned to the case, such as an AUDITOR or ADMIN who appears in the case audit log or in `reviewer_id`.
- There is no bulk or per-id user lookup for the other roles.

**Entity IDs (`ENT-…`)**: yes, from payloads the page already has, or one call per entity.
- Timeline events already carry `source.label` and `target.label`. The chips just render the id.
- Graph nodes carry labels for entities in the bounded view.
- Candidates carry `left` and `right` labels.
- `claim_out` carries `source` and `target` labels.
- Analysis items carry labels.
- For any other id, such as an audit `target_id` of kind ENTITY: `GET /entities/{id}?case_id=` returns the (masked) label. It is case-scoped, returns 403 if the entity is not in the case, and is one call per id. There is no bulk endpoint.

**Other IDs**:
- Claim ids resolve through `GET /claims/{id}`.
- Candidate ids resolve through `GET /candidates/{id}`.
- Evidence ids resolve through `GET /evidence/{id}` or from the case evidence list already loaded on P-09.
- Review `target_id` (MATCH or CLAIM) resolves through those same endpoints, one call each.
