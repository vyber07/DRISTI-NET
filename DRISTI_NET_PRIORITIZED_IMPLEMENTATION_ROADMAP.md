# DRISTI-NET Prioritized Implementation Roadmap

| Order | Priority | Work | Dependencies / affected modules | Acceptance criteria |
|---|---|---|---|---|
| 1 | P0 | PostgreSQL + object-store backup, restore and integrity drill | `operations/`, `scripts/backup_restore_drill.py`, DB/storage config | Restore into isolated environment; compare all DB records and evidence hashes; record tested RPO/RTO; no production mutation. |
| 2 | P1 | Fix frontend typecheck | `apps/web/src/services/api/casesApi.ts`, associated API types | `npm run typecheck` exits 0; add typed mapper coverage. |
| 3 | P1 | Complete isolated backend suite and resolve stall | `apps/api/app/tests/`, test fixture/env | `make test` completes with exact pass/skip/fail counts in temp DB/storage. |
| 3a | P1 | Diagnose test fixture/pipeline stall | `apps/api/app/tests/conftest.py`, `services/pipeline.py`, test logs | A minimal fixture-backed test completes; stalled test is identified and its behavior is either fixed or explicitly marked environment-blocked. |
| 3b | P1 | Close sensitive report export masking path | `apps/api/app/routes/report_routes.py`, masking tests | PHONE/ACCOUNT labels masked in JSON and HTML; synthetic regression confirms raw values absent. |
| 3c | P1 | Bound upload memory before request buffering | `evidence_routes.py`, proxy/ASGI config | Oversize body rejected before whole-body allocation; resource behavior checked under concurrency in staging. |
| 3d | P1 | Establish sensitive-read audit coverage | `graph_routes.py`, `evidence_routes.py`, `audit_routes.py` | Policy defines which reads are logged; tests show expected success/denial events and trace IDs. |
| 3e | P0 | Add destructive migration safeguards | `scripts/migrate_evidence_to_minio.py`, `scripts/migrate_sqlite_to_postgres.py` | No execution can delete target objects/rows without explicit target identity, verified backup, dry-run summary, confirmation and isolated test. |
| 4 | P1 | Run E2E with disposable server and DB | `tests/e2e/`, frontend, API | All current tests complete; include authorization, evidence bytes/hash, review, export, denied access. |
| 5 | P1 | Session, rate-limit, admin access policy | `auth.py`, `auth_routes.py`, `ratelimit.py` | Document revocation/logout; test expiration/deactivation; brute-force protection behavior under Redis outage; least-privilege checks. |
| 6 | P1 | Audit verification and evidence custody scope | `services/audit.py`, `audit_routes.py`, `integrity.py` | Tamper detection shown on retrieval/export; key handling and verified event states documented; claims remain limited to integrity references. |
| 7 | P1 | Staging deployment/security validation | Compose, Nginx/systemd, env templates | Healthy restart, TLS, non-public DB/object ports, safe logs, migrations/rollback, secrets provisioned without source changes. |
| 8 | P2 | Reconcile integration architecture and docs | Kafka ADR, `docs/status.md`, `docs/limitations.md`, worker | One consistent statement of required/optional services; isolated E2E test for each claimed integration. |
| 9 | P2 | API/UI contract and error handling | API schemas/routes; `real_client.ts`, page API modules | Typed response contracts; consistent error states; role-by-role UI and API behavior passes browser suite. |
| 9a | P2 | Bound query limits and validate assignment targets | `audit_routes.py`, `graph_routes.py`, `evidence_routes.py`, `case_routes.py`, `review_routes.py` | Positive limits enforced; assignment policy checks active/jurisdiction; metrics count accepted merges or use accurate label; cross-DB tests pass. |
| 10 | P2 | OCR/NER validation | OCR/NLP adapters, evaluation datasets/reports | Representative synthetic evaluation with meaningful precision/recall/CER/WER; degraded mode and human review documented. |
| 11 | P3 | Frontend bundle and accessibility review | Vite config, route chunks, accessibility suite | Route chunking measured; current browser accessibility sweep passes; no unsupported conformance statement. |
| 12 | P4 | Future graph kinds/H3/Kubernetes | Graph model, deployment | Only after operational controls and core evidence workflow are reliable. |

Historical conversation-derived requirements cannot be confirmed because those conversations were not supplied. The roadmap uses repository issue registers and docs only.
