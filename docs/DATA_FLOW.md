# DRISTI-NET — Data Flow & Lifecycle Architecture

## 1. End-to-End Evidence Ingestion Flow

```mermaid
sequenceDiagram
    autonumber
    actor Officer as Evidence Officer
    participant API as FastAPI Gateway
    participant Storage as MinIO / Storage
    participant Scanner as ClamAV Gate
    participant Pipeline as Extraction Pipeline
    participant DB as PostgreSQL / SQLite
    participant HITL as Reviewer Workbench
    participant Graph as Neo4j Projection

    Officer->>API: POST /cases/{id}/evidence (File upload)
    API->>Storage: Store in quarantine/
    API->>Scanner: Scan stream (INSTREAM / testgate)
    alt Malware Detected / Scanner Failed
        Scanner-->>API: INFECTED / SCANNER_UNAVAILABLE
        API->>DB: Record status=INFECTED / QUARANTINED, Audit failure
        API-->>Officer: 422 File Quarantined
    else Clean Scan
        Scanner-->>API: CLEAN
        API->>Storage: Promote to accepted/
        API->>Pipeline: Trigger run_extract()
        Pipeline->>Pipeline: Calculate & verify SHA-256
        Pipeline->>Pipeline: Execute OCR / IndicBERT NER / Structured Parsers
        Pipeline->>DB: Insert Entity & Claim records with Provenance
        Pipeline->>DB: Run flag_contradictions()
        Pipeline->>API: Candidate Generation
        API->>DB: Insert MatchCandidate rows (REVIEW_REQUIRED)
        API->>DB: Audit record CANDIDATES_GENERATED
        API-->>Officer: 201 Created (Status: HITL)
    end

    Note over HITL,DB: Supervisory Arbitration
    actor Reviewer as Supervisory Reviewer
    Reviewer->>API: POST /candidates/{id}/decision (APPROVE/REJECT + Reason)
    API->>DB: Update candidate state & Audit HMAC sign-off
    opt On Approval
        API->>DB: Merge entity profiles
        API->>Graph: Project merged nodes & edges
    end
```

---

## 2. Claim Provenance & Traceability Flow

Every analytical relationship and entity attribute in DRISTI-NET maintains strict forward and backward traceability:

1. **Source Evidence Object**: Retains raw byte manifest (`sha256`), upload metadata, officer identity, and chain of custody.
2. **Provenance Record**: Contains `locator` payload:
   - Structured tabular (CSV): `{"row": 42, "columns": ["caller", "callee"]}`.
   - Semi-structured (JSON): `{"json_path": "$[12].phone"}`.
   - Unstructured Document (PDF/TXT): `{"page": 2, "line": 14, "char_offset": 850, "engine": "paddleocr"}`.
3. **Claim Record**: Connects source entity, target entity, relationship type (`CALLED`, `OWNS_VEHICLE`, `TRANSFERRED_TO`), weight, temporal timestamp, and missingness metrics.
4. **Graph Node/Edge Inspection**: When an analyst clicks an edge in the Sigma.js canvas:
   - Client calls `GET /api/v1/cases/{id}/edge?source={s}&target={t}&rel_type={r}`.
   - API verifies evidence integrity and retrieves exact source context line.
   - Analyst views byte-for-byte highlighted source text in the Evidence Drawer with verified hash match proof.
