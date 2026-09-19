# SIH Presentation Content Map

This document aligns the DRISTI-NET implementation with the required six-slide SIH (Smart India Hackathon) template structure, incorporating recent architecture updates (Kafka, PaddleOCR, IndicBERT, Merkle tree). The presentation's visual format remains unchanged; only the text labels and technical claims are updated here.

## Slide 1: Title & Problem Statement
*   **Title:** DRISTI-NET - Decentralized Resolution and Intelligence System for Threat Identification
*   **Problem Statement:** Ingesting unstructured, multilingual evidentiary documents into a unified, privacy-preserving knowledge graph for investigative analysis.
*   **Key Focus:** Automated extraction, resolution of conflicting identities, and tamper-evident auditing.

## Slide 2: Proposed Solution & Architecture
*   **System Flow:**
    1.  **Ingestion & Queueing:** Secure API → ClamAV Scan → **Kafka Event Bus (`drishti.evidence.jobs`)**.
    2.  **Extraction Pipeline:** 
        *   **PaddleOCR:** Specialized handling for scanned / low-text PDFs with bounding box provenance.
        *   **IndicBERT NER:** AI4Bharat `IndicBERTv2-MLM-only-NER` for multilingual entity recognition (PERSON, ORGANIZATION, LOCATION).
        *   **Regex / Structured:** Fallbacks and structured data parsing.
    3.  **Resolution & Graph:** Match Candidates → Human-in-the-loop review → Neo4j projection.
*   **Integrity Anchor:** Batch-level Merkle root calculation anchored to a Hyperledger Besu EVM ledger.

## Slide 3: Technology Stack
*   **Backend:** FastAPI (Python 3.11), SQLAlchemy, Pydantic, Alembic.
*   **Event Bus:** Apache Kafka (KRaft mode).
*   **AI/ML:** PaddleOCR (Document understanding), Transformers (IndicBERT NER).
*   **Data Stores:** PostgreSQL (Relational state & idempotency), Neo4j (Knowledge graph), Redis (Cache), MinIO (S3-compatible object storage).
*   **Blockchain / Integrity:** Hyperledger Besu (EVM ledger), SHA-256 Merkle Trees.
*   **Frontend:** React, TypeScript, Vite.

## Slide 4: Use Cases & Application
*   **Use Case 1: Automated Evidence Triangulation:** Linking fragmented mentions of a single individual across multiple FIRs and transaction logs without automatic merging.
*   **Use Case 2: Tamper-Evident Dossiers:** Generating court-ready PDF dossiers (BSA 2023 Section 63(4)(c) aligned) featuring embedded cryptographic proofs and blockchain transaction references.
*   **Implementation-Aligned Claim:** "Provides candidate relationships for review, not certified guilt or automatic conclusions."

## Slide 5: Dependencies & Showstoppers
*   **Data Dependencies:** Requires high-quality, legally-acquired evidence.
*   **Infrastructure:** Depends on HSM-backed key management in production for Besu signing (currently simulated via dev key in the evaluation stack).
*   **Model Limitations:** NLP extraction accuracy on dense Devanagari text is subject to ongoing domain-specific fine-tuning.

## Slide 6: Future Roadmap
*   **Advanced Analytics:** Coarse spatial overlap (H3 bucketing) and device communication patterns.
*   **Scaling:** Migrating from single-node Besu to a fully permissioned distributed network.
*   **Model Upgrades:** Integrating larger domain-adapted Indic language models while maintaining strict off-chain, local-only inference policies.
