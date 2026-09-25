# Status against the blueprint (`docs/context.md` §3 vocabulary)

Last audited: 2026-09-25 against `main` (see also `PROJECT_STATUS.md` for day-by-day and in-progress view,
and `TASK_BOARD.md` for the live-verification methodology behind each item marked Demonstrated below).
"Demonstrated" means a test in `apps/api/app/tests` or `tests/e2e` exercises it.

## §2 Product boundary

| Requirement | Status | Evidence |
|---|---|---|
| No guilt/threat/criminal/kingpin labels anywhere in outputs | Demonstrated | `test_analysis_uses_neutral_language`; UI copy uses *candidate*, *possible*, *review priority* |
| No automatic person-level merge | Demonstrated | `test_candidates_are_explainable_and_never_auto_merged`, `test_review_decisions` |
| Synthetic data only; prohibited-use statement | Demonstrated | `data/synthetic/generate.py`, `LICENSE_OR_PROJECT_NOTICE.md`, report statement |
| No live connectors, biometrics, alerts, interventions | Demonstrated (by absence) | none exist; `docs/limitations.md` |

## §6 Workflow and §6.1 failure behaviour

| Failure | Status | Evidence |
|---|---|---|
| Unsupported file / magic mismatch / bad structure → reject, reason recorded | Demonstrated | `test_upload_validation_rejects_bad_files` (422 + `EVIDENCE_UPLOAD DENIED` audit) |
| Archive limits (size, nesting, ratio, page count) | Demonstrated | `.zip` accepted; `_check_archive()` in `services/extract.py` rejects path traversal, nested archives, symlink members, unsupported member types, per-member and total uncompressed-size limits, and decompression-ratio (zip-bomb) limits from central-directory metadata alone, before any member is decompressed — `apps/api/app/tests/test_archive_uploads.py` (13 tests incl. a full upload→scan→extract run) |
| Infected → stays quarantined, never parsed | Demonstrated | `test_scan_gate_fail_closed` (EICAR) |
| Scanner failed / timeout / unavailable → not clean | Demonstrated | same test, all three states; retry recovers |
| Parser failure → original preserved, `EXTRACTION_FAILED`, retry | Demonstrated | `test_corrupt_csv_reaches_extraction_failed_and_is_retryable`, `test_truncated_pdf_reaches_extraction_failed` (`apps/api/app/tests/test_extraction_failures.py`) |
| Low-confidence extraction → candidate with uncertainty | Demonstrated | FIR regex claims carry confidence 0.6–0.9; missing amount lowers confidence |
| Contradictory sources → both preserved, contradiction object | Demonstrated | `test_contradiction_is_flagged_not_hidden` (`CONTRADICTORY` claims + `flags.contradicts`) |
| Resolution disagreement → defer | Demonstrated | DEFER decision path |
| Graph projection failure → mark stale, rebuild | Demonstrated (rebuild) / **MVP target** (stale marker) | `test_projection_is_rebuildable`; projection is recomputed per request so there is no persisted stale state |
| Unauthorized → deny server-side + audit | Demonstrated | `test_unassigned_user_denied_server_side`, `test_jurisdiction_mismatch_denied` |
| Hash mismatch → `INTEGRITY_MISMATCH`, blocks acceptance | Demonstrated | `test_hash_manifest_and_tamper_detection` |

## §8 Secure ingestion

| Requirement | Status | Notes |
|---|---|---|
| Order: validate → quarantine → hash → scan → parse | Demonstrated | `evidence_routes.upload` + `pipeline` |
| Shared state vocabulary (§8.2) | Demonstrated | `models.EVIDENCE_STATES` covers all listed states plus `EXTRACTION_FAILED`, `TOMBSTONED` |
| Restricted / sandboxed parser worker; async Kafka event transport | **Implemented (Validation Pending)** | `workers/worker.py` Kafka consumer consumes from `drishti.evidence.jobs`; `services/kafka_bus.py` publisher in pipeline; opt-in (direct in-process path preserved per ADR-004); `test_new_components.py::TestKafkaBus`; `docs/adr/013-kafka-event-bus.md` |
| ClamAV | Demonstrated (dev host runs ClamAV 1.4.3 via `scripts/env.sh`; seed ingest recorded `scan_engine=clamscan`) | `services/scanner.py`; `testgate` only where no binary exists |
| Configurable limits (§8.3) | Demonstrated | upload MB, CSV rows, graph bounds, plus `CSV_MAX_ROWS`/`JSON_MAX_RECORDS`/`PDF_MAX_PAGES` enforced in `validate_upload()` (`apps/api/app/tests/test_extraction_failures.py`) |

