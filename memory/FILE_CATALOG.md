# DRISTI-NET repository file catalog

Updated: 2026-11-09

## Scope and reading key

This catalog lists every file in the maintained project inventory: Git-tracked files, non-ignored untracked project files, and all root-level Markdown documents (including ignored local guidance/status files). Each row records its exact repository-relative path, file kind, byte size, and a purpose description inferred from its name and directory. For precise behavior, open the cited source file; filenames and folder placement are not proof of runtime behavior. Binary assets are catalogued by type/size without pretending their visual contents were inspected.

The catalog intentionally does not enumerate the contents of `.git/`, virtual environments, dependency trees, application storage/evidence/databases, generated builds, caches, local secrets, release archives, or local editor/agent runtime state. These are listed in the memory index as excluded classes; they are not source modules and may contain private/user data. This is therefore a complete project-source/document catalog, not a byte-for-byte image of the whole machine.

## Directory role map

- `apps/api/`: Python FastAPI application, database models/configuration, routers, services, and API tests.
- `apps/web/`: React/TypeScript application entry points, feature pages, reusable components, API clients, state stores, types, and web configuration.
- `data/synthetic/`: fictional CSV/JSON/text/PDF inputs, golden/corrupt/scale fixtures, and fixture generator.
- `docs/`, `audit/`, `frontend-audit/`, `frontend-design/`, `operations/`, `security/`, `government/`, `reports/`, `policy/`, `graph/`: specifications, status, design/audit evidence, operating guidance, evaluations, policy references, and graph constraints.
- `infrastructure/`, `docker-compose*.yml`, `Dockerfile`, `.dockerignore`: container, reverse proxy, service, and deployment configuration.
- `scripts/`, `workers/`: operational/evaluation/migration utilities and background-worker entry points.
- Root Markdown: project guidance, task/status registers, previous audit deliverables, overview, and history.

## File-by-file inventory

