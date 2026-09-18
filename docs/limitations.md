# Limitations — demonstrated vs roadmap

Last synced against real system state: 2026-09-13 (see `docs/status.md` for the full section-by-section
audit and `TASK_BOARD.md` for the live-verification methodology behind each Demonstrated claim below).

## Demonstrated (measured by tests in this repo, or live-verified against a real running service)

- Upload validation, quarantine, SHA-256 manifest, fail-closed scan gate, retry
- Archive (`.zip`) upload controls: path traversal, nested archives, symlinks, member/total size limits,
  decompression-ratio (zip-bomb) limits, all checked from central-directory metadata before any member
  is decompressed
- Source-linked extraction for CSV, JSON, PDF text and TXT (locators: row/column, json_path,
  page/line/char_offset), including through archive members
- Explainable identity-match candidates; accept / reject / defer / stale / reverse; no automatic merge
- Contradiction flagging across sources; missing-field recording
- Bounded, masked, rebuildable graph projection; historical vs current relevance with decay
- Edge-level `jurisdiction` / `access_class` / `authority_reference`, mirrored from the claim's own
  evidence; `governance_mixed` flags real disagreement rather than picking silently
- Graph query pagination (`offset`/`next_offset`) over the uncentered node listing; supernode fan-out
  capping on a planted high-degree node (own isolated test — the shared golden dataset plants no
  supernode, see `TASK_BOARD.md` Phase 19)
- Degree / betweenness bridge candidates / greedy-modularity communities / two transparent rules /
  bootstrap-perturbation community stability score
- Map view over location entities: a locally-rendered linear lat/lon projection, deliberately not a
  tile-server map (avoids sending case coordinates to a third-party service)
- Server-side authorization (assignment, jurisdiction, role), audited denials, audited reveal
- JSON + HTML human-reviewed report with snapshot and audit ids
- PostgreSQL (source of truth, real Alembic migrations), MinIO (S3-compatible object storage), Neo4j
  (graph projection, bounded server-side Cypher, real query timeout), Redis (login-throttle) — all
  live-verified against real running instances (`TASK_BOARD.md` Phases 1–7), not just wired in code.
  Kafka/Redpanda deliberately **not** adopted (`docs/adr/004-async-queue.md`) — no measured throughput
  need justifies it; this is a documented decision, not an unfinished task.
- Evaluation metrics vs `truth-labels.json`: `scripts/evaluate.py` runs the real pipeline and fills
  `reports/*-evaluation.md` with measured hit/miss results (5/5 extraction, 3/3 entity-resolution, 4/4
  graph checks), honestly scoped as exact verification of planted scenarios in a ~20-person synthetic
  dataset, not a large-corpus precision/recall benchmark
- Performance testing under documented conditions: `scripts/perf_test.py` measures real wall-clock
  timings at two scales with host/software conditions stated explicitly (`reports/performance.md`)
- Five automated dry runs of the demo script's mechanical/API-call sequence, all passing
  (`reports/dry-runs.md`) — see the open item below for what this does *not* cover
- Targeted accessibility fixes: keyboard-operable clickable rows, measured WCAG AA color-contrast fixes,
  accessible names on every previously placeholder-only form control (`TASK_BOARD.md` Phases 16, 18)
- ClamAV: demonstrated on hosts with a working ClamAV daemon (real EICAR detection, real clean-file
  pass). Falls back to the documented `testgate` substitute only where no scanner binary/daemon is
  reachable — including this project's own automated evaluation/dry-run/performance scripts, which use
  `testgate` deliberately so they measure pipeline logic, not filesystem antivirus availability

## Not demonstrated (targets)

| Area | Status |
|------|--------|
| Real OCR / NER | FIR extraction is regex-based on a prepared fixture; PaddleOCR + spaCy/GLiNER are roadmap. Extraction-record `bbox`, `language`, `dataset_version` fields (docs/context.md §9.3) are blocked on this — no real layout/OCR pipeline exists to populate them honestly |
| Restricted / sandboxed parser worker; async job/worker model for reads | parsing and graph queries run in the API process (`docs/adr/004-async-queue.md` — deliberate non-adoption, not an oversight, given no measured throughput need). Real client-initiated graph-query **cancellation** specifically needs this model and was evaluated and rejected as an unsafe point-patch otherwise (see `task.md`'s appended note) |
| Additional POLE+ node kinds (`Alias`, `Device`, `SIM`, `H3Cell`, `Communication`, `FinancialEvent`) | 9 of the blueprint's node/edge kinds are implemented; these six remain roadmap |
| Coarse spatial overlap (H3) analytics | lat/lon is captured and a plain map view of the points now exists (see Demonstrated above) — H3 bucketing/overlap *analytics* is a separate, larger feature, not attempted |
| Retention / legal hold / tombstones | fields exist on `Evidence`; no enforcement job |
| Full accessibility audit | two targeted passes fixed every concrete gap a systematic grep + WCAG measurement found (keyboard access, contrast, form labels) — a comprehensive audit (every remaining contrast pair, full screen-reader walkthroughs) is a larger, separate undertaking |
| `make e2e` / visual browser verification of recent changes | not re-run against a live browser this session (no browser connection available in this environment) — `reports/release-checklist.md` names exactly which checklist items still need this |
| Human rehearsal of the demo script | the mechanical/API-call sequence is automated and passing 5/5 (`reports/dry-runs.md`); the login screen, footer copy, and live delivery/timing still need one actual human walkthrough before presenting |
| Multi-agency federation, mobile, Kubernetes, GNNs, LLM decision-making | out of scope by design |
| Legal admissibility, production certification | not claimed |

## Language commitments

The prototype never labels a person as criminal, kingpin, guilty, or a threat. Outputs are *candidate bridge*, *high-volume node*,
*possible intermediary*, *review priority*. A shared identifier creates a candidate relationship, not proof of identity.
