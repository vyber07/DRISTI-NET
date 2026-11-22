# DRISTI-NET — Master Quality Gates Specification

**Authority:** `reports/release-checklist.md`, `audit/RELEASE_READINESS_REPORT.md`  
**Consolidation Date:** 2026-11-19  

---

## 1. Five Mandatory Release Gates

In accordance with Section 19 of the DRISTI-NET Constitution (`docs/context.md` §19):

### Gate 1: Integrity and Security
- All uploaded evidence must be quarantined until scanned.
- All stored files must match their SHA-256 manifests.
- Tampered files must be detected and rejected immediately.
- PII masking must be active by default on all endpoints and views.

### Gate 2: Evidentiary Traceability
- Every entity and claim must link to a valid source document.
- OCR bounding boxes or line coordinates must be present where applicable.
- Contradictory evidence must be preserved and flagged, never silently dropped.

### Gate 3: Human Review Enforcement
- Entity resolution must propose candidate matches without automatic merging.
- Reviewer accept, reject, or defer decisions must be recorded with a written rationale.
- Reversal of a review decision must be fully supported and audited.

### Gate 4: Bounded Analytics
- Knowledge graph queries must enforce maximum hop counts ($k \le 2$) and node caps ($N \le 500$).
- Neo4j query timeouts must be enforced by the server.
- Graph projection failure must degrade gracefully to an in-process fallback without service disruption.

### Gate 5: Language & Regulatory Boundaries
- Output documents and UI text must strictly use neutral terms (*candidate relationship*, *possible bridge*, *review priority*, *integrity reference*).
- Terms such as *criminal*, *kingpin*, *guilt*, *threat score*, *certified*, or *100% accurate* are strictly prohibited.
- Evidence dossiers must display the standard BSA Section 63 technical disclaimer.