## §9 Data model

| Contract | Status | Mapping |
|---|---|---|
| IDs (`case_id`, `evidence_id`, `entity_id`, `claim_id`, `provenance_id`, `review_id`, `job_id`, `trace_id`, `snapshot_id`) | Demonstrated | `models.new_id` prefixes; `relationship_id` = aggregated `(source,target,rel_type)` key, `event_id` = `audit_id` |
| Evidence record fields | Demonstrated | `classification`/`jurisdiction`/`purpose`/`access_class` mirrored onto `Evidence` from its `Case` at upload time (snapshot, not a live join — a later change to the case does not rewrite already-accepted evidence) — `test_evidence_mirrors_case_governance_fields_at_upload_and_is_immutable` |
| Extraction record with page/row/bbox, engine, version, language | **Partially Demonstrated** | page/line/char_offset, row/column, json_path, method, method_version ✔; `bbox` now populated by PaddleOCR adapter (`services/ocr_adapter.py`) when PaddleOCR is installed — falls back to pypdf (no bbox) when absent; `language`/`dataset_version` remain MVP target |
| Resolution candidate (signals, positive/counter evidence, missingness, reversible) | Demonstrated | `MatchCandidate` + `Review` |
| Relationship: observed time, valid interval, relevance, method, version, review state, provenance | Demonstrated | `Claim` + `Provenance`; valid_to is always null in current fixtures |
| Event/audit record with idempotency key | Demonstrated | `Job.idempotency_key`, `AuditEvent` |
| Merkle root + ledger anchor (`LedgerAnchor` model) | **Demonstrated** | `services/integrity.py`; `LedgerAnchor` PostgreSQL table; `POST /cases/{id}/integrity/anchor`; Besu EVM adapter (import-guarded, opt-in); `test_new_components.py::TestMerkleTree` (10 tests) + `TestIntegrityRoutes`; `docs/adr/014-merkle-besu-anchor.md` |

## §10 Graph

