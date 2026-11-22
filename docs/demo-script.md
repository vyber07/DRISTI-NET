# Demo script (≈ 6 minutes)

Preparation: `make clean && python3 data/synthetic/generate.py && python3 -m apps.api.app.seed --ingest && make api` (UI built).
Open two browser windows if you want to show two users side by side.

| # | Say | Do |
|---|-----|----|
| 1 | *Investigators get records in many shapes; connections hide in spelling variants, shared numbers, contradictory sources.* | Login page |
| 2 | *Safety boundary: synthetic data, no live connectors, no guilt scores, no automatic merging. The model proposes; the investigator decides.* | point to footer |
| 3 | *An authorized investigator opens a fictional case.* | login `investigator` → CASE-0001 |
| 4 | *An evidence officer uploads a record. It is validated, hashed, and lands in quarantine.* | login `officer` → Evidence → upload `data/synthetic/documents/fir_001.txt` (or any file) |
| 5 | *Only a CLEAN scan lets it out. A failed scan stays quarantined.* | upload `locations.csv` with scanner = `SCAN_FAILED` → status stays `SCAN_FAILED`, area `quarantine`; then *Retry / process* → recovers. Upload `eicar_test.txt` → `INFECTED` |
| 6 | *Every extracted item keeps its source row/page and original + normalized value.* | click `calls.csv` → claims table with `{"row": 2, …}`; click `fir_001.pdf` → `{"page":1,"line":…}` |
| 7 | *Possible identity matches go to a human. Here is why, here is what contradicts it, here is what is missing.* | login `reviewer` → Review: **Accept** Arjun Malhotra/Malhotara (spelling + shared phone + org); **Reject** Rahul Verma pair with 3 conflicts (conf 0.02); **Defer** Tanvi/Imran (shared phone only). Show *Reverse* on one. |
| 8 | *Approved claims form a bounded, rebuildable graph. The bridge candidate is named neutrally.* | Graph tab: point to ⧉ merged node, dotted candidates (not merged), ⚠ contradiction on `DD01 AB 1234`; Analysis tab: bridge candidates + `communication_burst` + `transaction_fan_in` |
| 9 | *Click a relationship and land on the exact source line.* | Graph → click a thick CALLED edge → evidence drawer → *open source context* → highlighted CSV row, "hash verified" |
| 10 | *History is kept; decay only changes relevance.* | Timeline → *show 2019 (historical)*; back in Graph, dashed grey edge Arjun ↔ Vikram Rao |
| 11 | *Sensitive values are masked; a reveal needs a reason and is audited. An unassigned user is denied by the server.* | Graph → click a phone node → Reveal with reason → Audit tab shows `UNMASK`. Second window: login `unassigned` → *Test: request CASE-0001 directly* → HTTP 403 |
| 12 | *Export the human-reviewed report.* | Report tab → comments → *Open HTML report* (masked, with decisions, snapshot id, audit id, limitations) |
| 13 | *What is demonstrated vs roadmap.* | `docs/limitations.md` |

Judge questions to be ready for: "Why not merge automatically?" (false merges are unrecoverable in practice; every merge here is reversible and attributed) ·
"Is the hash chain of custody?" (no — integrity reference only) · "What happens if the scanner is down?" (files stay in quarantine; nothing is extracted) ·
"Can the browser hit Neo4j?" (there is no graph-store endpoint; only the bounded API).
