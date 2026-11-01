# Limitations — demonstrated vs roadmap

Last synced against real system state: 2026-10-16 (see `docs/status.md` for the full section-by-section
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
- ClamAV: `clamav` + `clamav-daemon` 1.5.4 installed via apt; `clamd==1.0.2` Python package
  installed in `.venv311`; daemon configured with `TCPSocket 3310 / TCPAddr 127.0.0.1` and
  confirmed running (EICAR detected as INFECTED, clean file returns CLEAN via clamav-tcp).
  `DRISHTI_SCANNER_MODE=clamav` is active in `.env`. Falls back to the documented `testgate`
  substitute only where no daemon is reachable.

## Not demonstrated (targets)

| Area | Status |
|------|--------|
| OCR / NER Domain Tuning | PaddleOCR 2.10.0 + PaddlePaddle 2.6.2 now installed in `.venv311` and end-to-end verified (inference passes on scanned PDFs, graceful fallback to pypdf text-layer extraction for text-based PDFs). `ocr_adapter.py` supports both 2.x (ocr() API) and 3.x (predict() API) transparently. Deep language-specific fine-tuning (e.g. for noisy Hindi/Devanagari texts) and formal CER/WER evaluation remain on the roadmap. IndicBERT adapter is connected but not formally evaluated. |
| Production Kubernetes Deployment | Kafka and Besu are implemented in Docker Compose, but the system is not yet scaled to Kubernetes. |
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