| Requirement | Status |
|---|---|
| POLE+ node/edge vocabulary | Demonstrated subset (9 kinds, 9 rel types) — see `graph/README.md`; `Alias`, `Device`, `SIM`, `H3Cell`, `Communication`, `FinancialEvent` node kinds are **Roadmap** |
| Edge properties (§10.3) | Demonstrated | source/evidence span, observed_at, valid_from, confidence, method, review_state, model_version, provenance ids, relevance, contradiction ids, `snapshot_id`, and now `jurisdiction`/`access_class`/`authority_reference` (mirrored from the claim's own evidence, most-recently-observed value wins if constituent claims disagree, `governance_mixed` flags when they do) — `test_workflow.py::test_graph_edges_carry_jurisdiction_access_class_authority_reference`, `test_graph_analysis.py::test_aggregate_flags_governance_mixed_*` |
| Query rules: auth, scope, hops, nodes, time window, supernode, audit | Demonstrated (`test_graph_is_bounded_and_edges_trace_to_source`) |
| Query timeout / cancellation, pagination | Query timeout: Demonstrated — real server-enforced Neo4j timeout, live-verified against an actual `TransactionTimedOut` error (`test_query_timeout_is_enforced_by_the_real_server`). Pagination: Demonstrated — `offset`/`next_offset` on the uncentered node listing, both backends (`test_graph_pagination_*`). Cancellation: **Architecture target**, not attempted — see `task.md`'s appended blocker note and `docs/adr/004-async-queue.md`; safe mid-flight cancellation of a synchronous DB call needs the async job/worker model this project has deliberately not adopted, not a point patch. |
| No browser access to graph store | Demonstrated |

## §11 Analytics

| Requirement | Status |
|---|---|
| Bounded k-hop, degree, weighted degree, betweenness bridge candidates, one community method, burst rule, fan-in rule, decay | Demonstrated |
| Community stability output | Demonstrated — bootstrap-perturbation stability score (`apps/api/app/tests/test_graph_analysis.py`: a dense clique scores far more stable than a sparse path, deterministic for a fixed seed, no crash on an empty/edgeless graph) |
| Map view over location entities | Demonstrated — `GET /cases/{case_id}/locations` (bounded, authorized, audited) + `MapView.tsx`: a locally-rendered linear lat/lon projection, deliberately not a tile-server map (no live connector for case coordinates) — `test_locations_endpoint_returns_coordinates_for_map_view`, `test_locations_endpoint_denies_unassigned_user` |
| Coarse spatial overlap (H3) analytics | **Roadmap** (lat/lon captured; a plain map view of the points is now Demonstrated above — H3 bucketing/overlap analytics is a separate, larger analytical feature, not attempted) |
| Observed / valid / ingestion time stored separately | Demonstrated (`observed_time`, `valid_from/to`, `created_at`) |
| LLM / GraphRAG | Not used (by design, docs/context.md §11.5) |
| Model-backed NER (IndicBERT) | **Implemented (Evaluation Pending)** | `services/nlp_adapter.py`; AI4Bharat IndicBERTv2-MLM-only-NER; PERSON/ORGANIZATION/LOCATION extraction; candidates state=REVIEW_REQUIRED; fallback to empty list when transformers absent; `test_new_components.py::TestNlpAdapter`; `docs/adr/012-nlp-adapter.md` |
| Court-ready evidence dossier (BSA s.63(4)(c) reference) | **Demonstrated** | `services/court_pdf.py`; `POST /cases/{id}/report/court-pdf`; Part A/Part B reference fields; prominent disclaimer (not a legal certificate); Merkle root + ledger reference included; `test_new_components.py::TestCourtPdfRoute` |

## §17 Testing

| Layer | Status |
|---|---|
| Unit + integration (workflow) | Demonstrated — `test_workflow.py` |
| §17.2 golden-dataset requirement: "one high-degree supernode" | Demonstrated — `test_supernode_capping_on_a_planted_high_degree_node`. Real gap found this session: the actual `data/synthetic/` dataset plants no node anywhere near `SUPERNODE_DEGREE` (verified directly: 0 nodes ever get `flags.supernode` on CASE-0001/0002), and no test anywhere exercised the supernode-capping code path — despite the constitution requiring one since it was written. Closed with a dedicated isolated hub-and-spoke scenario (not a golden-dataset regeneration, which would have risked the many other tests coupled to its exact counts) proving both the `flags.supernode` detection and the actual neighbourhood-fan-out cap on a centered traversal. |
| Security | Demonstrated — `test_security.py` |
| E2E from clean start | Demonstrated — `tests/e2e/test_ui_demo.py` (Playwright) |
| Evaluation metrics vs `truth-labels.json` | Demonstrated — `scripts/evaluate.py` runs the real pipeline against the golden dataset and fills `reports/*-evaluation.md`: 5/5 extraction checks, 3/3 entity-resolution decision accuracy, 4/4 graph checks (bridge, communities, both rule types) HIT, honestly scoped as exact hit/miss over planted scenarios, not a large-corpus benchmark |
| Performance with documented conditions | Demonstrated — `scripts/perf_test.py` measures real wall-clock timings (upload→scan→extract→resolve, graph, analysis) at two scales (golden dataset and a synthetic 20,000-row CSV) on this host, with host/software conditions and known limitations of the measurement stated explicitly in `reports/performance.md` |

## Open items, one owner each (suggested)

Previous items 1–3 (corrupt-file fixtures/parser caps, evidence-level governance columns, community
stability/edge `snapshot_id`/query timeout) are now Demonstrated — see the rows above and `TASK_BOARD.md`
Phases 9–11.

1. Role 2 — full accessibility audit (every remaining contrast pair, end-to-end screen-reader flows) —
   two targeted passes fixing concrete found gaps are Demonstrated (clickable-row keyboard access,
   Phase 16; measured color-contrast + form-label coverage, Phase 18 — see `PROJECT_STATUS.md`'s Frontend
   UI note), a comprehensive audit is not.
2. Role 6 — `make e2e` re-run against a real browser connection, and the UI-visual portions of the
   release checklist (`reports/release-checklist.md` names exactly which items still need this).

Role 6's evaluation-report filling, five dry runs, release archive, and performance testing are all now
Demonstrated (see the rows above and `reports/{dry-runs,performance,release-checklist}.md`).

Role 5's item is now closed: edge-level jurisdiction/authority_reference/access_class and graph query
pagination are Demonstrated (see §10 row above). Query *cancellation* specifically is not attempted —
recorded as an architecture-blocked item in `task.md`'s appended note rather than silently dropped.

Archive upload limits (size/nesting/ratio/decompression-bomb ratio) are now Demonstrated — see §8 row above.
