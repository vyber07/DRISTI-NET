# DRISTI-NET — Master Project Overview

**Authority:** `docs/context.md`, `docs/project-overview.md`, `README.md`  
**Consolidation Date:** 2026-11-19  
**System Classification:** Evidence-First Multimodal Relationship Intelligence Platform  

---

## 1. Executive Summary

**DRISTI-NET** (Digital Record & Intelligence Synthesizer for Transparent Investigations — Network Evidence Tracker) is an evidence-first, multimodal relationship-discovery platform designed for **authorized retrospective criminal investigations and analytical inquiry**.

The platform ingests multi-format synthetic or authorized de-identified investigation records (PDF FIRs, CDR/IPDR call logs, banking transaction CSVs, seizure memos, witness statements, and images). It verifies upload integrity, enforces strict fail-closed quarantine and malware scanning, extracts candidate entities and relationships, calculates deterministic identity resolution signals, subjects all candidate matches to mandatory Human-in-the-Loop (HITL) review, projects analytical networks into a bounded temporal POLE+ (Person, Object, Location, Event + Organization, Vehicle, Document, Account, Communication) knowledge graph, maintains tamper-evident audit trails with cryptographic hash chaining, and exports analyst-reviewed evidence dossiers.

> **The Core Product Promise (`docs/context.md` §1):**  
> *"DRISTI-NET does not decide who is a criminal. It helps an authorized investigator discover and review evidence-backed relationships across approved cases while showing source provenance, time, uncertainty, missing data, access history, and human decisions."*

---

## 2. Constitutional Guardrails and Product Boundaries

In strict compliance with the project constitution (`docs/context.md` §2):

### 2.1 Allowed Capabilities
- Organize authorized investigation cases and evidence files.
- Preserve original records and versions in immutable object storage.
- Extract candidate entities and relationships with explicit source bounding boxes, lines, or cell coordinates.
- Propose conservative entity match candidates with explainable positive and counter-evidence.
- Project authorized relationships into an analytical POLE+ graph with temporal decay filters.
- Highlight possible bridges, intermediaries, communities, and review priorities.
- Maintain immutable, tamper-evident audit logs with HMAC-SHA256 signatures.
- Export neutral, court-referenceable evidence dossiers citing Indian Bharatiya Sakshya Adhiniyam (BSA) s.63(4)(c) / Indian Evidence Act s.65B technical metadata.

### 2.2 Prohibited Behaviors
- **No autonomous guilt or innocence determinations.**
- **No criminal, terrorist, threat, or risk scoring** assigned to persons or communities.
- **No recommendation of arrest, surveillance, account freezing, or prosecution.**
- **No automatic merging of identities** across shared phones, vehicles, addresses, or IP addresses.
- **No "kingpin", "mastermind", or guilt labels.** Centrality is an analytical measure, never legal proof.
- **No live connections** to live police databases (CCTNS/ICJS), banking networks, telecom switches, or biometric scanners without written legal authorization and isolated gateways.
- **No claims of court certification or 100% accuracy.**

---

## 3. Evidence Status and Taxonomy Vocabulary

Every statement and artifact in DRISTI-NET adheres to the 5-tier classification standard (`docs/context.md` §3):

| Status | Definition | Prescribed Language |
|---|---|---|
| **Demonstrated** | Exists in source code and proven by passing unit/integration/E2E tests | *"The prototype implements..."* |
| **MVP Target** | Required for the bounded build baseline; actively targeted | *"The MVP will implement..."* |
| **Architecture Target**| Defined in the long-term target design; scheduled for later builds | *"The target architecture includes..."* |
| **Roadmap** | Intentionally postponed or deferred | *"A later phase may evaluate..."* |
| **Unsupported** | Stated without adequate artifact, verification, or legal basis | *Flagged, removed, or qualified* |

---

## 4. Primary Stakeholder Personas & Capabilities

| Role | Operational Goal | Core Capabilities in DRISTI-NET |
|---|---|---|
| **Investigator** | Case exploration & cross-case relationship discovery | Search authorized entities, inspect candidate relationships, explore POLE+ graph, view timelines and geographical coordinates, open exact source evidence spans. |
| **Evidence Officer** | Ingestion & chain-of-custody preservation | Upload records, inspect file metadata, verify quarantine & ClamAV status, view SHA-256 manifests, verify tamper status. |
| **Reviewer / Supervisor**| Human-in-the-Loop (HITL) resolution governance | Review conservative match proposals, accept/reject/defer identity merges, record rationale, revoke or reverse past decisions. |
| **Analyst** | Pattern detection & network intelligence | Filter temporal networks, inspect bridge candidates and betweenness centrality, evaluate community stability, detect cross-case patterns. |
| **Auditor** | Accountability & compliance oversight | Inspect immutable HMAC audit logs, verify hash chain integrity, track unmasking events, audit data exports and access denials. |
| **Administrator** | Tenant & system management | Manage users, RBAC roles, case assignments, jurisdiction scopes, policy overrides, and system health. |

---

## 5. Technology Stack Summary

- **Backend:** Python 3.11, FastAPI, SQLAlchemy 2.0 (async/sync), Pydantic v2, Uvicorn.
- **Database (Relational System of Record):** PostgreSQL 16 (or local SQLite for dev/test) with UTC session enforcement.
- **Object Storage:** MinIO / AWS S3 for quarantined and accepted evidence files.
- **Graph Database (Analytical Projection):** Neo4j 5 Community Edition (Cypher 5) with in-process NetworkX fallback.
- **Cache & Rate Limiting:** Redis 7 (sliding window rate-limiting and token blocklisting).
- **Security & Antivirus:** ClamAV daemon (`clamd` fail-closed scanner) + EICAR test harness.
- **Event Bus:** Apache Kafka 3.5 (asynchronous job queue for background ingestion).
- **Blockchain Anchoring (Integrity Proof):** Hyperledger Besu 24.1 (EVM private testnet) with RFC 6962 Merkle tree proofs.
- **Frontend:** React 18, TypeScript 5, Vite 5, Tailwind CSS, Radix UI, Lucide icons, Sigma.js (WebGL graph rendering), Graphology.
- **Deployment:** Docker, Docker Compose, Nginx reverse proxy, Systemd units.
