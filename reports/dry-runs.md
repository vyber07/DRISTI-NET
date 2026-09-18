# Dry runs — automated (mechanical part of the release checklist)

Computed 2026-09-12T23:00:54+00:00 by `scripts/dry_run.py`, 5 consecutive runs, each against a fresh throwaway SQLite store (`DRISHTI_SCANNER_MODE=testgate`).

**Scope**: this automates the mechanical sequence in `docs/demo-script.md` (every beat that is an API call) and proves it is deterministic and repeatable across fresh stores. It does **not** substitute for an actual human rehearsal of delivery/timing/screen-sharing for a live audience — beats 1, 2 and parts of 13 are UI/narration-only and are listed below as `not automatable`, not silently skipped. A person still needs to run through the real UI at least once before presenting.

| run | elapsed (s) | steps passed | result |
|---|---|---|---|
| 1 | 1.08 | 29/29 | PASS |
| 2 | 0.92 | 29/29 | PASS |
| 3 | 1.01 | 29/29 | PASS |
| 4 | 1.02 | 29/29 | PASS |
| 5 | 0.98 | 29/29 | PASS |

## Step detail (run 1; identical pass/fail pattern held across all runs unless noted)

| step | result | detail |
|---|---|---|
| beat3_investigator_opens_case | PASS |  |
| beat5_forced_scan_failure_leaves_file_quarantined | PASS | SCAN_FAILED |
| beat5_retry_recovers | PASS | GRAPH_PROJECTED |
| beat5_eicar_is_infected | PASS | INFECTED |
| ingest_people.json | PASS | status=HITL |
| ingest_aliases.json | PASS | status=HITL |
| ingest_calls.csv | PASS | status=HITL |
| ingest_transactions.csv | PASS | status=HITL |
| ingest_vehicles.csv | PASS | status=HITL |
| ingest_locations.csv | PASS | status=HITL |
| ingest_documents/fir_001.pdf | PASS | status=HITL |
| beat6_source_locator_on_extracted_claim | PASS |  |
| beat7_all_three_planted_candidates_present | PASS |  |
| beat7_approve | PASS |  |
| beat7_reject | PASS |  |
| beat7_defer | PASS |  |
| beat7_reverse | PASS |  |
| beat7_re_approve | PASS |  |
| beat8_approved_alias_is_one_merged_node | PASS |  |
| beat8_candidate_edges_present_not_merged | PASS |  |
| beat8_contradiction_flagged_on_vehicle | PASS |  |
| beat9_edge_click_through_to_verified_source | PASS |  |
| beat10_historical_relationship_kept_not_deleted | PASS |  |
| beat11_authorized_reveal_succeeds | PASS |  |
| beat11_reveal_is_audited | PASS |  |
| beat11_unassigned_user_denied_server_side | PASS |  |
| beat12_json_report_exports | PASS |  |
| beat12_html_report_exports | PASS |  |
| beat13_limitations_doc_present | PASS |  |

| beat1_login_page (UI screen, no API call) | not automatable | requires a human looking at the rendered login page |
| beat2_safety_boundary_footer_text (static UI copy) | not automatable | requires a human reading the rendered footer |

**Overall: all runs fully passed.**
