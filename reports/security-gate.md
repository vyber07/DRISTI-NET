# Security gate — results

Run `python3 -m pytest apps/api/app/tests/test_security.py -v` and paste the output here before the demo.

| Check | Test | Result |
|-------|------|--------|
| unauthenticated denied | `test_unauthenticated_denied` | |
| unassigned denied server-side + audited | `test_unassigned_user_denied_server_side` | |
| jurisdiction mismatch denied | `test_jurisdiction_mismatch_denied` | |
| role gate on upload | `test_role_gate_on_upload` | |
| upload validation | `test_upload_validation_rejects_bad_files` | |
| scan gate fail-closed | `test_scan_gate_fail_closed` | |
| hash manifest + tamper detection | `test_hash_manifest_and_tamper_detection` | |
| masking + audited reveal | `test_masking_and_audited_reveal` | |
| no graph-store endpoint | `test_frontend_cannot_reach_graph_store` | |
| no secrets in repo | `test_no_secrets_in_repo` | |
