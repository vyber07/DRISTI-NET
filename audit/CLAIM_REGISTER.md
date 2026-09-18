# Claim Register

Document ID: DRISTI-AUDIT-002
Version: 1.0
Status: VERIFIED
Date: 2026-09-14
Owner: DRISTI-NET Architecture Team
Source of Truth: System Repository & Active Configuration
Scope: Project-wide Architectural Claims

## Purpose
Every important architectural or business claim made in DRISTI-NET documentation or planning must be recorded and forensically validated against the actual codebase.

## Current Status
**VERIFIED**. Initial population completed during Phase 0 Forensics.

## Target State
Must be updated whenever a new feature is merged or a new capability is claimed in presentation materials (e.g., SIH presentations).

## Register

| Claim ID | Claim | Category | Source | Evidence | Confidence | Status | Reviewer Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| CLM-001 | System uses AI/NLP for entity extraction. | AI / NLP | `README.md`, Target Architecture | `apps/api/app/services/extract.py` | HIGH | **TARGET** (Not Implemented) | The codebase currently uses deterministic rules/regex, not AI/NLP models. |
| CLM-002 | Evidence is safely quarantined and scanned for malware. | SECURITY | Architecture Specs | `apps/api/app/services/scanner.py`, `tests/test_archive_uploads.py` | HIGH | **VERIFIED FACT** | ClamAV fail-closed scanning is implemented and tested. |
| CLM-003 | Relationships are projected into a Neo4j Graph. | GRAPH | Target Architecture | `apps/api/app/services/neo4j_store.py` | HIGH | **VERIFIED FACT** | The codebase contains valid parameterized Cypher queries to push data to Neo4j. |
| CLM-004 | System uses Kafka for event-driven asynchronous processing. | ARCHITECTURE | Target Architecture | Repository | HIGH | **MISSING** | No Kafka producers, consumers, or infrastructure files exist in the repository. Processing is synchronous. |
| CLM-005 | PII is dynamically masked and reveals are audited. | PRIVACY | Architecture Specs | `apps/api/app/services/masking.py`, `apps/api/app/services/audit.py` | HIGH | **VERIFIED FACT** | Implementation explicitly scrubs sensitive identifiers and logs reveal requests to the audit table. |
| CLM-006 | System is legally certified and guarantees court admissibility. | LEGAL | Historical Docs / Specs | N/A | HIGH | **FALSE / UNSUPPORTED** | Technical controls (hashing/provenance) exist, but the system itself cannot automate statutory compliance or legal admissibility. This claim MUST be removed from external materials. |

## Dependencies
* Connects to `IMPLEMENTATION_EVIDENCE.md`.

## Related Documents
* `SOURCE_OF_TRUTH.md`
