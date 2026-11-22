# DRISTI-NET — Architecture Decision Records (ADR Summary)

This document provides a consolidated register of all critical architectural decisions made across the DRISTI-NET project lifecycle.

| ADR ID | Title | Status | Date | Core Decision Summary |
|---|---|---|---|---|
| **ADR-001** | Relational Database Single Source of Truth | Approved | 2026-08-10 | PostgreSQL (production) and SQLite (testing) are the sole authoritative stores for all cases, claims, evidence metadata, and audit records. Neo4j is strictly an analytical projection. |
| **ADR-002** | Reconstructible Graph Projection | Approved | 2026-08-12 | Neo4j graph state must be 100% reconstructible from PostgreSQL claims. Any graph corruption or data loss can be recovered via deterministic projection replay. |
| **ADR-003** | Dual-Tier Object Storage (MinIO / S3) | Approved | 2026-08-15 | Ingested evidence bytes are stored in S3/MinIO with a local filesystem fallback for development. Storage paths transition strictly from `quarantine/` to `accepted/` only after verified clean malware scan. |
| **ADR-004** | Asynchronous Job Queue | Approved | 2026-08-18 | Heavy multimodal operations (OCR, IndicBERT NER, resolution) execute via Celery/Kafka workers with idempotency keys and state tracking in the `jobs` table. |
| **ADR-005** | Redis Rate-Limiting & Login Throttling | Approved | 2026-08-20 | Redis 7 is designated exclusively for ephemeral state (login attempt counters, sliding window rate-limiting) to maintain stateless API horizontally scalable nodes. |
| **ADR-006** | Sigma.js WebGL Graph Visualization | Approved | 2026-08-22 | Client renders interactive graphs via Sigma.js and Graphology on HTML5 WebGL canvas with ForceAtlas2 layout, bounding node views to maximum 150 nodes / 2 hops to prevent DOM exhaustion. |
| **ADR-007** | Stateless JWT Authentication with Jurisdiction Scoping | Approved | 2026-08-25 | Authentication uses HMAC/RSA signed JWTs carrying user ID, role, and jurisdiction. Case access is enforced via strict database-level checks on every transaction. |
| **ADR-008** | PII Masking by Default and Audited Reveal | Approved | 2026-08-28 | Phone numbers, account numbers, and personal identifiers are masked in all standard views. Unmasking requires a distinct statutory justification logged in the immutable audit chain. |
| **ADR-009** | Temporal Graph Decay & Historical Retention | Approved | 2026-09-02 | Historical relationship claims are never deleted; instead, they are flagged with `relevance: HISTORICAL` and decay curves to preserve chronological evidentiary truth. |
| **ADR-010** | Chained HMAC-SHA256 Audit Trail | Approved | 2026-09-05 | Every administrative, investigative, and arbitration event is cryptographically linked to the previous event hash and signed with HMAC-SHA256, enabling verification of log integrity. |
| **ADR-011** | Zero-Port-Suffix Single-Host Deployment | Approved | 2026-09-10 | Production deployment serves static web client and proxies `/api` requests through Nginx on standard port 80/443 without exposing internal container ports to public interfaces. |
| **ADR-012** | Model-Backed AI4Bharat IndicBERT NER Adapter | Approved | 2026-09-15 | Document extraction leverages AI4Bharat IndicBERT token classification for Indian named entities with lazy-loading and graceful fallback to rule-based locators when model weights are offline. |
| **ADR-013** | Kafka Event Bus for Distributed Decoupling | Approved | 2026-09-18 | Scaled enterprise deployments distribute evidence events across Kafka topics (`evidence-uploaded`, `scan-completed`, `extraction-completed`) while preserving synchronous local execution for unit test loops. |
| **ADR-014** | Merkle Tree Root Ledger Anchoring | Approved | 2026-09-22 | Audit log batches can optionally be aggregated into Merkle trees and anchored to Hyperledger Besu Ethereum networks for third-party judicial provenance verification. |
