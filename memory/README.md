# DRISTI-NET — Master Memory Repository

Welcome to the central, authoritative knowledge repository for the **DRISTI-NET** project.

This directory serves as the durable single source of truth for all project architecture, technical specifications, governance policies, deployment procedures, testing catalogs, and historical audit findings.

---

## Directory Navigation

- **[`01_project_overview/`](01_project_overview/):** High-level mission, constitutional boundaries, requirements traceability matrix, and feature catalog.
  - [`PROJECT_OVERVIEW.md`](01_project_overview/PROJECT_OVERVIEW.md)
  - [`PROJECT_OBJECTIVES.md`](01_project_overview/PROJECT_OBJECTIVES.md)
  - [`REQUIREMENTS.md`](01_project_overview/REQUIREMENTS.md)
  - [`FEATURE_CATALOG.md`](01_project_overview/FEATURE_CATALOG.md)
- **[`02_architecture/`](02_architecture/):** System design diagrams, 21 ADR records, component topology, and data flows.
  - [`SYSTEM_DESIGN.md`](02_architecture/SYSTEM_DESIGN.md)
  - [`ARCHITECTURE_DECISIONS.md`](02_architecture/ARCHITECTURE_DECISIONS.md)
  - [`COMPONENT_ARCHITECTURE.md`](02_architecture/COMPONENT_ARCHITECTURE.md)
  - [`DATA_FLOW.md`](02_architecture/DATA_FLOW.md)
  - [`INTEGRATION_ARCHITECTURE.md`](02_architecture/INTEGRATION_ARCHITECTURE.md)
- **[`03_technical_documentation/`](03_technical_documentation/):** Detailed subsystem specifications (FastAPI backend, React frontend, REST APIs, database models, S3 storage, Neo4j graph engine, IndicBERT/PaddleOCR ML adapters, evidence processing, and Besu blockchain integration).
  - [`BACKEND.md`](03_technical_documentation/BACKEND.md)
  - [`FRONTEND.md`](03_technical_documentation/FRONTEND.md)
  - [`API_REFERENCE.md`](03_technical_documentation/API_REFERENCE.md)
  - [`DATABASE.md`](03_technical_documentation/DATABASE.md)
  - [`STORAGE.md`](03_technical_documentation/STORAGE.md)
  - [`GRAPH_ENGINE.md`](03_technical_documentation/GRAPH_ENGINE.md)
  - [`AI_ML_NLP.md`](03_technical_documentation/AI_ML_NLP.md)
  - [`EVIDENCE_PROCESSING.md`](03_technical_documentation/EVIDENCE_PROCESSING.md)
  - [`BLOCKCHAIN_INTEGRATION.md`](03_technical_documentation/BLOCKCHAIN_INTEGRATION.md)
- **[`04_security_and_governance/`](04_security_and_governance/):** STRIDE threat modeling, RBAC access control, evidence integrity verification, HMAC audit logs, and Indian BSA 2023 Section 63 regulatory compliance.
  - [`SECURITY_ARCHITECTURE.md`](04_security_and_governance/SECURITY_ARCHITECTURE.md)
  - [`ACCESS_CONTROL.md`](04_security_and_governance/ACCESS_CONTROL.md)
  - [`EVIDENCE_INTEGRITY.md`](04_security_and_governance/EVIDENCE_INTEGRITY.md)
  - [`AUDIT_AND_PROVENANCE.md`](04_security_and_governance/AUDIT_AND_PROVENANCE.md)
  - [`GOVERNANCE_REQUIREMENTS.md`](04_security_and_governance/GOVERNANCE_REQUIREMENTS.md)
- **[`05_deployment_and_operations/`](05_deployment_and_operations/):** Single-host Docker Compose deployment, environment configuration guide, Nginx reverse proxy, disaster recovery drill procedures, and troubleshooting.
  - [`DEPLOYMENT_GUIDE.md`](05_deployment_and_operations/DEPLOYMENT_GUIDE.md)
  - [`ENVIRONMENT_CONFIGURATION.md`](05_deployment_and_operations/ENVIRONMENT_CONFIGURATION.md)
  - [`DOCKER_INFRASTRUCTURE.md`](05_deployment_and_operations/DOCKER_INFRASTRUCTURE.md)
  - [`BACKUP_AND_RECOVERY.md`](05_deployment_and_operations/BACKUP_AND_RECOVERY.md)
  - [`TROUBLESHOOTING.md`](05_deployment_and_operations/TROUBLESHOOTING.md)
- **[`06_testing_and_quality/`](06_testing_and_quality/):** Testing strategy, automated test catalog (540+ passing tests), security gates, and release quality gates.
  - [`TESTING_STRATEGY.md`](06_testing_and_quality/TESTING_STRATEGY.md)
  - [`TEST_CATALOG.md`](06_testing_and_quality/TEST_CATALOG.md)
  - [`SECURITY_TESTING.md`](06_testing_and_quality/SECURITY_TESTING.md)
  - [`QUALITY_GATES.md`](06_testing_and_quality/QUALITY_GATES.md)
- **[`07_audits_and_reports/`](07_audits_and_reports/):** Consolidated defect register (DEF-001 through DEF-091, BUG-NEW-01 through BUG-NEW-18), UI/UX accessibility audits, and benchmark reports.
  - [`AUDIT_INDEX.md`](07_audits_and_reports/AUDIT_INDEX.md)
  - [`CONSOLIDATED_AUDIT_FINDINGS.md`](07_audits_and_reports/CONSOLIDATED_AUDIT_FINDINGS.md)
- **[`08_project_history/`](08_project_history/):** Development milestones, completed work summaries, historical decision logs, and assistant handoffs.
  - [`DEVELOPMENT_HISTORY.md`](08_project_history/DEVELOPMENT_HISTORY.md)
  - [`COMPLETED_WORK.md`](08_project_history/COMPLETED_WORK.md)
  - [`HISTORICAL_DECISIONS.md`](08_project_history/HISTORICAL_DECISIONS.md)
- **[`10_source_code_reference/`](10_source_code_reference/):** Frozen historical source code snapshots.
  - [`SOURCE_SNAPSHOTS/`](10_source_code_reference/SOURCE_SNAPSHOTS/)
- **[`11_project_tracking/`](11_project_tracking/):** Active implementation roadmap, decision log, risk register, and live continuation state.
  - [`ROADMAP.md`](11_project_tracking/ROADMAP.md)
  - [`DECISION_LOG.md`](11_project_tracking/DECISION_LOG.md)
  - [`RISK_REGISTER.md`](11_project_tracking/RISK_REGISTER.md)
  - [`CONTINUATION_STATE.md`](11_project_tracking/CONTINUATION_STATE.md)
- **[`12_original_references/`](12_original_references/):** Preserved historical reference docs and export manifests.
  - [`ORIGINAL_DOCUMENT_INDEX.md`](12_original_references/ORIGINAL_DOCUMENT_INDEX.md)