| Repository path | Kind | Bytes | Purpose (name/directory based) |
|---|---:|---:|---|
| `.dockerignore` | `dockerignore` | 423 | Docker build-context exclusions; controls which local files are sent into image builds. |
| `.env.example` | `example` | 1545 | Development/deployment environment-variable template; placeholders only, not the active secret file. |
| `.gitignore` | `gitignore` | 602 | Git ignore policy for secrets, local data, generated artifacts and `/memory/`. |
| `AGENTS.md` | `md` | 1810 | Root-level project guidance, status, audit, or history document; subject indicated by filename/title. |
| `CHANGELOG.md` | `md` | 4236 | Root-level project guidance, status, audit, or history document; subject indicated by filename/title. |
| `CLAUDE.md` | `md` | 1643 | Root-level project guidance, status, audit, or history document; subject indicated by filename/title. |
| `CONTINUATION_STATE.md` | `md` | 3965 | Root-level project guidance, status, audit, or history document; subject indicated by filename/title. |
| `DRISTI_NET_ARCHITECTURE_GAP_ANALYSIS.md` | `md` | 5375 | Audit report describing architecture gaps and recommended changes. |
| `DRISTI_NET_BUG_AND_ERROR_REGISTER.md` | `md` | 6199 | Bug/error register with reported issues, evidence and remediation notes. |
| `DRISTI_NET_INTEGRATION_VERIFICATION.md` | `md` | 5729 | Integration verification report for configured services and dependencies. |
| `DRISTI_NET_MASTER_IMPLEMENTATION_CHECKLIST.md` | `md` | 45974 | Module-wise implementation checklist and evidence/status records. |
| `DRISTI_NET_PARTIALLY_IMPLEMENTED_FEATURES.md` | `md` | 4180 | Register of partial implementations and remaining work. |
| `DRISTI_NET_PENDING_FEATURES.md` | `md` | 2474 | Register of planned or missing features. |
| `DRISTI_NET_PRIORITIZED_IMPLEMENTATION_ROADMAP.md` | `md` | 4336 | Prioritized implementation sequence and acceptance guidance. |
| `DRISTI_NET_PRODUCTION_READINESS_REPORT.md` | `md` | 3395 | Production-readiness assessment and operational limitations. |
| `DRISTI_NET_REPOSITORY_MAP.md` | `md` | 4098 | Repository inventory, stack and entry-point map. |
| `DRISTI_NET_SECURITY_AUDIT.md` | `md` | 7485 | Security findings and recommended mitigations. |
| `DRISTI_NET_TEST_EXECUTION_REPORT.md` | `md` | 7145 | Recorded test commands, outcomes, and unavailable checks. |
| `DRISTI_NET_VERIFIED_COMPLETED_FEATURES.md` | `md` | 4181 | Features the report classifies as verified, with evidence references. |
| `Dockerfile` | `Dockerfile` | 1194 | API/container image build recipe; installs runtime dependencies and defines the container command. |
| `Makefile` | `Makefile` | 5360 | Developer task entry points for setup, test, build, e2e, stack and operations workflows. |
| `MODULE_STATUS.md` | `md` | 3347 | Root-level project guidance, status, audit, or history document; subject indicated by filename/title. |
| `PROJECT_BLOCKERS.md` | `md` | 2437 | Root-level project guidance, status, audit, or history document; subject indicated by filename/title. |
| `PROJECT_DECISION_LOG.md` | `md` | 5722 | Root-level project guidance, status, audit, or history document; subject indicated by filename/title. |
| `PROJECT_PROGRESS.md` | `md` | 2379 | Root-level project guidance, status, audit, or history document; subject indicated by filename/title. |
| `PROJECT_RISK_REGISTER.md` | `md` | 2723 | Root-level project guidance, status, audit, or history document; subject indicated by filename/title. |
| `PROJECT_TASK_BOARD.md` | `md` | 12584 | Root-level project guidance, status, audit, or history document; subject indicated by filename/title. |
| `README.md` | `md` | 13132 | Root-level project guidance, status, audit, or history document; subject indicated by filename/title. |
| `REQUIREMENTS_MATRIX.md` | `md` | 4038 | Root-level project guidance, status, audit, or history document; subject indicated by filename/title. |
| `STATUS.md` | `md` | 2164 | Root-level project guidance, status, audit, or history document; subject indicated by filename/title. |
| `apps/__init__.py` | `py` | 0 | Project file in apps; type/role inferred from filename and directory; inspect file for exact behavior. |
| `apps/api/__init__.py` | `py` | 0 | Backend application source/configuration in apps/api; role inferred from filename and extension. |
| `apps/api/alembic.ini` | `ini` | 5011 | Backend application source/configuration in apps/api; role inferred from filename and extension. |
| `apps/api/app/__init__.py` | `py` | 0 | Backend application source/configuration in apps/api/app; role inferred from filename and extension. |
| `apps/api/app/auth.py` | `py` | 4551 | Backend application source/configuration in apps/api/app; role inferred from filename and extension. |
| `apps/api/app/config.py` | `py` | 8228 | Backend application source/configuration in apps/api/app; role inferred from filename and extension. |
| `apps/api/app/core/__init__.py` | `py` | 71 | Backend core utility (__init__); shared application infrastructure. |
| `apps/api/app/core/exceptions.py` | `py` | 5172 | Backend core utility (exceptions); shared application infrastructure. |
| `apps/api/app/core/logging.py` | `py` | 2393 | Backend core utility (logging); shared application infrastructure. |
| `apps/api/app/db.py` | `py` | 3459 | Backend application source/configuration in apps/api/app; role inferred from filename and extension. |
| `apps/api/app/main.py` | `py` | 6242 | Backend application source/configuration in apps/api/app; role inferred from filename and extension. |
| `apps/api/app/migrations.py` | `py` | 1376 | Backend application source/configuration in apps/api/app; role inferred from filename and extension. |
| `apps/api/app/models.py` | `py` | 15329 | Backend application source/configuration in apps/api/app; role inferred from filename and extension. |
| `apps/api/app/routes/__init__.py` | `py` | 0 | Backend HTTP route module (__init__); request/response and route-level authorization entry point. |
| `apps/api/app/routes/audit_routes.py` | `py` | 1435 | Backend HTTP route module (audit_routes); request/response and route-level authorization entry point. |
| `apps/api/app/routes/auth_routes.py` | `py` | 6305 | Backend HTTP route module (auth_routes); request/response and route-level authorization entry point. |
| `apps/api/app/routes/case_routes.py` | `py` | 4887 | Backend HTTP route module (case_routes); request/response and route-level authorization entry point. |
| `apps/api/app/routes/demo_routes.py` | `py` | 1187 | Backend HTTP route module (demo_routes); request/response and route-level authorization entry point. |
| `apps/api/app/routes/evidence_routes.py` | `py` | 16550 | Backend HTTP route module (evidence_routes); request/response and route-level authorization entry point. |
| `apps/api/app/routes/graph_routes.py` | `py` | 17313 | Backend HTTP route module (graph_routes); request/response and route-level authorization entry point. |
| `apps/api/app/routes/integrity_routes.py` | `py` | 11344 | Backend HTTP route module (integrity_routes); request/response and route-level authorization entry point. |
| `apps/api/app/routes/listing.py` | `py` | 1350 | Backend HTTP route module (listing); request/response and route-level authorization entry point. |
| `apps/api/app/routes/report_routes.py` | `py` | 3891 | Backend HTTP route module (report_routes); request/response and route-level authorization entry point. |
| `apps/api/app/routes/review_routes.py` | `py` | 11898 | Backend HTTP route module (review_routes); request/response and route-level authorization entry point. |
| `apps/api/app/schemas.py` | `py` | 5186 | Backend application source/configuration in apps/api/app; role inferred from filename and extension. |
| `apps/api/app/seed.py` | `py` | 4614 | Backend application source/configuration in apps/api/app; role inferred from filename and extension. |
| `apps/api/app/services/__init__.py` | `py` | 0 | Backend service module (__init__); domain operation/adapter indicated by module name. |
| `apps/api/app/services/audit.py` | `py` | 4047 | Backend service module (audit); domain operation/adapter indicated by module name. |
| `apps/api/app/services/court_pdf.py` | `py` | 17131 | Backend service module (court_pdf); domain operation/adapter indicated by module name. |
| `apps/api/app/services/evidence_service.py` | `py` | 4701 | Backend service module (evidence_service); domain operation/adapter indicated by module name. |
| `apps/api/app/services/extract.py` | `py` | 240 | Backend service module (extract); domain operation/adapter indicated by module name. |
| `apps/api/app/services/extract_common.py` | `py` | 13834 | Backend service module (extract_common); domain operation/adapter indicated by module name. |
| `apps/api/app/services/extract_document.py` | `py` | 11572 | Backend service module (extract_document); domain operation/adapter indicated by module name. |
| `apps/api/app/services/extract_structured.py` | `py` | 9488 | Backend service module (extract_structured); domain operation/adapter indicated by module name. |
| `apps/api/app/services/graph.py` | `py` | 11398 | Backend service module (graph); domain operation/adapter indicated by module name. |
| `apps/api/app/services/graph_analytics.py` | `py` | 14042 | Backend service module (graph_analytics); domain operation/adapter indicated by module name. |
| `apps/api/app/services/integrity.py` | `py` | 13163 | Backend service module (integrity); domain operation/adapter indicated by module name. |
| `apps/api/app/services/kafka_bus.py` | `py` | 2963 | Backend service module (kafka_bus); domain operation/adapter indicated by module name. |
| `apps/api/app/services/masking.py` | `py` | 3230 | Backend service module (masking); domain operation/adapter indicated by module name. |
| `apps/api/app/services/neo4j_store.py` | `py` | 9271 | Backend service module (neo4j_store); domain operation/adapter indicated by module name. |
| `apps/api/app/services/nlp_adapter.py` | `py` | 8880 | Backend service module (nlp_adapter); domain operation/adapter indicated by module name. |
| `apps/api/app/services/ocr_adapter.py` | `py` | 7909 | Backend service module (ocr_adapter); domain operation/adapter indicated by module name. |
| `apps/api/app/services/pipeline.py` | `py` | 10382 | Backend service module (pipeline); domain operation/adapter indicated by module name. |
| `apps/api/app/services/ratelimit.py` | `py` | 3046 | Backend service module (ratelimit); domain operation/adapter indicated by module name. |
| `apps/api/app/services/report.py` | `py` | 5958 | Backend service module (report); domain operation/adapter indicated by module name. |
| `apps/api/app/services/resolution.py` | `py` | 7400 | Backend service module (resolution); domain operation/adapter indicated by module name. |
| `apps/api/app/services/scanner.py` | `py` | 3744 | Backend service module (scanner); domain operation/adapter indicated by module name. |
| `apps/api/app/services/storage.py` | `py` | 6542 | Backend service module (storage); domain operation/adapter indicated by module name. |
| `apps/api/app/tests/__init__.py` | `py` | 0 | Automated test module (__init__); assertions and fixtures define its exact coverage. |
| `apps/api/app/tests/conftest.py` | `py` | 5973 | Automated test module (conftest); assertions and fixtures define its exact coverage. |
| `apps/api/app/tests/test_archive_uploads.py` | `py` | 5588 | Automated test module (test_archive_uploads); assertions and fixtures define its exact coverage. |
| `apps/api/app/tests/test_case_create_assign.py` | `py` | 2853 | Automated test module (test_case_create_assign); assertions and fixtures define its exact coverage. |
| `apps/api/app/tests/test_case_people.py` | `py` | 1084 | Automated test module (test_case_people); assertions and fixtures define its exact coverage. |
| `apps/api/app/tests/test_clamav_live.py` | `py` | 2618 | Automated test module (test_clamav_live); assertions and fixtures define its exact coverage. |
| `apps/api/app/tests/test_cross_case_and_exports.py` | `py` | 25858 | Automated test module (test_cross_case_and_exports); assertions and fixtures define its exact coverage. |
| `apps/api/app/tests/test_extraction_failures.py` | `py` | 3974 | Automated test module (test_extraction_failures); assertions and fixtures define its exact coverage. |
| `apps/api/app/tests/test_graph_analysis.py` | `py` | 3660 | Automated test module (test_graph_analysis); assertions and fixtures define its exact coverage. |
| `apps/api/app/tests/test_kafka_path.py` | `py` | 1836 | Automated test module (test_kafka_path); assertions and fixtures define its exact coverage. |
| `apps/api/app/tests/test_listing_search.py` | `py` | 7121 | Automated test module (test_listing_search); assertions and fixtures define its exact coverage. |
| `apps/api/app/tests/test_merkle_rfc6962.py` | `py` | 4720 | Automated test module (test_merkle_rfc6962); assertions and fixtures define its exact coverage. |
| `apps/api/app/tests/test_migrations.py` | `py` | 5071 | Automated test module (test_migrations); assertions and fixtures define its exact coverage. |
| `apps/api/app/tests/test_neo4j_live.py` | `py` | 3709 | Automated test module (test_neo4j_live); assertions and fixtures define its exact coverage. |
| `apps/api/app/tests/test_ner_real_model.py` | `py` | 2056 | Automated test module (test_ner_real_model); assertions and fixtures define its exact coverage. |
| `apps/api/app/tests/test_new_components.py` | `py` | 17627 | Automated test module (test_new_components); assertions and fixtures define its exact coverage. |
| `apps/api/app/tests/test_provenance_and_decisions.py` | `py` | 12034 | Automated test module (test_provenance_and_decisions); assertions and fixtures define its exact coverage. |
| `apps/api/app/tests/test_ratelimit.py` | `py` | 3768 | Automated test module (test_ratelimit); assertions and fixtures define its exact coverage. |
| `apps/api/app/tests/test_scanner_parsing.py` | `py` | 2760 | Automated test module (test_scanner_parsing); assertions and fixtures define its exact coverage. |
| `apps/api/app/tests/test_security.py` | `py` | 22834 | Automated test module (test_security); assertions and fixtures define its exact coverage. |
| `apps/api/app/tests/test_storage_s3.py` | `py` | 4219 | Automated test module (test_storage_s3); assertions and fixtures define its exact coverage. |
| `apps/api/app/tests/test_user_management.py` | `py` | 5596 | Automated test module (test_user_management); assertions and fixtures define its exact coverage. |
| `apps/api/app/tests/test_workflow.py` | `py` | 8497 | Automated test module (test_workflow); assertions and fixtures define its exact coverage. |
| `apps/api/app/tests/test_workflow_restored.py` | `py` | 12097 | Automated test module (test_workflow_restored); assertions and fixtures define its exact coverage. |
| `apps/api/constraints.txt` | `txt` | 1867 | Backend application source/configuration in apps/api; role inferred from filename and extension. |
| `apps/api/migrations/README` | `README` | 38 | Backend application source/configuration in apps/api/migrations; role inferred from filename and extension. |
| `apps/api/migrations/env.py` | `py` | 2779 | Backend application source/configuration in apps/api/migrations; role inferred from filename and extension. |
| `apps/api/migrations/script.py.mako` | `mako` | 704 | Backend application source/configuration in apps/api/migrations; role inferred from filename and extension. |
| `apps/api/migrations/versions/39486e0cbb1c_add_authority_reference_to_cases_and_.py` | `py` | 2120 | Backend application source/configuration in apps/api/migrations/versions; role inferred from filename and extension. |
| `apps/api/migrations/versions/5bcde1234567_add_audit_signature.py` | `py` | 753 | Backend application source/configuration in apps/api/migrations/versions; role inferred from filename and extension. |
| `apps/api/migrations/versions/5bcde1234568_uix_evidence_case_sha.py` | `py` | 729 | Backend application source/configuration in apps/api/migrations/versions; role inferred from filename and extension. |
| `apps/api/migrations/versions/5bcde1234569_add_ledger_anchors_and_mc_assignment.py` | `py` | 2581 | Backend application source/configuration in apps/api/migrations/versions; role inferred from filename and extension. |
| `apps/api/migrations/versions/5bcde1234570_ledger_anchor_merkle_scheme.py` | `py` | 732 | Backend application source/configuration in apps/api/migrations/versions; role inferred from filename and extension. |
| `apps/api/migrations/versions/96ad003ca363_initial_schema.py` | `py` | 14134 | Backend application source/configuration in apps/api/migrations/versions; role inferred from filename and extension. |
| `apps/api/migrations/versions/b9b204cf821f_add_classification_jurisdiction_purpose_.py` | `py` | 2337 | Backend application source/configuration in apps/api/migrations/versions; role inferred from filename and extension. |
| `apps/api/requirements-dev.txt` | `txt` | 125 | Backend application source/configuration in apps/api; role inferred from filename and extension. |
| `apps/api/requirements-kafka.txt` | `txt` | 105 | Backend application source/configuration in apps/api; role inferred from filename and extension. |
| `apps/api/requirements-ledger.txt` | `txt` | 371 | Backend application source/configuration in apps/api; role inferred from filename and extension. |
| `apps/api/requirements-ml.txt` | `txt` | 299 | Backend application source/configuration in apps/api; role inferred from filename and extension. |
| `apps/api/requirements.txt` | `txt` | 600 | Backend application source/configuration in apps/api; role inferred from filename and extension. |
| `apps/web/.env.example` | `example` | 82 | Project file in apps/web; type/role inferred from filename and directory; inspect file for exact behavior. |
| `apps/web/.gitignore` | `gitignore` | 279 | Project file in apps/web; type/role inferred from filename and directory; inspect file for exact behavior. |
| `apps/web/.oxlintrc.json` | `json` | 245 | Structured configuration/data file in apps/web; consumer and schema indicated by filename. |
| `apps/web/README.md` | `md` | 148 | Root-level project guidance, status, audit, or history document; subject indicated by filename/title. |
| `apps/web/index.html` | `html` | 362 | Project file in apps/web; type/role inferred from filename and directory; inspect file for exact behavior. |
| `apps/web/package-lock.json` | `json` | 117281 | Structured configuration/data file in apps/web; consumer and schema indicated by filename. |
| `apps/web/package.json` | `json` | 1470 | Structured configuration/data file in apps/web; consumer and schema indicated by filename. |
| `apps/web/public/favicon.svg` | `svg` | 9522 | Static visual/document/font asset in apps/web/public; binary contents are preserved in snapshot, not text-expanded here. |
| `apps/web/src/App.tsx` | `tsx` | 296 | Frontend application source/configuration in apps/web/src; role inferred from filename and extension. |
| `apps/web/src/app/providers/app-providers.tsx` | `tsx` | 754 | Frontend application source/configuration in apps/web/src/app/providers; role inferred from filename and extension. |
| `apps/web/src/app/router/router.tsx` | `tsx` | 4566 | Frontend application source/configuration in apps/web/src/app/router; role inferred from filename and extension. |
| `apps/web/src/components/auth/protected-route.tsx` | `tsx` | 716 | Reusable frontend component in apps/web/src/components/auth; UI behavior named by file. |
| `apps/web/src/components/evidence/ProvenanceViewer.tsx` | `tsx` | 6114 | Reusable frontend component in apps/web/src/components/evidence; UI behavior named by file. |
| `apps/web/src/components/evidence/SvgBoundingBoxOverlay.tsx` | `tsx` | 4899 | Reusable frontend component in apps/web/src/components/evidence; UI behavior named by file. |
| `apps/web/src/components/graph/GraphCanvas.tsx` | `tsx` | 4587 | Reusable frontend component in apps/web/src/components/graph; UI behavior named by file. |
| `apps/web/src/components/graph/GraphCanvasBoundary.tsx` | `tsx` | 1246 | Reusable frontend component in apps/web/src/components/graph; UI behavior named by file. |
| `apps/web/src/components/graph/GraphLegend.tsx` | `tsx` | 3917 | Reusable frontend component in apps/web/src/components/graph; UI behavior named by file. |
| `apps/web/src/components/graph/GraphListView.tsx` | `tsx` | 7112 | Reusable frontend component in apps/web/src/components/graph; UI behavior named by file. |
| `apps/web/src/components/graph/GraphToolbar.tsx` | `tsx` | 9033 | Reusable frontend component in apps/web/src/components/graph; UI behavior named by file. |
| `apps/web/src/components/graph/TemporalSlider.tsx` | `tsx` | 6543 | Reusable frontend component in apps/web/src/components/graph; UI behavior named by file. |
| `apps/web/src/components/graph/drawers/EdgeDrawer.tsx` | `tsx` | 6787 | Reusable frontend component in apps/web/src/components/graph/drawers; UI behavior named by file. |
| `apps/web/src/components/graph/drawers/EmptyDrawer.tsx` | `tsx` | 1649 | Reusable frontend component in apps/web/src/components/graph/drawers; UI behavior named by file. |
| `apps/web/src/components/graph/drawers/EntityDrawer.tsx` | `tsx` | 9053 | Reusable frontend component in apps/web/src/components/graph/drawers; UI behavior named by file. |
| `apps/web/src/components/graph/engine/GraphEngine.ts` | `ts` | 36206 | Reusable frontend component in apps/web/src/components/graph/engine; UI behavior named by file. |
| `apps/web/src/components/graph/filters/ConfidenceRangeFilter.tsx` | `tsx` | 3422 | Reusable frontend component in apps/web/src/components/graph/filters; UI behavior named by file. |
| `apps/web/src/components/graph/filters/DateRangeFilter.tsx` | `tsx` | 5472 | Reusable frontend component in apps/web/src/components/graph/filters; UI behavior named by file. |
| `apps/web/src/components/graph/filters/EntityTypeFilter.tsx` | `tsx` | 2434 | Reusable frontend component in apps/web/src/components/graph/filters; UI behavior named by file. |
| `apps/web/src/components/graph/filters/GraphFilterPanel.tsx` | `tsx` | 4224 | Reusable frontend component in apps/web/src/components/graph/filters; UI behavior named by file. |
| `apps/web/src/components/graph/filters/RelationshipTypeFilter.tsx` | `tsx` | 2430 | Reusable frontend component in apps/web/src/components/graph/filters; UI behavior named by file. |
| `apps/web/src/components/graph/filters/TierFilter.tsx` | `tsx` | 2883 | Reusable frontend component in apps/web/src/components/graph/filters; UI behavior named by file. |
| `apps/web/src/components/intelligence/confidence-meter.tsx` | `tsx` | 1996 | Reusable frontend component in apps/web/src/components/intelligence; UI behavior named by file. |
| `apps/web/src/components/intelligence/entity-badge.tsx` | `tsx` | 1533 | Reusable frontend component in apps/web/src/components/intelligence; UI behavior named by file. |
| `apps/web/src/components/intelligence/evidence-tier-badge.tsx` | `tsx` | 2233 | Reusable frontend component in apps/web/src/components/intelligence; UI behavior named by file. |
| `apps/web/src/components/intelligence/pii-field.tsx` | `tsx` | 3314 | Reusable frontend component in apps/web/src/components/intelligence; UI behavior named by file. |
| `apps/web/src/components/intelligence/relationship-badge.tsx` | `tsx` | 2204 | Reusable frontend component in apps/web/src/components/intelligence; UI behavior named by file. |
| `apps/web/src/components/intelligence/reveal-identity-modal.tsx` | `tsx` | 13745 | Reusable frontend component in apps/web/src/components/intelligence; UI behavior named by file. |
| `apps/web/src/components/layout/page.tsx` | `tsx` | 11061 | Reusable frontend component in apps/web/src/components/layout; UI behavior named by file. |
| `apps/web/src/components/security/security-status-bar.tsx` | `tsx` | 2512 | Reusable frontend component in apps/web/src/components/security; UI behavior named by file. |
| `apps/web/src/components/ui/badge.tsx` | `tsx` | 1879 | Reusable frontend component in apps/web/src/components/ui; UI behavior named by file. |
| `apps/web/src/components/ui/button.tsx` | `tsx` | 3606 | Reusable frontend component in apps/web/src/components/ui; UI behavior named by file. |
| `apps/web/src/components/ui/charts.tsx` | `tsx` | 11773 | Reusable frontend component in apps/web/src/components/ui; UI behavior named by file. |
| `apps/web/src/components/ui/checkbox.tsx` | `tsx` | 1124 | Reusable frontend component in apps/web/src/components/ui; UI behavior named by file. |
| `apps/web/src/components/ui/dialog.tsx` | `tsx` | 3454 | Reusable frontend component in apps/web/src/components/ui; UI behavior named by file. |
| `apps/web/src/components/ui/reason-dialog.tsx` | `tsx` | 3855 | Reusable frontend component in apps/web/src/components/ui; UI behavior named by file. |
| `apps/web/src/components/ui/separator.tsx` | `tsx` | 573 | Reusable frontend component in apps/web/src/components/ui; UI behavior named by file. |
| `apps/web/src/components/ui/status-badge.tsx` | `tsx` | 4631 | Reusable frontend component in apps/web/src/components/ui; UI behavior named by file. |
| `apps/web/src/components/ui/status-dot.tsx` | `tsx` | 1209 | Reusable frontend component in apps/web/src/components/ui; UI behavior named by file. |
| `apps/web/src/components/ui/tabs.tsx` | `tsx` | 1732 | Reusable frontend component in apps/web/src/components/ui; UI behavior named by file. |
| `apps/web/src/components/ui/tooltip.tsx` | `tsx` | 973 | Reusable frontend component in apps/web/src/components/ui; UI behavior named by file. |
| `apps/web/src/constants/evidenceTiers.ts` | `ts` | 3207 | Frontend application source/configuration in apps/web/src/constants; role inferred from filename and extension. |
| `apps/web/src/constants/navigation.ts` | `ts` | 947 | Frontend application source/configuration in apps/web/src/constants; role inferred from filename and extension. |
| `apps/web/src/features/admin/user-management-page.tsx` | `tsx` | 16227 | Frontend feature/page module in apps/web/src/features/admin; user flow named by file. |
| `apps/web/src/features/audit/global-audit-page.tsx` | `tsx` | 7592 | Frontend feature/page module in apps/web/src/features/audit; user flow named by file. |
| `apps/web/src/features/auth/login-page.tsx` | `tsx` | 8047 | Frontend feature/page module in apps/web/src/features/auth; user flow named by file. |
| `apps/web/src/features/cases/analysis/case-analysis-page.tsx` | `tsx` | 8792 | Frontend feature/page module in apps/web/src/features/cases/analysis; user flow named by file. |
| `apps/web/src/features/cases/audit/audit-detail-drawer.tsx` | `tsx` | 9362 | Frontend feature/page module in apps/web/src/features/cases/audit; user flow named by file. |
| `apps/web/src/features/cases/audit/audit-event-card.tsx` | `tsx` | 8734 | Frontend feature/page module in apps/web/src/features/cases/audit; user flow named by file. |
| `apps/web/src/features/cases/audit/audit-filter-bar.tsx` | `tsx` | 5344 | Frontend feature/page module in apps/web/src/features/cases/audit; user flow named by file. |
| `apps/web/src/features/cases/audit/audit-integrity-header.tsx` | `tsx` | 2892 | Frontend feature/page module in apps/web/src/features/cases/audit; user flow named by file. |
| `apps/web/src/features/cases/audit/case-audit-view.tsx` | `tsx` | 6098 | Frontend feature/page module in apps/web/src/features/cases/audit; user flow named by file. |
| `apps/web/src/features/cases/case-context.tsx` | `tsx` | 3067 | Frontend feature/page module in apps/web/src/features/cases; user flow named by file. |
| `apps/web/src/features/cases/case-graph-page.tsx` | `tsx` | 6768 | Frontend feature/page module in apps/web/src/features/cases; user flow named by file. |
| `apps/web/src/features/cases/case-layout.tsx` | `tsx` | 5325 | Frontend feature/page module in apps/web/src/features/cases; user flow named by file. |
| `apps/web/src/features/cases/case-table.tsx` | `tsx` | 4347 | Frontend feature/page module in apps/web/src/features/cases; user flow named by file. |
| `apps/web/src/features/cases/cases-directory-page.tsx` | `tsx` | 9790 | Frontend feature/page module in apps/web/src/features/cases; user flow named by file. |
| `apps/web/src/features/cases/components/assign-person-dialog.tsx` | `tsx` | 5261 | Frontend feature/page module in apps/web/src/features/cases/components; user flow named by file. |
| `apps/web/src/features/cases/components/case-overview-view.tsx` | `tsx` | 18633 | Frontend feature/page module in apps/web/src/features/cases/components; user flow named by file. |
| `apps/web/src/features/cases/evidence/case-evidence-view.tsx` | `tsx` | 14511 | Frontend feature/page module in apps/web/src/features/cases/evidence; user flow named by file. |
| `apps/web/src/features/cases/evidence/evidence-detail-drawer.tsx` | `tsx` | 12207 | Frontend feature/page module in apps/web/src/features/cases/evidence; user flow named by file. |
| `apps/web/src/features/cases/evidence/evidence-format.ts` | `ts` | 1028 | Frontend feature/page module in apps/web/src/features/cases/evidence; user flow named by file. |
| `apps/web/src/features/cases/map/investigation-map-view.tsx` | `tsx` | 8632 | Frontend feature/page module in apps/web/src/features/cases/map; user flow named by file. |
| `apps/web/src/features/cases/reviews/case-reviews-view.tsx` | `tsx` | 5748 | Frontend feature/page module in apps/web/src/features/cases/reviews; user flow named by file. |
| `apps/web/src/features/cases/timeline/case-timeline.tsx` | `tsx` | 8959 | Frontend feature/page module in apps/web/src/features/cases/timeline; user flow named by file. |
| `apps/web/src/features/cases/timeline/timeline-event-icon.tsx` | `tsx` | 1 | Frontend feature/page module in apps/web/src/features/cases/timeline; user flow named by file. |
| `apps/web/src/features/cases/timeline/timeline-event-row.tsx` | `tsx` | 6948 | Frontend feature/page module in apps/web/src/features/cases/timeline; user flow named by file. |
| `apps/web/src/features/cases/timeline/timeline-filter-bar.tsx` | `tsx` | 4249 | Frontend feature/page module in apps/web/src/features/cases/timeline; user flow named by file. |
| `apps/web/src/features/command-center/command-center-page.tsx` | `tsx` | 7233 | Frontend feature/page module in apps/web/src/features/command-center; user flow named by file. |
| `apps/web/src/features/not-found/not-found-page.tsx` | `tsx` | 1258 | Frontend feature/page module in apps/web/src/features/not-found; user flow named by file. |
| `apps/web/src/features/not-found/route-error-page.tsx` | `tsx` | 1323 | Frontend feature/page module in apps/web/src/features/not-found; user flow named by file. |
| `apps/web/src/features/profile/profile-page.tsx` | `tsx` | 4469 | Frontend feature/page module in apps/web/src/features/profile; user flow named by file. |
| `apps/web/src/features/reports/reports-page.tsx` | `tsx` | 6153 | Frontend feature/page module in apps/web/src/features/reports; user flow named by file. |
| `apps/web/src/features/review/review-api.ts` | `ts` | 2156 | Frontend feature/page module in apps/web/src/features/review; user flow named by file. |
| `apps/web/src/features/review/review-page.tsx` | `tsx` | 19265 | Frontend feature/page module in apps/web/src/features/review; user flow named by file. |
| `apps/web/src/features/review/source-pane.tsx` | `tsx` | 5041 | Frontend feature/page module in apps/web/src/features/review; user flow named by file. |
| `apps/web/src/index.css` | `css` | 5743 | Frontend application source/configuration in apps/web/src; role inferred from filename and extension. |
| `apps/web/src/layouts/AppShell/app-shell.tsx` | `tsx` | 1131 | Frontend application source/configuration in apps/web/src/layouts/AppShell; role inferred from filename and extension. |
| `apps/web/src/layouts/AppShell/sidebar.tsx` | `tsx` | 5066 | Frontend application source/configuration in apps/web/src/layouts/AppShell; role inferred from filename and extension. |
| `apps/web/src/lib/formatters.ts` | `ts` | 4826 | Frontend application source/configuration in apps/web/src/lib; role inferred from filename and extension. |
| `apps/web/src/lib/graphFilters.ts` | `ts` | 4090 | Frontend application source/configuration in apps/web/src/lib; role inferred from filename and extension. |
| `apps/web/src/lib/permissions.ts` | `ts` | 3400 | Frontend application source/configuration in apps/web/src/lib; role inferred from filename and extension. |
| `apps/web/src/lib/pii.ts` | `ts` | 4559 | Frontend application source/configuration in apps/web/src/lib; role inferred from filename and extension. |
| `apps/web/src/lib/test-hooks.ts` | `ts` | 455 | Frontend application source/configuration in apps/web/src/lib; role inferred from filename and extension. |
| `apps/web/src/lib/use-debounced.ts` | `ts` | 404 | Frontend application source/configuration in apps/web/src/lib; role inferred from filename and extension. |
| `apps/web/src/lib/utils.ts` | `ts` | 2385 | Frontend application source/configuration in apps/web/src/lib; role inferred from filename and extension. |
| `apps/web/src/lib/webgl.ts` | `ts` | 414 | Frontend application source/configuration in apps/web/src/lib; role inferred from filename and extension. |
| `apps/web/src/main.tsx` | `tsx` | 230 | Frontend application source/configuration in apps/web/src; role inferred from filename and extension. |
| `apps/web/src/services/api/auditApi.ts` | `ts` | 757 | Frontend API client/service in apps/web/src/services/api; backend domain named by file. |
| `apps/web/src/services/api/casesApi.ts` | `ts` | 4525 | Frontend API client/service in apps/web/src/services/api; backend domain named by file. |
| `apps/web/src/services/api/claimsApi.ts` | `ts` | 673 | Frontend API client/service in apps/web/src/services/api; backend domain named by file. |
| `apps/web/src/services/api/demoApi.ts` | `ts` | 335 | Frontend API client/service in apps/web/src/services/api; backend domain named by file. |
| `apps/web/src/services/api/entityApi.ts` | `ts` | 388 | Frontend API client/service in apps/web/src/services/api; backend domain named by file. |
| `apps/web/src/services/api/evidenceApi.ts` | `ts` | 5792 | Frontend API client/service in apps/web/src/services/api; backend domain named by file. |
| `apps/web/src/services/api/graphApi.ts` | `ts` | 4224 | Frontend API client/service in apps/web/src/services/api; backend domain named by file. |
| `apps/web/src/services/api/integrityApi.ts` | `ts` | 1346 | Frontend API client/service in apps/web/src/services/api; backend domain named by file. |
| `apps/web/src/services/api/real_client.ts` | `ts` | 4294 | Frontend API client/service in apps/web/src/services/api; backend domain named by file. |
| `apps/web/src/services/api/reportApi.ts` | `ts` | 659 | Frontend API client/service in apps/web/src/services/api; backend domain named by file. |
| `apps/web/src/services/api/revealApi.ts` | `ts` | 1429 | Frontend API client/service in apps/web/src/services/api; backend domain named by file. |
| `apps/web/src/services/api/timelineApi.ts` | `ts` | 776 | Frontend API client/service in apps/web/src/services/api; backend domain named by file. |
| `apps/web/src/services/api/usersApi.ts` | `ts` | 1564 | Frontend API client/service in apps/web/src/services/api; backend domain named by file. |
| `apps/web/src/stores/auditStore.ts` | `ts` | 4393 | Frontend state store (auditStore); state domain named by file. |
| `apps/web/src/stores/authStore.ts` | `ts` | 5274 | Frontend state store (authStore); state domain named by file. |
| `apps/web/src/stores/graphStore.ts` | `ts` | 12641 | Frontend state store (graphStore); state domain named by file. |
| `apps/web/src/stores/provenanceStore.ts` | `ts` | 2243 | Frontend state store (provenanceStore); state domain named by file. |
| `apps/web/src/stores/revealStore.ts` | `ts` | 4283 | Frontend state store (revealStore); state domain named by file. |
| `apps/web/src/stores/timelineStore.ts` | `ts` | 3678 | Frontend state store (timelineStore); state domain named by file. |
| `apps/web/src/stores/uiStore.ts` | `ts` | 1207 | Frontend state store (uiStore); state domain named by file. |
| `apps/web/src/styles/tokens.css` | `css` | 5694 | Frontend application source/configuration in apps/web/src/styles; role inferred from filename and extension. |
| `apps/web/src/styles/typography.css` | `css` | 868 | Frontend application source/configuration in apps/web/src/styles; role inferred from filename and extension. |
| `apps/web/src/types/alert.ts` | `ts` | 854 | Frontend TypeScript domain contract (alert); data area named by file. |
| `apps/web/src/types/audit.ts` | `ts` | 641 | Frontend TypeScript domain contract (audit); data area named by file. |
| `apps/web/src/types/case.ts` | `ts` | 850 | Frontend TypeScript domain contract (case); data area named by file. |
| `apps/web/src/types/entity.ts` | `ts` | 5889 | Frontend TypeScript domain contract (entity); data area named by file. |
| `apps/web/src/types/evidence.ts` | `ts` | 976 | Frontend TypeScript domain contract (evidence); data area named by file. |
| `apps/web/src/types/note.ts` | `ts` | 983 | Frontend TypeScript domain contract (note); data area named by file. |
| `apps/web/src/types/reveal.ts` | `ts` | 733 | Frontend TypeScript domain contract (reveal); data area named by file. |
| `apps/web/src/types/timeline.ts` | `ts` | 683 | Frontend TypeScript domain contract (timeline); data area named by file. |
| `apps/web/tsconfig.app.json` | `json` | 724 | Structured configuration/data file in apps/web; consumer and schema indicated by filename. |
| `apps/web/tsconfig.json` | `json` | 119 | Structured configuration/data file in apps/web; consumer and schema indicated by filename. |
| `apps/web/tsconfig.node.json` | `json` | 560 | Structured configuration/data file in apps/web; consumer and schema indicated by filename. |
| `apps/web/vercel.json` | `json` | 184 | Structured configuration/data file in apps/web; consumer and schema indicated by filename. |
| `apps/web/vite.config.ts` | `ts` | 396 | Project file in apps/web; type/role inferred from filename and directory; inspect file for exact behavior. |
| `audit/BUG_AND_DEFECT_REGISTER.md` | `md` | 42717 | Project documentation/evidence artifact in audit; subject indicated by filename/title. |
| `audit/CLAIM_REGISTER.md` | `md` | 2821 | Project documentation/evidence artifact in audit; subject indicated by filename/title. |
| `audit/FRONTEND_BACKEND_CONTRACT.md` | `md` | 0 | Project documentation/evidence artifact in audit; subject indicated by filename/title. |
| `audit/FRONTEND_MERGE_MANIFEST.md` | `md` | 14416 | Project documentation/evidence artifact in audit; subject indicated by filename/title. |
| `audit/FRONTEND_REPAIR_LOG.md` | `md` | 294 | Project documentation/evidence artifact in audit; subject indicated by filename/title. |
| `audit/FRONTEND_SECURITY_REVIEW.md` | `md` | 158 | Project documentation/evidence artifact in audit; subject indicated by filename/title. |
| `audit/FRONTEND_VERIFICATION.md` | `md` | 1215 | Project documentation/evidence artifact in audit; subject indicated by filename/title. |
| `audit/IMPLEMENTATION_EVIDENCE.md` | `md` | 894 | Project documentation/evidence artifact in audit; subject indicated by filename/title. |
| `audit/PROJECT_SNAPSHOT_COMPARISON.md` | `md` | 2307 | Project documentation/evidence artifact in audit; subject indicated by filename/title. |
| `audit/PROJECT_SOURCE_RECONCILIATION.md` | `md` | 8199 | Project documentation/evidence artifact in audit; subject indicated by filename/title. |
| `audit/RELEASE_READINESS_REPORT.md` | `md` | 5908 | Project documentation/evidence artifact in audit; subject indicated by filename/title. |
| `audit/REPOSITORY_INVENTORY.md` | `md` | 3511 | Project documentation/evidence artifact in audit; subject indicated by filename/title. |
| `audit/SESSION_4_COMPLETE_WORK_LOG.md` | `md` | 24847 | Project documentation/evidence artifact in audit; subject indicated by filename/title. |
| `audit/SOURCE_OF_TRUTH.md` | `md` | 2212 | Project documentation/evidence artifact in audit; subject indicated by filename/title. |
| `audit/TECHNICAL_AUDIT_REPORT.md` | `md` | 3103 | Project documentation/evidence artifact in audit; subject indicated by filename/title. |
| `audit/TEST_RESULTS.md` | `md` | 11266 | Project documentation/evidence artifact in audit; subject indicated by filename/title. |
| `audit/browser/screenshots/cases.png` | `png` | 93498 | Project documentation/evidence artifact in audit/browser/screenshots; subject indicated by filename/title. |
| `audit/browser/screenshots/cases_CASE-0001.png` | `png` | 163824 | Project documentation/evidence artifact in audit/browser/screenshots; subject indicated by filename/title. |
| `audit/browser/screenshots/cases_CASE-0001_analysis.png` | `png` | 158790 | Project documentation/evidence artifact in audit/browser/screenshots; subject indicated by filename/title. |
| `audit/browser/screenshots/cases_CASE-0001_audit.png` | `png` | 161689 | Project documentation/evidence artifact in audit/browser/screenshots; subject indicated by filename/title. |
| `audit/browser/screenshots/cases_CASE-0001_evidence.png` | `png` | 153470 | Project documentation/evidence artifact in audit/browser/screenshots; subject indicated by filename/title. |
| `audit/browser/screenshots/cases_CASE-0001_graph.png` | `png` | 269822 | Project documentation/evidence artifact in audit/browser/screenshots; subject indicated by filename/title. |
| `audit/browser/screenshots/cases_CASE-0001_hitl.png` | `png` | 159202 | Project documentation/evidence artifact in audit/browser/screenshots; subject indicated by filename/title. |
| `audit/browser/screenshots/cases_CASE-0001_map.png` | `png` | 136885 | Project documentation/evidence artifact in audit/browser/screenshots; subject indicated by filename/title. |
| `audit/browser/screenshots/cases_CASE-0001_report.png` | `png` | 66643 | Project documentation/evidence artifact in audit/browser/screenshots; subject indicated by filename/title. |
| `audit/browser/screenshots/cases_CASE-0001_reviews.png` | `png` | 176841 | Project documentation/evidence artifact in audit/browser/screenshots; subject indicated by filename/title. |
| `audit/browser/screenshots/cases_CASE-0001_timeline.png` | `png` | 185248 | Project documentation/evidence artifact in audit/browser/screenshots; subject indicated by filename/title. |
| `audit/browser/screenshots/command-center.png` | `png` | 80540 | Project documentation/evidence artifact in audit/browser/screenshots; subject indicated by filename/title. |
| `audit/browser/screenshots/profile.png` | `png` | 132756 | Project documentation/evidence artifact in audit/browser/screenshots; subject indicated by filename/title. |
| `audit/browser/screenshots/settings.png` | `png` | 67936 | Project documentation/evidence artifact in audit/browser/screenshots; subject indicated by filename/title. |
| `audit/browser/screenshots/unassigned_case0001_graph.png` | `png` | 96177 | Project documentation/evidence artifact in audit/browser/screenshots; subject indicated by filename/title. |
| `data/evaluation/ground_truth.json` | `json` | 311 | Structured configuration/data file in data/evaluation; consumer and schema indicated by filename. |
| `data/evaluation/ner_synthetic_v1.json` | `json` | 30361 | Structured configuration/data file in data/evaluation; consumer and schema indicated by filename. |
| `data/synthetic/aliases.json` | `json` | 343 | Synthetic fixture or generator in data/synthetic; fictional input/data role indicated by filename. |
| `data/synthetic/calls.csv` | `csv` | 44440 | Synthetic fixture or generator in data/synthetic; fictional input/data role indicated by filename. |
| `data/synthetic/cases.json` | `json` | 15852 | Synthetic fixture or generator in data/synthetic; fictional input/data role indicated by filename. |
| `data/synthetic/corrupt/calls_corrupt.csv` | `csv` | 108 | Synthetic fixture or generator in data/synthetic/corrupt; fictional input/data role indicated by filename. |
| `data/synthetic/corrupt/fir_001_truncated.pdf` | `pdf` | 837 | Synthetic fixture or generator in data/synthetic/corrupt; fictional input/data role indicated by filename. |
| `data/synthetic/documents/eicar_test.txt` | `txt` | 68 | Synthetic fixture or generator in data/synthetic/documents; fictional input/data role indicated by filename. |
| `data/synthetic/documents/fir_001.pdf` | `pdf` | 2511 | Synthetic fixture or generator in data/synthetic/documents; fictional input/data role indicated by filename. |
| `data/synthetic/documents/fir_001.txt` | `txt` | 1299 | Synthetic fixture or generator in data/synthetic/documents; fictional input/data role indicated by filename. |
| `data/synthetic/documents/fir_001_TAMPERED.txt` | `txt` | 1299 | Synthetic fixture or generator in data/synthetic/documents; fictional input/data role indicated by filename. |
| `data/synthetic/generate.py` | `py` | 53238 | Synthetic fixture or generator in data/synthetic; fictional input/data role indicated by filename. |
| `data/synthetic/golden/aliases.json` | `json` | 343 | Synthetic fixture or generator in data/synthetic/golden; fictional input/data role indicated by filename. |
| `data/synthetic/golden/calls.csv` | `csv` | 6494 | Synthetic fixture or generator in data/synthetic/golden; fictional input/data role indicated by filename. |
| `data/synthetic/golden/cases.json` | `json` | 15852 | Synthetic fixture or generator in data/synthetic/golden; fictional input/data role indicated by filename. |
| `data/synthetic/golden/corrupt/calls_corrupt.csv` | `csv` | 108 | Synthetic fixture or generator in data/synthetic/golden/corrupt; fictional input/data role indicated by filename. |
| `data/synthetic/golden/corrupt/fir_001_truncated.pdf` | `pdf` | 837 | Synthetic fixture or generator in data/synthetic/golden/corrupt; fictional input/data role indicated by filename. |
| `data/synthetic/golden/documents/eicar_test.txt` | `txt` | 68 | Synthetic fixture or generator in data/synthetic/golden/documents; fictional input/data role indicated by filename. |
| `data/synthetic/golden/documents/fir_001.pdf` | `pdf` | 2511 | Synthetic fixture or generator in data/synthetic/golden/documents; fictional input/data role indicated by filename. |
| `data/synthetic/golden/documents/fir_001.txt` | `txt` | 1299 | Synthetic fixture or generator in data/synthetic/golden/documents; fictional input/data role indicated by filename. |
| `data/synthetic/golden/documents/fir_001_TAMPERED.txt` | `txt` | 1299 | Synthetic fixture or generator in data/synthetic/golden/documents; fictional input/data role indicated by filename. |
| `data/synthetic/golden/locations.csv` | `csv` | 308 | Synthetic fixture or generator in data/synthetic/golden; fictional input/data role indicated by filename. |
| `data/synthetic/golden/people.json` | `json` | 3533 | Synthetic fixture or generator in data/synthetic/golden; fictional input/data role indicated by filename. |
| `data/synthetic/golden/transactions.csv` | `csv` | 2520 | Synthetic fixture or generator in data/synthetic/golden; fictional input/data role indicated by filename. |
| `data/synthetic/golden/transactions_case2.csv` | `csv` | 306 | Synthetic fixture or generator in data/synthetic/golden; fictional input/data role indicated by filename. |
| `data/synthetic/golden/truth-labels.json` | `json` | 2040 | Synthetic fixture or generator in data/synthetic/golden; fictional input/data role indicated by filename. |
| `data/synthetic/golden/vehicles.csv` | `csv` | 192 | Synthetic fixture or generator in data/synthetic/golden; fictional input/data role indicated by filename. |
| `data/synthetic/locations.csv` | `csv` | 308 | Synthetic fixture or generator in data/synthetic; fictional input/data role indicated by filename. |
| `data/synthetic/people.json` | `json` | 29606 | Synthetic fixture or generator in data/synthetic; fictional input/data role indicated by filename. |
| `data/synthetic/scale/aliases.json` | `json` | 343 | Synthetic fixture or generator in data/synthetic/scale; fictional input/data role indicated by filename. |
| `data/synthetic/scale/calls.csv` | `csv` | 44440 | Synthetic fixture or generator in data/synthetic/scale; fictional input/data role indicated by filename. |
| `data/synthetic/scale/cases.json` | `json` | 15852 | Synthetic fixture or generator in data/synthetic/scale; fictional input/data role indicated by filename. |
| `data/synthetic/scale/documents/eicar_test.txt` | `txt` | 68 | Synthetic fixture or generator in data/synthetic/scale/documents; fictional input/data role indicated by filename. |
| `data/synthetic/scale/documents/fir_001.pdf` | `pdf` | 2511 | Synthetic fixture or generator in data/synthetic/scale/documents; fictional input/data role indicated by filename. |
| `data/synthetic/scale/documents/fir_001.txt` | `txt` | 1299 | Synthetic fixture or generator in data/synthetic/scale/documents; fictional input/data role indicated by filename. |
| `data/synthetic/scale/documents/fir_001_TAMPERED.txt` | `txt` | 1299 | Synthetic fixture or generator in data/synthetic/scale/documents; fictional input/data role indicated by filename. |
| `data/synthetic/scale/locations.csv` | `csv` | 308 | Synthetic fixture or generator in data/synthetic/scale; fictional input/data role indicated by filename. |
| `data/synthetic/scale/people.json` | `json` | 29606 | Synthetic fixture or generator in data/synthetic/scale; fictional input/data role indicated by filename. |
| `data/synthetic/scale/transactions.csv` | `csv` | 23792 | Synthetic fixture or generator in data/synthetic/scale; fictional input/data role indicated by filename. |
| `data/synthetic/scale/transactions_case2.csv` | `csv` | 306 | Synthetic fixture or generator in data/synthetic/scale; fictional input/data role indicated by filename. |
| `data/synthetic/scale/truth-labels.json` | `json` | 2040 | Synthetic fixture or generator in data/synthetic/scale; fictional input/data role indicated by filename. |
| `data/synthetic/scale/vehicles.csv` | `csv` | 192 | Synthetic fixture or generator in data/synthetic/scale; fictional input/data role indicated by filename. |
| `data/synthetic/transactions.csv` | `csv` | 23792 | Synthetic fixture or generator in data/synthetic; fictional input/data role indicated by filename. |
| `data/synthetic/transactions_case2.csv` | `csv` | 306 | Synthetic fixture or generator in data/synthetic; fictional input/data role indicated by filename. |
| `data/synthetic/truth-labels.json` | `json` | 2040 | Synthetic fixture or generator in data/synthetic; fictional input/data role indicated by filename. |
| `data/synthetic/vehicles.csv` | `csv` | 192 | Synthetic fixture or generator in data/synthetic; fictional input/data role indicated by filename. |
| `docker-compose.override.yml` | `yml` | 551 | Structured configuration/data file in repository root; consumer and schema indicated by filename. |
| `docker-compose.yml` | `yml` | 9950 | Structured configuration/data file in repository root; consumer and schema indicated by filename. |
| `docs/API_ARCHITECTURE.md` | `md` | 3777 | Project documentation/evidence artifact in docs; subject indicated by filename/title. |
| `docs/ARCHITECTURE_DECISIONS.md` | `md` | 3929 | Project documentation/evidence artifact in docs; subject indicated by filename/title. |
| `docs/ARCHITECTURE_OVERVIEW.md` | `md` | 4796 | Project documentation/evidence artifact in docs; subject indicated by filename/title. |
| `docs/DATABASE_ARCHITECTURE.md` | `md` | 4383 | Project documentation/evidence artifact in docs; subject indicated by filename/title. |
| `docs/DATA_FLOW.md` | `md` | 2933 | Project documentation/evidence artifact in docs; subject indicated by filename/title. |
| `docs/DEPLOYMENT_ARCHITECTURE.md` | `md` | 3353 | Project documentation/evidence artifact in docs; subject indicated by filename/title. |
| `docs/FRONTEND_API_MAP.md` | `md` | 4130 | Project documentation/evidence artifact in docs; subject indicated by filename/title. |
| `docs/FRONTEND_ARCHITECTURE.md` | `md` | 1465 | Project documentation/evidence artifact in docs; subject indicated by filename/title. |
| `docs/MASTER_INTEGRATION_MATRIX.md` | `md` | 5005 | Project documentation/evidence artifact in docs; subject indicated by filename/title. |
| `docs/SECURITY_ARCHITECTURE.md` | `md` | 3333 | Project documentation/evidence artifact in docs; subject indicated by filename/title. |
| `docs/SYSTEM_COMPONENTS.md` | `md` | 3396 | Project documentation/evidence artifact in docs; subject indicated by filename/title. |
| `docs/adr/001-relational-database.md` | `md` | 3080 | Project documentation/evidence artifact in docs/adr; subject indicated by filename/title. |
| `docs/adr/002-graph-store.md` | `md` | 3995 | Project documentation/evidence artifact in docs/adr; subject indicated by filename/title. |
| `docs/adr/003-object-storage.md` | `md` | 3101 | Project documentation/evidence artifact in docs/adr; subject indicated by filename/title. |
| `docs/adr/004-async-queue.md` | `md` | 2955 | Project documentation/evidence artifact in docs/adr; subject indicated by filename/title. |
| `docs/adr/005-redis-scope.md` | `md` | 3510 | Project documentation/evidence artifact in docs/adr; subject indicated by filename/title. |
| `docs/adr/006-graph-renderer.md` | `md` | 4278 | Project documentation/evidence artifact in docs/adr; subject indicated by filename/title. |
| `docs/adr/007-authentication.md` | `md` | 3663 | Project documentation/evidence artifact in docs/adr; subject indicated by filename/title. |
| `docs/adr/008-masking-and-provenance.md` | `md` | 3505 | Project documentation/evidence artifact in docs/adr; subject indicated by filename/title. |
| `docs/adr/009-temporal-decay.md` | `md` | 3018 | Project documentation/evidence artifact in docs/adr; subject indicated by filename/title. |
| `docs/adr/010-integrity-mechanism.md` | `md` | 3285 | Project documentation/evidence artifact in docs/adr; subject indicated by filename/title. |
| `docs/adr/011-deployment-model.md` | `md` | 3903 | Project documentation/evidence artifact in docs/adr; subject indicated by filename/title. |
| `docs/adr/012-nlp-adapter.md` | `md` | 2586 | Project documentation/evidence artifact in docs/adr; subject indicated by filename/title. |
| `docs/adr/013-kafka-event-bus.md` | `md` | 2161 | Project documentation/evidence artifact in docs/adr; subject indicated by filename/title. |
| `docs/adr/014-merkle-besu-anchor.md` | `md` | 2932 | Project documentation/evidence artifact in docs/adr; subject indicated by filename/title. |
| `docs/adr/README.md` | `md` | 2118 | Project documentation/evidence artifact in docs/adr; subject indicated by filename/title. |
| `docs/architecture.md` | `md` | 4674 | Project documentation/evidence artifact in docs; subject indicated by filename/title. |
| `docs/architecture/BASELINE_ARCHITECTURE.md` | `md` | 15832 | Project documentation/evidence artifact in docs/architecture; subject indicated by filename/title. |
| `docs/architecture/SYSTEM_ARCHITECTURE.md` | `md` | 10405 | Project documentation/evidence artifact in docs/architecture; subject indicated by filename/title. |
| `docs/context.md` | `md` | 41169 | Project documentation/evidence artifact in docs; subject indicated by filename/title. |
| `docs/contracts.md` | `md` | 3614 | Project documentation/evidence artifact in docs; subject indicated by filename/title. |
| `docs/data-dictionary.md` | `md` | 2855 | Project documentation/evidence artifact in docs; subject indicated by filename/title. |
| `docs/demo-script.md` | `md` | 3216 | Project documentation/evidence artifact in docs; subject indicated by filename/title. |
| `docs/engineering/CODE_CLEANUP_REGISTER.md` | `md` | 3701 | Project documentation/evidence artifact in docs/engineering; subject indicated by filename/title. |
| `docs/engineering/CODING_STANDARDS.md` | `md` | 8497 | Project documentation/evidence artifact in docs/engineering; subject indicated by filename/title. |
| `docs/engineering/ERROR_HANDLING_STANDARD.md` | `md` | 7875 | Project documentation/evidence artifact in docs/engineering; subject indicated by filename/title. |
| `docs/engineering/REFACTORING_PLAN.md` | `md` | 7727 | Project documentation/evidence artifact in docs/engineering; subject indicated by filename/title. |
| `docs/engineering/REFACTORING_PROGRESS.md` | `md` | 7476 | Project documentation/evidence artifact in docs/engineering; subject indicated by filename/title. |
| `docs/engineering/TECHNICAL_DEBT_REGISTER.md` | `md` | 11116 | Project documentation/evidence artifact in docs/engineering; subject indicated by filename/title. |
| `docs/engineering/deployment/INFRASTRUCTURE_BASELINE.md` | `md` | 4375 | Project documentation/evidence artifact in docs/engineering/deployment; subject indicated by filename/title. |
| `docs/frontend/STATE_MANAGEMENT_ARCHITECTURE.md` | `md` | 4191 | Project documentation/evidence artifact in docs/frontend; subject indicated by filename/title. |
| `docs/limitations.md` | `md` | 6240 | Project documentation/evidence artifact in docs; subject indicated by filename/title. |
| `docs/project-overview.md` | `md` | 1245 | Project documentation/evidence artifact in docs; subject indicated by filename/title. |
| `docs/responsible-ai.md` | `md` | 1752 | Project documentation/evidence artifact in docs; subject indicated by filename/title. |
| `docs/security.md` | `md` | 3483 | Project documentation/evidence artifact in docs; subject indicated by filename/title. |
| `docs/sih_presentation_map.md` | `md` | 3313 | Project documentation/evidence artifact in docs; subject indicated by filename/title. |
| `docs/status.md` | `md` | 19519 | Project documentation/evidence artifact in docs; subject indicated by filename/title. |
| `docs/workflow.md` | `md` | 3292 | Project documentation/evidence artifact in docs; subject indicated by filename/title. |
| `frontend-audit/EXISTING_NAVIGATION_MAP.md` | `md` | 10655 | Project documentation/evidence artifact in frontend-audit; subject indicated by filename/title. |
| `frontend-audit/FRONTEND_ACCESSIBILITY_REPORT.md` | `md` | 4847 | Project documentation/evidence artifact in frontend-audit; subject indicated by filename/title. |
| `frontend-audit/FRONTEND_API_MAPPING.md` | `md` | 25079 | Project documentation/evidence artifact in frontend-audit; subject indicated by filename/title. |
| `frontend-audit/FRONTEND_BROWSER_TEST_REPORT.md` | `md` | 6830 | Project documentation/evidence artifact in frontend-audit; subject indicated by filename/title. |
| `frontend-audit/FRONTEND_CHANGELOG.md` | `md` | 5741 | Project documentation/evidence artifact in frontend-audit; subject indicated by filename/title. |
| `frontend-audit/FRONTEND_CONTINUATION_STATE.md` | `md` | 9429 | Project documentation/evidence artifact in frontend-audit; subject indicated by filename/title. |
| `frontend-audit/FRONTEND_DATA_DICTIONARY.md` | `md` | 27601 | Project documentation/evidence artifact in frontend-audit; subject indicated by filename/title. |
| `frontend-audit/FRONTEND_DEFECT_REGISTER.md` | `md` | 40905 | Project documentation/evidence artifact in frontend-audit; subject indicated by filename/title. |
| `frontend-audit/FRONTEND_IMPLEMENTATION_REPORT.md` | `md` | 5868 | Project documentation/evidence artifact in frontend-audit; subject indicated by filename/title. |
| `frontend-audit/FRONTEND_KNOWN_LIMITATIONS.md` | `md` | 3636 | Project documentation/evidence artifact in frontend-audit; subject indicated by filename/title. |
| `frontend-audit/FRONTEND_PAGE_INVENTORY.md` | `md` | 30716 | Project documentation/evidence artifact in frontend-audit; subject indicated by filename/title. |
| `frontend-audit/FRONTEND_REGRESSION_REPORT.md` | `md` | 3152 | Project documentation/evidence artifact in frontend-audit; subject indicated by filename/title. |
| `frontend-audit/FRONTEND_RESPONSIVE_REPORT.md` | `md` | 1562 | Project documentation/evidence artifact in frontend-audit; subject indicated by filename/title. |
| `frontend-audit/FRONTEND_SOURCE_INVENTORY.md` | `md` | 51123 | Project documentation/evidence artifact in frontend-audit; subject indicated by filename/title. |
| `frontend-audit/FRONTEND_USABILITY_COMPARISON.md` | `md` | 3032 | Project documentation/evidence artifact in frontend-audit; subject indicated by filename/title. |
| `frontend-audit/INTERACTION_REGISTER.md` | `md` | 64376 | Project documentation/evidence artifact in frontend-audit; subject indicated by filename/title. |
| `frontend-audit/a11y-after.json` | `json` | 397 | Project documentation/evidence artifact in frontend-audit; subject indicated by filename/title. |
| `frontend-audit/a11y-before.json` | `json` | 3692 | Project documentation/evidence artifact in frontend-audit; subject indicated by filename/title. |
| `frontend-audit/keyboard-audit.json` | `json` | 5747 | Project documentation/evidence artifact in frontend-audit; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/capture_log.json` | `json` | 18375 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/desktop_admin_audit.png` | `png` | 127907 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/desktop_admin_cases.png` | `png` | 163726 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/desktop_admin_settings.png` | `png` | 104563 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/desktop_analyst_cases_CASE-0001_reports.png` | `png` | 91507 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/desktop_analyst_cases_CASE-0001_review.png` | `png` | 122095 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/desktop_auditor_audit.png` | `png` | 127234 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/desktop_auditor_cases_CASE-0001.png` | `png` | 117589 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/desktop_auditor_command-center.png` | `png` | 128296 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/desktop_investigator_audit.png` | `png` | 44759 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/desktop_investigator_cases.png` | `png` | 63531 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/desktop_investigator_cases_CASE-0001.png` | `png` | 119249 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/desktop_investigator_cases_CASE-0001_analysis.png` | `png` | 107486 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/desktop_investigator_cases_CASE-0001_audit.png` | `png` | 156467 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/desktop_investigator_cases_CASE-0001_decisions.png` | `png` | 60956 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/desktop_investigator_cases_CASE-0001_evidence.png` | `png` | 159524 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/desktop_investigator_cases_CASE-0001_graph.png` | `png` | 267621 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/desktop_investigator_cases_CASE-0001_hitl.png` | `png` | 122891 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/desktop_investigator_cases_CASE-0001_locations.png` | `png` | 87981 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/desktop_investigator_cases_CASE-0001_map.png` | `png` | 87981 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/desktop_investigator_cases_CASE-0001_notes.png` | `png` | 119249 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/desktop_investigator_cases_CASE-0001_overview.png` | `png` | 119177 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/desktop_investigator_cases_CASE-0001_report.png` | `png` | 92286 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/desktop_investigator_cases_CASE-0001_reports.png` | `png` | 92286 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/desktop_investigator_cases_CASE-0001_review.png` | `png` | 122891 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/desktop_investigator_cases_CASE-0001_reviews.png` | `png` | 60956 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/desktop_investigator_cases_CASE-0001_timeline.png` | `png` | 119953 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/desktop_investigator_command-center.png` | `png` | 74212 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/desktop_investigator_home.png` | `png` | 74212 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/desktop_investigator_no-such-page.png` | `png` | 38238 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/desktop_investigator_profile.png` | `png` | 91649 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/desktop_investigator_settings.png` | `png` | 91649 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/desktop_officer_cases_CASE-0001_evidence.png` | `png` | 160575 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/desktop_officer_cases_CASE-0001_reports.png` | `png` | 96616 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/desktop_reviewer_cases_CASE-0001_review.png` | `png` | 121901 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/desktop_reviewer_command-center.png` | `png` | 73601 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/desktop_unassigned_cases.png` | `png` | 56757 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/desktop_unassigned_cases_CASE-0001.png` | `png` | 45723 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/phone_investigator_cases.png` | `png` | 33881 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/phone_investigator_cases_CASE-0001.png` | `png` | 52770 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/phone_investigator_cases_CASE-0001_analysis.png` | `png` | 57858 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/phone_investigator_cases_CASE-0001_audit.png` | `png` | 56646 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/phone_investigator_cases_CASE-0001_decisions.png` | `png` | 34425 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/phone_investigator_cases_CASE-0001_evidence.png` | `png` | 55109 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/phone_investigator_cases_CASE-0001_graph.png` | `png` | 48145 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/phone_investigator_cases_CASE-0001_locations.png` | `png` | 46467 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/phone_investigator_cases_CASE-0001_reports.png` | `png` | 52625 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/phone_investigator_cases_CASE-0001_review.png` | `png` | 60950 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/phone_investigator_cases_CASE-0001_timeline.png` | `png` | 63074 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/phone_investigator_command-center.png` | `png` | 44219 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/public-test-url-source.png` | `png` | 175222 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/tablet_investigator_cases.png` | `png` | 50915 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/tablet_investigator_cases_CASE-0001.png` | `png` | 92428 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/tablet_investigator_cases_CASE-0001_analysis.png` | `png` | 107570 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/tablet_investigator_cases_CASE-0001_audit.png` | `png` | 140001 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/tablet_investigator_cases_CASE-0001_decisions.png` | `png` | 47877 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/tablet_investigator_cases_CASE-0001_evidence.png` | `png` | 146777 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/tablet_investigator_cases_CASE-0001_graph.png` | `png` | 238646 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/tablet_investigator_cases_CASE-0001_locations.png` | `png` | 74861 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/tablet_investigator_cases_CASE-0001_reports.png` | `png` | 80964 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/tablet_investigator_cases_CASE-0001_review.png` | `png` | 115027 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/tablet_investigator_cases_CASE-0001_timeline.png` | `png` | 129183 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/tablet_investigator_command-center.png` | `png` | 61999 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/x_evidence_drawer.png` | `png` | 197514 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/x_phone_nav_open.png` | `png` | 28749 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/x_phone_review.png` | `png` | 60968 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/x_review_candidate.png` | `png` | 138355 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/x_review_candidate_full.png` | `png` | 138355 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/x_review_reason_dialog.png` | `png` | 145737 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/x_source_viewer.png` | `png` | 167286 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/after/x_tablet_graph_entity.png` | `png` | 189892 | Project documentation/evidence artifact in frontend-audit/screenshots/after; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/capture_log.json` | `json` | 15960 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/desktop_admin_audit.png` | `png` | 133748 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/desktop_admin_cases.png` | `png` | 108891 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/desktop_admin_settings.png` | `png` | 63923 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/desktop_auditor_audit.png` | `png` | 131386 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/desktop_auditor_cases_CASE-0001.png` | `png` | 160288 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/desktop_auditor_command-center.png` | `png` | 103298 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/desktop_investigator_audit.png` | `png` | 42038 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/desktop_investigator_cases.png` | `png` | 92573 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/desktop_investigator_cases_CASE-0001.png` | `png` | 161179 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/desktop_investigator_cases_CASE-0001_analysis.png` | `png` | 160354 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/desktop_investigator_cases_CASE-0001_audit.png` | `png` | 172934 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/desktop_investigator_cases_CASE-0001_evidence.png` | `png` | 151874 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/desktop_investigator_cases_CASE-0001_graph.png` | `png` | 297548 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/desktop_investigator_cases_CASE-0001_hitl.png` | `png` | 129423 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/desktop_investigator_cases_CASE-0001_map.png` | `png` | 135228 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/desktop_investigator_cases_CASE-0001_notes.png` | `png` | 161179 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/desktop_investigator_cases_CASE-0001_reports.png` | `png` | 65954 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/desktop_investigator_cases_CASE-0001_reviews.png` | `png` | 110337 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/desktop_investigator_cases_CASE-0001_timeline.png` | `png` | 184685 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/desktop_investigator_command-center.png` | `png` | 77863 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/desktop_investigator_evidence.png` | `png` | 77863 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/desktop_investigator_home.png` | `png` | 77863 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/desktop_investigator_profile.png` | `png` | 131299 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/desktop_investigator_reports.png` | `png` | 77863 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/desktop_investigator_review.png` | `png` | 77863 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/desktop_investigator_settings.png` | `png` | 67215 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/desktop_reviewer_cases_CASE-0001_hitl.png` | `png` | 127271 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/desktop_reviewer_command-center.png` | `png` | 74261 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/desktop_unassigned_cases.png` | `png` | 69162 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/desktop_unassigned_cases_CASE-0001.png` | `png` | 41647 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/phone_investigator_audit.png` | `png` | 27165 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/phone_investigator_cases.png` | `png` | 49252 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/phone_investigator_cases_CASE-0001.png` | `png` | 31217 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/phone_investigator_cases_CASE-0001_analysis.png` | `png` | 31217 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/phone_investigator_cases_CASE-0001_audit.png` | `png` | 31217 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/phone_investigator_cases_CASE-0001_evidence.png` | `png` | 31217 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/phone_investigator_cases_CASE-0001_graph.png` | `png` | 31217 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/phone_investigator_cases_CASE-0001_hitl.png` | `png` | 46414 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/phone_investigator_cases_CASE-0001_map.png` | `png` | 31217 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/phone_investigator_cases_CASE-0001_reports.png` | `png` | 37963 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/phone_investigator_cases_CASE-0001_reviews.png` | `png` | 31217 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/phone_investigator_cases_CASE-0001_timeline.png` | `png` | 31217 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/phone_investigator_command-center.png` | `png` | 47598 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/tablet_investigator_audit.png` | `png` | 38155 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/tablet_investigator_cases.png` | `png` | 88231 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/tablet_investigator_cases_CASE-0001.png` | `png` | 147587 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/tablet_investigator_cases_CASE-0001_analysis.png` | `png` | 139027 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/tablet_investigator_cases_CASE-0001_audit.png` | `png` | 142731 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/tablet_investigator_cases_CASE-0001_evidence.png` | `png` | 138931 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/tablet_investigator_cases_CASE-0001_graph.png` | `png` | 95569 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/tablet_investigator_cases_CASE-0001_hitl.png` | `png` | 118315 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/tablet_investigator_cases_CASE-0001_map.png` | `png` | 122989 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/tablet_investigator_cases_CASE-0001_reports.png` | `png` | 62403 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/tablet_investigator_cases_CASE-0001_reviews.png` | `png` | 103487 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/tablet_investigator_cases_CASE-0001_timeline.png` | `png` | 153235 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/before/tablet_investigator_command-center.png` | `png` | 74792 | Project documentation/evidence artifact in frontend-audit/screenshots/before; subject indicated by filename/title. |
| `frontend-audit/screenshots/obscura-live/cases.png` | `png` | 74780 | Project documentation/evidence artifact in frontend-audit/screenshots/obscura-live; subject indicated by filename/title. |
| `frontend-audit/screenshots/obscura-live/evidence.png` | `png` | 163486 | Project documentation/evidence artifact in frontend-audit/screenshots/obscura-live; subject indicated by filename/title. |
| `frontend-audit/screenshots/obscura-live/graph-list.png` | `png` | 178431 | Project documentation/evidence artifact in frontend-audit/screenshots/obscura-live; subject indicated by filename/title. |
| `frontend-audit/screenshots/obscura-live/home.png` | `png` | 95353 | Project documentation/evidence artifact in frontend-audit/screenshots/obscura-live; subject indicated by filename/title. |
| `frontend-audit/screenshots/obscura-live/login.png` | `png` | 86974 | Project documentation/evidence artifact in frontend-audit/screenshots/obscura-live; subject indicated by filename/title. |
| `frontend-audit/screenshots/obscura-live/overview.png` | `png` | 136637 | Project documentation/evidence artifact in frontend-audit/screenshots/obscura-live; subject indicated by filename/title. |
| `frontend-audit/screenshots/obscura-live/reports.png` | `png` | 105761 | Project documentation/evidence artifact in frontend-audit/screenshots/obscura-live; subject indicated by filename/title. |
| `frontend-audit/screenshots/obscura-live/review.png` | `png` | 126385 | Project documentation/evidence artifact in frontend-audit/screenshots/obscura-live; subject indicated by filename/title. |
| `frontend-audit/screenshots/obscura-live/timeline.png` | `png` | 123504 | Project documentation/evidence artifact in frontend-audit/screenshots/obscura-live; subject indicated by filename/title. |
| `frontend-audit/screenshots/obscura/cases.png` | `png` | 124360 | Project documentation/evidence artifact in frontend-audit/screenshots/obscura; subject indicated by filename/title. |
| `frontend-audit/screenshots/obscura/evidence.png` | `png` | 164692 | Project documentation/evidence artifact in frontend-audit/screenshots/obscura; subject indicated by filename/title. |
| `frontend-audit/screenshots/obscura/graph-list.png` | `png` | 178431 | Project documentation/evidence artifact in frontend-audit/screenshots/obscura; subject indicated by filename/title. |
| `frontend-audit/screenshots/obscura/home-FAILED.png` | `png` | 38329 | Project documentation/evidence artifact in frontend-audit/screenshots/obscura; subject indicated by filename/title. |
| `frontend-audit/screenshots/obscura/home.png` | `png` | 116125 | Project documentation/evidence artifact in frontend-audit/screenshots/obscura; subject indicated by filename/title. |
| `frontend-audit/screenshots/obscura/login.png` | `png` | 86974 | Project documentation/evidence artifact in frontend-audit/screenshots/obscura; subject indicated by filename/title. |
| `frontend-audit/screenshots/obscura/overview.png` | `png` | 136673 | Project documentation/evidence artifact in frontend-audit/screenshots/obscura; subject indicated by filename/title. |
| `frontend-audit/screenshots/obscura/reports.png` | `png` | 105761 | Project documentation/evidence artifact in frontend-audit/screenshots/obscura; subject indicated by filename/title. |
| `frontend-audit/screenshots/obscura/review.png` | `png` | 126393 | Project documentation/evidence artifact in frontend-audit/screenshots/obscura; subject indicated by filename/title. |
| `frontend-audit/screenshots/obscura/timeline.png` | `png` | 123653 | Project documentation/evidence artifact in frontend-audit/screenshots/obscura; subject indicated by filename/title. |
| `frontend-audit/usability-measurements.json` | `json` | 2341 | Project documentation/evidence artifact in frontend-audit; subject indicated by filename/title. |
| `frontend-design/DESIGN_SYSTEM.md` | `md` | 7149 | Project documentation/evidence artifact in frontend-design; subject indicated by filename/title. |
| `frontend-design/FRONTEND_COMPONENT_CATALOG.md` | `md` | 3980 | Project documentation/evidence artifact in frontend-design; subject indicated by filename/title. |
| `frontend-design/OFFICER_WORKFLOW_MAP.md` | `md` | 3187 | Project documentation/evidence artifact in frontend-design; subject indicated by filename/title. |
| `frontend-design/PAGE_BY_PAGE_REDESIGN_SPEC.md` | `md` | 5474 | Project documentation/evidence artifact in frontend-design; subject indicated by filename/title. |
| `frontend-design/PROPOSED_INFORMATION_ARCHITECTURE.md` | `md` | 7512 | Project documentation/evidence artifact in frontend-design; subject indicated by filename/title. |
| `government/GOVERNMENT_READINESS_MATRIX.md` | `md` | 6097 | Project documentation/evidence artifact in government; subject indicated by filename/title. |
| `graph/README.md` | `md` | 1048 | Project documentation/evidence artifact in graph; subject indicated by filename/title. |
| `graph/constraints.cypher` | `cypher` | 527 | Project documentation/evidence artifact in graph; subject indicated by filename/title. |
| `infrastructure/dristinet-api.service` | `service` | 1031 | Deployment/service infrastructure configuration in infrastructure. |
| `infrastructure/dristinet.service` | `service` | 917 | Deployment/service infrastructure configuration in infrastructure. |
| `infrastructure/nginx/nginx.conf` | `conf` | 7955 | Deployment/service infrastructure configuration in infrastructure/nginx. |
| `operations/BACKUP_POLICY.md` | `md` | 2575 | Project documentation/evidence artifact in operations; subject indicated by filename/title. |
| `operations/DISASTER_RECOVERY_PLAN.md` | `md` | 2753 | Project documentation/evidence artifact in operations; subject indicated by filename/title. |
| `operations/RESTORE_TEST_REPORT.md` | `md` | 3925 | Project documentation/evidence artifact in operations; subject indicated by filename/title. |
| `packages/schemas/openapi.json` | `json` | 64998 | Structured configuration/data file in packages/schemas; consumer and schema indicated by filename. |
| `policy/authorization/README.md` | `md` | 766 | Project documentation/evidence artifact in policy/authorization; subject indicated by filename/title. |
| `pyproject.toml` | `toml` | 1210 | Structured configuration/data file in repository root; consumer and schema indicated by filename. |
| `reports/ai-evaluation.md` | `md` | 1637 | Project documentation/evidence artifact in reports; subject indicated by filename/title. |
| `reports/dry-runs.md` | `md` | 2677 | Project documentation/evidence artifact in reports; subject indicated by filename/title. |
| `reports/entity-resolution-evaluation.md` | `md` | 1554 | Project documentation/evidence artifact in reports; subject indicated by filename/title. |
| `reports/extraction-evaluation.md` | `md` | 1225 | Project documentation/evidence artifact in reports; subject indicated by filename/title. |
| `reports/graph-evaluation.md` | `md` | 1819 | Project documentation/evidence artifact in reports; subject indicated by filename/title. |
| `reports/ner-evaluation.md` | `md` | 4020 | Project documentation/evidence artifact in reports; subject indicated by filename/title. |
| `reports/performance.md` | `md` | 3331 | Project documentation/evidence artifact in reports; subject indicated by filename/title. |
| `reports/release-checklist.md` | `md` | 4112 | Project documentation/evidence artifact in reports; subject indicated by filename/title. |
| `reports/screenshots/01-denied.png` | `png` | 61156 | Project documentation/evidence artifact in reports/screenshots; subject indicated by filename/title. |
| `reports/screenshots/02-evidence-quarantine.png` | `png` | 199904 | Project documentation/evidence artifact in reports/screenshots; subject indicated by filename/title. |
| `reports/screenshots/02b-evidence-drawer-source.png` | `png` | 216925 | Project documentation/evidence artifact in reports/screenshots; subject indicated by filename/title. |
| `reports/screenshots/03-review-candidate.png` | `png` | 208656 | Project documentation/evidence artifact in reports/screenshots; subject indicated by filename/title. |
| `reports/screenshots/04-graph.png` | `png` | 239679 | Project documentation/evidence artifact in reports/screenshots; subject indicated by filename/title. |
| `reports/screenshots/05-edge-source-context.png` | `png` | 201034 | Project documentation/evidence artifact in reports/screenshots; subject indicated by filename/title. |
| `reports/screenshots/05-evidence-drawer.png` | `png` | 327581 | Project documentation/evidence artifact in reports/screenshots; subject indicated by filename/title. |
| `reports/screenshots/06-timeline-historical.png` | `png` | 162050 | Project documentation/evidence artifact in reports/screenshots; subject indicated by filename/title. |
| `reports/screenshots/07-analysis.png` | `png` | 159839 | Project documentation/evidence artifact in reports/screenshots; subject indicated by filename/title. |
| `reports/screenshots/08-report.png` | `png` | 68722 | Project documentation/evidence artifact in reports/screenshots; subject indicated by filename/title. |
| `reports/screenshots/09-audit.png` | `png` | 159706 | Project documentation/evidence artifact in reports/screenshots; subject indicated by filename/title. |
| `reports/screenshots/error.png` | `png` | 192199 | Project documentation/evidence artifact in reports/screenshots; subject indicated by filename/title. |
| `reports/security-gate.md` | `md` | 871 | Project documentation/evidence artifact in reports; subject indicated by filename/title. |
| `scripts/backup_restore_drill.py` | `py` | 8895 | Operational, evaluation, packaging, or migration utility in scripts; exact action indicated by filename. |
| `scripts/dry_run.py` | `py` | 12281 | Operational, evaluation, packaging, or migration utility in scripts; exact action indicated by filename. |
| `scripts/env.sh` | `sh` | 779 | Operational, evaluation, packaging, or migration utility in scripts; exact action indicated by filename. |
| `scripts/evaluate.py` | `py` | 15078 | Operational, evaluation, packaging, or migration utility in scripts; exact action indicated by filename. |
| `scripts/evaluate_ai.py` | `py` | 5635 | Operational, evaluation, packaging, or migration utility in scripts; exact action indicated by filename. |
| `scripts/evaluate_ner.py` | `py` | 6607 | Operational, evaluation, packaging, or migration utility in scripts; exact action indicated by filename. |
| `scripts/export_openapi.py` | `py` | 1021 | Operational, evaluation, packaging, or migration utility in scripts; exact action indicated by filename. |
| `scripts/make_ner_eval_set.py` | `py` | 3699 | Operational, evaluation, packaging, or migration utility in scripts; exact action indicated by filename. |
| `scripts/make_packages.py` | `py` | 1445 | Operational, evaluation, packaging, or migration utility in scripts; exact action indicated by filename. |
| `scripts/make_release_archive.py` | `py` | 4148 | Operational, evaluation, packaging, or migration utility in scripts; exact action indicated by filename. |
| `scripts/migrate_evidence_to_minio.py` | `py` | 2878 | Operational, evaluation, packaging, or migration utility in scripts; exact action indicated by filename. |
| `scripts/migrate_sqlite_to_postgres.py` | `py` | 3363 | Operational, evaluation, packaging, or migration utility in scripts; exact action indicated by filename. |
| `scripts/perf_test.py` | `py` | 10282 | Operational, evaluation, packaging, or migration utility in scripts; exact action indicated by filename. |
| `scripts/validate_besu.py` | `py` | 2210 | Operational, evaluation, packaging, or migration utility in scripts; exact action indicated by filename. |
| `scripts/verify_pg_minio_migration.py` | `py` | 4304 | Operational, evaluation, packaging, or migration utility in scripts; exact action indicated by filename. |
| `security/SECURITY_ASSESSMENT.md` | `md` | 3862 | Project documentation/evidence artifact in security; subject indicated by filename/title. |
| `security/THREAT_MODEL.md` | `md` | 3558 | Project documentation/evidence artifact in security; subject indicated by filename/title. |
| `tests/e2e/test_ui_demo.py` | `py` | 24550 | Automated test module (test_ui_demo); assertions and fixtures define its exact coverage. |
| `tests/infrastructure/test_infrastructure.py` | `py` | 6818 | Automated test module (test_infrastructure); assertions and fixtures define its exact coverage. |
| `tests/ui-evaluation/README.md` | `md` | 1286 | Documentation for frontend UI evaluation utilities and their use. |
| `tests/ui-evaluation/axe_scan.py` | `py` | 2365 | Automated test module (axe_scan); assertions and fixtures define its exact coverage. |
| `tests/ui-evaluation/capture_routes.py` | `py` | 3592 | Automated test module (capture_routes); assertions and fixtures define its exact coverage. |
| `tests/ui-evaluation/keyboard_audit.py` | `py` | 7717 | Automated test module (keyboard_audit); assertions and fixtures define its exact coverage. |
| `tests/ui-evaluation/obscura_pages.py` | `py` | 2395 | Automated test module (obscura_pages); assertions and fixtures define its exact coverage. |
| `tests/ui-evaluation/task_comparison.py` | `py` | 6401 | Automated test module (task_comparison); assertions and fixtures define its exact coverage. |
| `workers/README.md` | `md` | 367 | Background worker documentation or implementation in workers. |
| `workers/worker.py` | `py` | 5808 | Background worker documentation or implementation in workers. |
