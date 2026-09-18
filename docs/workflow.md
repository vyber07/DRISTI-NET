# Workflow (as implemented)

| # | Step | Where in code | UI |
|---|------|---------------|----|
| 1 | Create case (id, title, jurisdiction, purpose, classification) | `routes/case_routes.py` | Cases page |
| 2 | Upload record → name/ext/size/magic/structure validation → `UPLOADED` → `HASHED` → `QUARANTINED` | `routes/evidence_routes.py`, `services/extract.validate_upload`, `services/storage` | Evidence tab |
| 3 | Scan gate → `MALWARE_SCANNING` → `CLEAN` (promote to `accepted/`) or `INFECTED / SCAN_FAILED / SCAN_TIMEOUT / SCANNER_UNAVAILABLE` (stay in `quarantine/`) | `services/scanner.py`, `services/pipeline.run_scan` | Evidence tab (scanner dropdown simulates failures) |
| 4 | Extraction with locators (row/column, json_path, page/line/char_offset), original + normalized values, missingness | `services/extract.py` | Evidence tab → claims table |
| 5 | Entity + relationship candidates (`Claim` rows: MENTION / ATTRIBUTE / RELATIONSHIP) with `Provenance` | `services/extract.py` | Evidence / Graph |
| 6 | Identity-match candidates with positive signals, counter-evidence, conflicts, missing data → human APPROVE / REJECT / DEFER / STALE / REVERSE | `services/resolution.py`, `routes/review_routes.py` | Review tab |
| 7 | Graph projection from ALLOWED + APPROVE claims; approved matches contract nodes; rebuildable | `services/graph.build_projection` | Graph tab |
| 8 | Analysis: degree, betweenness bridge candidates, communities, rule candidates (burst, fan-in), time window | `services/graph.analyze`, `rule_candidates` | Analysis tab |
| 9 | Graph + timeline + evidence drawer; edge → claims → source context | `routes/graph_routes.py`, `evidence_routes.context` | Graph / Timeline tabs |
| 10 | Access control (assignment + jurisdiction + role) server-side; masking by default; audited reveal | `auth.py`, `services/masking.py`, `graph_routes.reveal` | every screen |
| 11 | Human-reviewed report export with snapshot + audit id | `routes/report_routes.py`, `services/report.py` | Report tab |

## Evidence status machine

```
UPLOADED → HASHED → QUARANTINED → MALWARE_SCANNING ─┬→ CLEAN → ACCEPTED → PROCESSING ─┬→ EXTRACTED → ENTITY_CANDIDATES ─┬→ HITL ──(all reviewed)──→ ACTIVE
                                                     │                                  └→ EXTRACTION_FAILED (retry)     └→ GRAPH_PROJECTED → ACTIVE
                                                     └→ INFECTED | SCAN_FAILED | SCAN_TIMEOUT | SCANNER_UNAVAILABLE   (file stays in quarantine/; retry allowed)
```

Any state → `INTEGRITY_MISMATCH` when `/verify` (or pre-extraction re-hashing) finds the stored bytes differ from the manifest; the record and bytes are kept, processing and source serving are refused, and the event is audited.

`SCAN_FAILED`, `SCAN_TIMEOUT` and `SCANNER_UNAVAILABLE` are never treated as `CLEAN` (tested in `test_security.py::test_scan_gate_fail_closed`).

## Claim states

`ALLOWED` (deterministic structured record, admitted by policy) · `REVIEW_REQUIRED` · `APPROVE` · `REJECT` · `DEFER` · `REVERSE` · `STALE` · `CONTRADICTORY`

Only `ALLOWED` and `APPROVE` relationship claims enter the projection. `CONTRADICTORY` attribute claims flag the node but do not disappear.
