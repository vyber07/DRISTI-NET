# DRISTI-NET — Master Project Objectives and Scope

**Authority:** `docs/sih_presentation_map.md`, `docs/context.md` §1-§5, SIH Problem Statement  
**Consolidation Date:** 2026-11-19  

---

## 1. Context and Problem Statement

Modern criminal and financial investigations confront overwhelming volumes of unstructured and semi-structured digital records spanning multiple disparate cases:
1. **Siloed Evidence:** Documents, call records, financial ledgers, and FIRs reside in isolated case folders, preventing cross-case pattern discovery.
2. **Entity Disambiguation Bottlenecks:** Suspects, phone numbers, and bank accounts appear across cases under phonetic variations, aliases, or partial identifiers without automated resolution assistance.
3. **Black-Box AI Risks:** Automated tools that assert suspect guilt or merge records without explanation violate constitutional due process and evidence admissibility standards.
4. **Fragile Chain of Custody:** Digital records lack verifiable, tamper-evident cryptographic provenance from upload through analytical extraction.

---

## 2. Core Project Objectives

### Objective 1: Strict Ingestion Security & Chain of Custody
- Provide a multi-tenant, fail-closed upload pipeline.
- Enforce cryptographic SHA-256 fingerprinting upon receipt.
- Isolate all files in a secure quarantine zone until verified clean by ClamAV malware scanning.
- Prevent decompression bombs, path traversal, and malicious file types before parser execution.

### Objective 2: Multimodal Extraction with Fine-Grained Provenance
- Extract structured POLE+ entities and relationships from PDFs, CSVs, JSONs, and text files.
- Anchor every extracted claim to its exact source coordinates:
  - Document page number, line number, character offset, and PaddleOCR bounding box.
  - CSV row index and column header.
  - JSON object path.
- Retain contradictory statements from opposing sources without silent suppression.

### Objective 3: Conservative, Explainable Human-in-the-Loop Entity Resolution
- Calculate deterministic matching signals based on exact identifiers (phone, PAN, Aadhaar hash, account number) and conservative phonetic similarity (Jaro-Winkler, Soundex).
- **Mandate human review:** Never merge entities automatically. Require an authorized investigator or reviewer to accept, reject, or defer match candidates with an audited written justification.

### Objective 4: Bounded, Temporal POLE+ Knowledge Graph
- Model analytical networks using the POLE+ ontology (Person, Object, Location, Event, Organization, Vehicle, Document, Account, Communication).
- Project PostgreSQL relational truth into an analytical Neo4j graph store, while preserving instant fallback to an in-process graph projection if Neo4j is offline.
- Apply temporal decay and observation intervals to model relationship evolution over time.
- Enforce strict server-side hop limits and query timeouts to prevent supernode explosions.

### Objective 5: Immutable Accountability and Tamper-Evident Auditing
- Capture every user action, search query, graph expansion, entity reveal, and export in an append-only audit log.
- Chain audit entries cryptographically using HMAC-SHA256 signatures with secret key rotation support.
- Anchor case integrity states to an RFC 6962 Merkle tree and Hyperledger Besu smart contract.

### Objective 6: Neutral Legal Dossier Export
- Export comprehensive evidence dossiers adhering to Indian Bharatiya Sakshya Adhiniyam (BSA) 2023 Section 63(4)(c) / Indian Evidence Act Section 65B metadata requirements.
- Strictly maintain neutral, factual language: present candidate relationships, evidence spans, and hash integrity references without conclusory labels.
