# DRISHTI-NET — AI-Agent Master Context and Implementation Blueprint

## Document purpose

This document is the **agent-ready operating specification** for building DRISHTI-NET. It combines the project context, product purpose, architecture, data model, workflow, roles, build order, strictness rules, prompt templates, language rules, safety boundaries, testing gates, and release instructions into one document.

An AI coding agent or a human team should use this document together with the repository source code and the canonical project memory. It is not permission to claim that an unimplemented feature exists. It is not legal advice. It is not permission to connect to real police, telecom, banking, intelligence, biometric, surveillance, or government systems.

## 1. The one-minute context

DRISHTI-NET is an evidence-linked relationship-discovery system for **authorized retrospective investigations**. It helps an investigator connect approved records across cases, review possible relationships, inspect time and uncertainty, and open the exact source evidence behind an analytical relationship.

The system receives synthetic or approved de-identified records. It preserves original files, calculates integrity references, extracts candidate entities and relationships, proposes conservative identity matches, requires human review, builds a rebuildable temporal POLE+ graph, shows graph/timeline/map/evidence views, enforces access controls and masking, records audit events, and exports an analyst-reviewed report.

> **Product promise:** DRISHTI-NET does not decide who is a criminal. It helps an authorized investigator discover and review evidence-backed relationships across approved cases while showing source provenance, time, uncertainty, missing data, access history, and human decisions.

## 2. Non-negotiable product boundary

### 2.1 The system may

- organize authorized evidence;
- preserve original records and versions;
- extract candidate entities and relationships;
- show source-linked graph connections;
- identify possible bridges, intermediaries, communities, repeated patterns, and review priorities;
- help an investigator compare time periods and cases;
- support human review and reversible decisions;
- forecast only bounded aggregate incident patterns if separately specified and validated;
- produce an analyst-reviewed report.

### 2.2 The system must not

- decide guilt or innocence;
- assign a permanent criminal, terrorist, threat, or risk score to a person or community;
- recommend arrest, surveillance, account freezing, prosecution, or enforcement action;
- automatically merge people because they share a phone, device, address, vehicle, tower, account, name, or location;
- generate a “kingpin” label;
- use centrality as proof of criminality;
- create autonomous police alerts;
- perform biometric or facial-recognition targeting;
- use real personal data in the hackathon demo;
- claim live ICJS, CCTNS, CDR, IPDR, SDR, banking, CCTV, intelligence, forensic, or government access without written authorization and tested connectors;
- claim legal certification, court admissibility, DPDP/BSA certification, production readiness, or 100% accuracy without appropriate evidence.

## 3. How to classify every project statement

Every feature, architecture element, result, metric, and sentence in agent output must carry one of these statuses when its status matters:

| Status | Meaning | Allowed wording |
| --- | --- | --- |
| Demonstrated | Exists in code and passes a relevant test or demo | “The prototype implements…” |
| MVP target | Required for the current bounded build but not yet proven | “The MVP will implement…” |
| Architecture target | Defined in the long-term design | “The target architecture includes…” |
| Roadmap | Intentionally postponed | “A later phase may evaluate…” |
| Unsupported | Stated without adequate artifact or evidence | Remove, qualify, or create a validation task |

The agent must never convert “planned,” “recommended,” “designed,” or “target” into “implemented,” “verified,” “certified,” or “production-ready.”

## 4. Source authority and project memory

Use the project source index and memory before making project claims. The current source authority is:

1. `#DRISTI-NET--#ULTIMATEMASTERPROJECTRECONSTRU....pdf` — latest primary target architecture.
2. `DRISHTI-NET_Comprehensive_Updated_Project_Report.md` — corrected canonical project definition.
3. `DRISHTI-NET_FINAL_25_DAY_MVP_PLAN.md` — 25-day implementation schedule.
4. `DRISHTI-NET_Document_3_Technical_Requirements_Updated.md` — requirements and model/data constraints.
5. `DRISHTI-NET_Document_4_Expert_Review.md` and `DRISHTI-NET — Four-DOCX Consolidated Audit.md` — review and correction authority.
6. `DRISHTI-NET_FINAL_PROJECT_MEMORY.md` — durable context and corpus map.
7. `DRISHTI-NET_SIX_ROLE_TEAM_EXECUTION_HANDBOOK.md` — role ownership and handoffs.
8. `DRISHTI-NET_MASTER_WORKFLOW_AND_7_DAY_PROTOTYPE_PLAN.md` — easy-language build path.
9. Official SIH, legal, research, premortem, schemas, diagrams, scripts, and historical drafts for their narrower subjects.

When a source conflicts with a newer corrected decision, preserve the old source for audit but use the corrected decision for implementation. Cite the specific filename when making project claims.

> Repository note: the source documents above are not stored in this repository. `docs/status.md` records which of their requirements are demonstrated here.

## 5. Users and user goals

| User role | Goal | Must be able to do |
| --- | --- | --- |
| Investigator | Explore a case | Search authorized entities, inspect candidate relationships, open evidence |
| Evidence officer | Manage source records | Upload, classify, verify status, view provenance, manage versions |
| Reviewer/supervisor | Control uncertain matches | Accept, reject, defer, reverse, annotate, and stale-mark decisions |
| Analyst | Compare patterns | Filter graph/timeline/map, inspect bridges, communities, and candidate anomalies |
| Auditor | Verify accountability | View access history, decisions, exports, denials, and integrity references |
| Administrator | Operate the demo environment | Manage users, roles, assignments, policies, and health |

The prototype uses synthetic users and fictional cases. A user not assigned to a case must be denied by the backend, not merely hidden by the frontend.

## 6. The canonical end-to-end workflow

```
Authorized case created
  → source uploaded
  → filename/type/size/structure validated
  → original stored in quarantine
  → SHA-256 calculated and manifest recorded
  → malware scan gate evaluated
       ├── clean → controlled extraction
       └── infected/failed/timeout/unavailable → remain quarantined
  → parser/OCR/structured reader in restricted worker
  → normalized values retain originals
  → entity and relationship candidates produced
  → candidate evidence and provenance shown
  → human review: accept/reject/defer/reverse/stale
  → approved claims projected into temporal POLE+ graph
  → bounded analytics and time filters run
  → graph/timeline/map/evidence workspace displayed
  → access, masking, and audit controls applied
  → human-reviewed report exported
```

### 6.1 Failure behavior

Every stage must have a visible failure state. Failures must not silently become success.

| Failure | Required behavior |
| --- | --- |
| Unsupported file | Reject or quarantine; record reason |
| MIME/magic-byte mismatch | Reject or quarantine; do not parse |
| Archive exceeds limit | Reject or quarantine; record limit violation |
| Infected file | Keep quarantined/rejected; never parse |
| Scanner failure/timeout/unavailable | Keep quarantined; do not call it clean |
| Parser/OCR failure | Preserve original; mark processing failure; retry or review |
| Low-confidence extraction | Create candidate with uncertainty; do not assert fact |
| Contradictory sources | Preserve both; create contradiction object and review task |
| Resolution disagreement | Defer; do not merge |
| Graph projection failure | Keep authoritative records; mark projection stale; retry/rebuild |
| Unauthorized request | Deny server-side and audit |
| Hash mismatch | Mark integrity mismatch; block normal acceptance and investigate |

## 7. Architecture blueprint

### 7.1 Seven-day prototype topology

```
React + TypeScript UI
        ↓
FastAPI API
        ↓
PostgreSQL: cases, users, assignments, evidence metadata, candidates,
reviews, jobs, audit and report records
        ↓
MinIO or controlled local object storage
        ↓
Quarantine → hash → scan gate
        ↓
Python extraction worker: CSV/JSON + one bounded PDF/OCR route
        ↓
Entity/relation candidate records
        ↓
Human review endpoint and UI
        ↓
Neo4j Community or a small NetworkX test projection
        ↓
Bounded graph API
        ↓
Graph + timeline + evidence drawer + report export
```

Use the simpler path if a full distributed stack would slow the team. A working one-process worker with clear module boundaries is better than five unoperated services.

### 7.2 Target architecture

```
Browser: React + TypeScript + Sigma.js/Graphology or Cytoscape.js
        ↓ HTTPS/WSS/TLS
NGINX/reverse proxy with tested controls
        ↓
FastAPI API, authentication, jobs and bounded graph queries
        ↓
Authorization policy: OIDC/JWT + RBAC/ABAC or documented MVP equivalent
        ↓
PostgreSQL + PostGIS: authoritative metadata, claims, reviews, audit and state
Redis: temporary cache, rate limits and coordination only
        ↓
MinIO/S3 evidence vault: quarantine, accepted evidence, rejected evidence,
versions and derived artifacts
        ↓
Kafka/Redpanda: replayable events and decoupled workers when justified
        ↓
Restricted OCR, structured parser, NLP and entity-resolution workers
        ↓
Human review queue
        ↓
Neo4j temporal POLE+ analytical projection
        ↓
Bounded analytics, provenance viewer, audit and transparency records
```

### 7.3 Source-of-truth rules

| Component | Authoritative responsibility |
| --- | --- |
| Object storage | Original evidence bytes and derived artifacts, subject to policy |
| PostgreSQL | Cases, permissions, evidence metadata, claims, reviews, jobs, audit and integration state |
| Redis | Temporary cache/rate limits/coordination only |
| Kafka/Redpanda | Replayable event delivery when implemented |
| Neo4j | Rebuildable graph projection; not original evidence truth |
| Transparency/integrity record | Cryptographic consistency references; not legal admissibility |

If Neo4j is deleted, the graph must be rebuildable from authoritative evidence, claims, review decisions, and metadata.

## 8. Secure evidence-ingestion design

### 8.1 Correct order

```
Authenticated upload
  → input limits and type/structure validation
  → quarantine storage
  → hash original
  → malware scan
  → safe archive inspection
  → restricted parser/OCR worker
  → normalized extraction
  → candidate generation
```

Never send an unscanned PDF, Office document, archive, image, or complex file to OCR, LibreOffice, archive extraction, NLP, or Neo4j. Malware scanning does not replace parser sandboxing, dependency scanning, resource limits, or archive controls.

### 8.2 Evidence states

Use one shared state vocabulary:

```
UPLOADED
HASHED
QUARANTINED
MALWARE_SCANNING
INFECTED
SCAN_FAILED
SCAN_TIMEOUT
SCANNER_UNAVAILABLE
CLEAN
ACCEPTED
PROCESSING
EXTRACTED
ENTITY_CANDIDATES
HITL
GRAPH_PROJECTED
ACTIVE
REJECTED
STALE
INTEGRITY_MISMATCH
```

Only `CLEAN` may proceed to accepted processing. `SCAN_FAILED`, `SCAN_TIMEOUT`, and `SCANNER_UNAVAILABLE` are not clean.

### 8.3 Archive and parser limits

Define and enforce maximum upload size, archive size, number of contained files, nesting depth, extracted size, compression ratio, page count, image dimensions, parser time, OCR time, memory, and worker CPU. Store the limits in configuration, return a safe error, and audit violations.

## 9. Data model and shared contracts

### 9.1 Common identifiers

- `case_id`: case or investigation container.
- `evidence_id`: source file or evidence version.
- `entity_id`: canonical analytical entity, only after appropriate review rules.
- `claim_id`: extracted, normalized, or asserted statement.
- `relationship_id`: typed connection between entities.
- `provenance_id`: one or more source supports for a claim or relationship.
- `review_id`: human disposition of a candidate.
- `job_id`: processing job.
- `event_id`: asynchronous event or audit event.
- `trace_id`: request/workflow correlation ID.
- `snapshot_id`: reproducible graph/report version.

### 9.2 Evidence record

```json
{
  "evidence_id": "EV-000001",
  "case_id": "CASE-0001",
  "filename": "fir_001.pdf",
  "detected_mime_type": "application/pdf",
  "size_bytes": 1827392,
  "sha256": "recorded-at-runtime",
  "storage_uri": "quarantine://CASE-0001/EV-000001",
  "version": 1,
  "status": "QUARANTINED",
  "classification": "SYNTHETIC_DEMO",
  "jurisdiction": "DEMO-A",
  "purpose": "RETROSPECTIVE_REVIEW",
  "access_class": "CASE_RESTRICTED",
  "created_at": "UTC timestamp",
  "created_by": "USER-001"
}
```

Never place usable credentials in examples. Use placeholders or runtime-generated values.

### 9.3 OCR/extraction record

```json
{
  "extraction_id": "EXT-000001",
  "evidence_id": "EV-000001",
  "source_version": 1,
  "page": 2,
  "row": null,
  "column": null,
  "bbox": [120, 240, 540, 292],
  "original_text": "source text",
  "normalized_text": "normalized text",
  "confidence": 0.87,
  "language": "en",
  "block_type": "paragraph",
  "engine": "ocr-or-parser-name",
  "engine_version": "runtime version",
  "dataset_version": "golden-v1",
  "state": "EXTRACTED"
}
```

### 9.4 Entity candidate

```json
{
  "entity_candidate_id": "EC-000001",
  "evidence_id": "EV-000001",
  "entity_type": "PERSON",
  "original_text": "fictional source name",
  "normalized_value": "fictional normalized name",
  "source_location": {"page": 2, "bbox": [120, 240, 540, 292]},
  "confidence": 0.82,
  "method": "rule-or-model",
  "model_version": "version-or-none",
  "review_state": "REVIEW_REQUIRED"
}
```

### 9.5 Resolution candidate

```json
{
  "resolution_id": "RES-000001",
  "left_candidate_id": "EC-000001",
  "right_candidate_id": "EC-000019",
  "score": 0.78,
  "signals": {
    "name_similarity": 0.9,
    "time_compatibility": 0.4,
    "location_compatibility": 0.7,
    "shared_identifier": true
  },
  "positive_evidence": ["EV-000001"],
  "counter_evidence": ["EV-000007"],
  "missingness": ["no independent identity source"],
  "decision_state": "REVIEW_REQUIRED",
  "reviewer_id": null,
  "rationale": null,
  "reversible": true
}
```

A numerical score never bypasses human review for a person-level merge.

### 9.6 Relationship and provenance

A relationship must include typed predicate, source and target IDs, observed time, valid interval, operational relevance, evidence state, method, model/rule version, review state, and one or more provenance IDs.

A provenance object must include evidence ID, hash reference, source type, page/row/cell/byte offset or bounding box, extracted text where permitted, extraction method, confidence, timestamp, reviewer state, dataset version, and access context.

### 9.7 Event and audit record

```json
{
  "event_id": "EVT-000001",
  "event_type": "EVIDENCE_STATUS_CHANGED",
  "event_version": 1,
  "trace_id": "TRACE-000001",
  "case_id": "CASE-0001",
  "evidence_id": "EV-000001",
  "actor_id": "USER-001",
  "resource_type": "EVIDENCE",
  "resource_id": "EV-000001",
  "result": "CLEAN",
  "error_code": null,
  "idempotency_key": "upload-request-key",
  "created_at": "UTC timestamp"
}
```

## 10. POLE+ graph blueprint

### 10.1 Node types

Use only node types needed by the current scope, but design the vocabulary consistently:

`Person` · `Alias` · `Organization` · `Case` · `Evidence` · `Event` · `Location` · `H3Cell` · `Device` · `SIM` · `PhoneToken` · `AccountToken` · `Vehicle` · `Communication` · `FinancialEvent` · `Review` · `Provenance`

### 10.2 Relationship types

Examples include `MENTIONED_IN`, `ALIAS_OF`, `CALLED`, `MESSAGED`, `USED_DEVICE`, `SHARED_CONTACT`, `TRANSFERRED_TO`, `DEPOSITED_TO`, `WITHDRAWN_FROM`, `AFFILIATED_TO`, `REGISTERED_VEHICLE`, `PINGED_AT`, `CO_LOCATED_AT`, `TRAVELLED_ROUTE`, `ASSOCIATED_WITH_CASE`, and `SUPPORTED_BY`.

### 10.3 Required edge properties

```
source_id
source_type
evidence_span
observed_at
valid_from
valid_to
confidence
method
review_state
jurisdiction
authority_reference
access_class
model_version
snapshot_id
provenance_ids
operational_relevance
contradiction_ids
```

### 10.4 Graph-query rules

The backend, not the browser, constructs parameterized graph queries. Every query must enforce:

- authenticated actor;
- case and jurisdiction scope;
- purpose and classification checks;
- maximum hops;
- maximum nodes and edges;
- time window;
- pagination or result limits;
- supernode handling;
- query timeout and cancellation;
- audit event.

The browser must never receive unrestricted Cypher access or connect directly to Neo4j.

## 11. AI and analytical behavior

### 11.1 Extraction

Start with deterministic structured parsing and a narrow OCR/NER baseline. Preserve source spans, model/rule name, version, language, confidence, and failure examples. A model may propose an entity or relation; it must not silently create a verified fact.

### 11.2 Entity resolution

Use this cascade:

1. normalize original values without deleting them;
2. block candidate pairs using rare attributes, locality, organization, time, and controlled identifiers;
3. apply deterministic checks;
4. calculate transparent component signals;
5. show positive evidence, counter-evidence, conflicts, and missingness;
6. require human accept/reject/defer before a person-level merge;
7. support reverse merge and projection rebuild.

A shared phone, address, device, vehicle, tower, or location may create a candidate shared-identifier relationship. It is not proof that two records refer to the same person.

### 11.3 Analytics

Use interpretable methods first:

- bounded shortest paths and k-hop neighborhoods;
- degree and weighted degree;
- betweenness or bridge candidates;
- one community method with stability output;
- communication burst rule;
- financial fan-in/fan-out rule;
- temporal filters and query-time relevance decay;
- coarse spatial overlap over documented H3 resolution and time tolerance.

Use neutral output labels: candidate bridge; possible intermediary; high-volume node; review priority; repeated co-occurrence candidate; device-sharing candidate; transaction-flow candidate.

Do not use “kingpin,” “criminal score,” “guilt probability,” or “threat score.”

### 11.4 Temporal semantics

Store observed time, valid time, and ingestion time separately. Temporal decay may affect ranking or current relevance but must not rewrite historical evidence. The UI must allow historical mode and disclose data age, coverage, and uncertainty.

### 11.5 LLM and GraphRAG policy

LLM or GraphRAG use is optional and secondary. If used, it may summarize permission-filtered evidence and cite document IDs and spans. It must not invent graph edges, resolve identities, convert model inference into source fact, bypass authorization, or produce unsupported legal conclusions.

Log model name/version, prompt version, retrieved evidence IDs, source spans, output, reviewer, and refusal/error state. Treat uploaded text as untrusted content and defend against prompt injection.

## 12. Six implementation roles

### Role 1 — Data and Provenance Engineer

**Mission:** Protect the evidence lifecycle and make every analytical result traceable.
**Own:** object storage, quarantine, manifest, SHA-256, versions, provenance, authorized retrieval, integrity checks, retention fields.
**Must know:** Python files, JSON, hashes, object storage, metadata, versions, basic secure upload.
**Tasks:** create evidence schema; define states and buckets; validate metadata; store original before processing; hash and reverify; preserve page/row/bbox references; support multiple sources per relationship; test altered files and unauthorized retrieval; coordinate audit and retention fields.
**Handoff:** evidence API to Role 3; safe references to Role 4; provenance to Role 5; source context to Role 2; integrity fixtures to Role 6.
**Done when:** upload, quarantine, hash, status, authorized retrieval, source click-through, and mismatch test work.

### Role 2 — Frontend and Visual Investigation Engineer

**Mission:** Make the investigation understandable and uncertainty visible.
**Own:** React interface, case dashboard, upload status, graph, timeline, map, evidence drawer, review queue, masking and report screens.
**Must know:** TypeScript, React, CSS, API integration, graph visualization, accessibility, candidate language.
**Tasks:** build typed client; show all evidence states; render bounded graph; connect edge to source; show timeline and historical mode; show contradictions and missingness; implement review actions; mask sensitive fields; test denial, loading, failure, and supernode states.
**Handoff:** UI requirements to Roles 1, 3, and 5; demo screens to Role 6.
**Done when:** a user can follow case → graph → timeline → source → review → report.

### Role 3 — Core Backend and Security Engineer

**Mission:** Build the controlled server and authoritative relational state.
**Own:** FastAPI, PostgreSQL, authentication, authorization, jobs, audit, masking, bounded graph API, export controls, health checks.
**Must know:** Python, FastAPI, REST/OpenAPI, SQL, migrations, authentication, RBAC/ABAC, Docker, testing.
**Tasks:** publish `/api/v1`; implement users, cases, assignments, permissions, evidence metadata, jobs, review, graph, provenance, audit, masking and reports; enforce limits; block direct graph access; test horizontal access and denial; run secret scans.
**Handoff:** OpenAPI to Role 2; metadata/jobs to Roles 1 and 4; graph API to Role 5; security reports to Role 6.
**Done when:** protected endpoints, state transitions, jobs, audit, graph limits, masking, and complete vertical slice work.

### Role 4 — NLP and Secure Ingestion Engineer

**Mission:** Safely turn approved files into source-linked candidate claims.
**Own:** validation, quarantine gate, malware scan integration, parser/OCR worker, normalization, NER, relation candidates, extraction metrics.
**Must know:** Python, PDFs/images/CSV/JSON, regex, OCR, normalization, structured output, worker isolation.
**Tasks:** validate MIME/magic bytes/structure; enforce archive limits; scan fail-closed; parse selected formats; preserve original/normalized values; generate candidate entities and relations; record source spans and model versions; measure extraction; test failures and retries.
**Handoff:** candidate payloads to Role 5; status/events to Role 3; blocks/spans to Role 2; scan and metrics to Role 6.
**Done when:** clean synthetic input creates reproducible, source-linked candidates and unsafe input remains quarantined.

### Role 5 — Graph and Entity-Resolution Engineer

**Mission:** Build a safe, explainable, rebuildable relationship graph.
**Own:** POLE+ ontology, Neo4j projection, candidate matching, review state effects, bounded queries, temporal semantics, analytics.
**Must know:** graphs, Cypher, matching, precision/recall, temporal data, centrality, communities, false positives.
**Tasks:** define nodes and edges; add constraints; project approved claims; implement transparent matching; show counter-evidence; require review; support reverse merge; bound paths; control supernodes; implement degree/bridge/community/rule analytics; test rebuild and false links.
**Handoff:** graph/query contracts to Roles 2 and 3; provenance requirements to Role 1; test results to Role 6.
**Done when:** approved claims appear in a bounded graph, every important edge has provenance, and rejected/deferred matches do not create person merges.

### Role 6 — Technical Integration Lead and Presenter

**Mission:** Make the whole product work together and communicate it honestly.
**Own:** contracts, dependency board, integration tests, release candidate, documentation, demo, judge Q&A, claim verification.
**Must know:** enough API, UI, database, worker, graph, Docker, tests, security, and project context to diagnose integration failures.
**Tasks:** freeze IDs and schemas; maintain task board; run clean-start tests; connect upload through report; verify all gates; run five dry runs; create release archive, limitations and demo script; remove unsupported claims.
**Done when:** a new user can run the documented demo without developer intervention and every presentation claim has a supporting artifact or explicit status.

## 13. Repository blueprint

```
DRISHTI-NET/
├── README.md
├── .env.example
├── docker-compose.yml
├── Makefile
├── docs/
│   ├── context.md
│   ├── workflow.md
│   ├── architecture.md
│   ├── contracts.md
│   ├── data-dictionary.md
│   ├── security.md
│   ├── responsible-ai.md
│   ├── demo-script.md
│   └── limitations.md
├── data/synthetic/
├── apps/api/
├── apps/web/
├── workers/
├── packages/schemas/
├── packages/events/
├── graph/
├── policy/
├── infrastructure/
├── tests/integration/
├── tests/security/
├── tests/evaluation/
├── tests/e2e/
└── reports/
```

## 14. Build order

Build in this order unless a documented dependency requires an exception:

1. Write scope, prohibited-use statement, IDs, states, and golden demo story.
2. Create synthetic data and truth labels.
3. Create Docker Compose or a documented local start path.
4. Create PostgreSQL migrations and seed users/cases.
5. Implement evidence upload, quarantine, hash, and status.
6. Implement scan gate and safe extraction.
7. Implement source-linked candidates.
8. Implement human review and audit.
9. Implement graph projection and bounded API.
10. Implement graph/timeline/evidence UI.
11. Add masking, authorization, denial, tamper, and secret checks.
12. Add report export and evaluation reports.
13. Stabilize and perform dry runs.

Do not begin with advanced AI. First prove that one source-linked candidate can travel safely through the entire system.

## 15. Prompt and instruction system for AI agents

### 15.1 Agent hierarchy

Use three instruction layers:

1. **Project constitution:** this document, project memory, safety boundaries, authority order, and prohibited uses.
2. **Role instruction:** the selected role’s ownership, tasks, interfaces, and definition of done.
3. **Task prompt:** one concrete issue with paths, inputs, outputs, tests, constraints, and stop conditions.

A lower layer cannot override a higher layer. If a task conflicts with the project constitution, stop and report the conflict instead of silently choosing the unsafe path.

### 15.2 Strictness levels

| Level | Use | Agent behavior |
| --- | --- | --- |
| `STRICT` | Security, permissions, evidence states, identity merges, schema changes, migrations | Do not improvise; inspect files; make minimal changes; add tests; stop on ambiguity |
| `CONTROLLED` | API/UI/worker implementation | Use approved patterns; small reversible changes; test contracts and failure states |
| `FLEXIBLE` | Copy, layout, visual style, noncritical documentation | Choose reasonable implementation while preserving terms and safety language |

Use `STRICT` by default for evidence handling, identity resolution, authorization, legal wording, and release claims.

### 15.3 Universal coding-agent prompt

```
You are working on DRISHTI-NET, an evidence-linked relationship-discovery prototype.

Read first:
- docs/context.md (this constitution)
- docs/status.md (what is demonstrated vs target)
- the relevant role section
- the target files and their tests

Task: [ONE concrete task]
Role: [Role 1–6]
Strictness: [STRICT | CONTROLLED | FLEXIBLE]
Inputs: [files, schemas, endpoints, fixtures]
Required output: [exact files or behavior]

Rules:
- Preserve source provenance and existing IDs.
- Do not invent facts, credentials, data access, or benchmark results.
- Do not silently change shared schemas or evidence states.
- Do not automatically merge people.
- Do not expose unrestricted graph queries.
- Do not process unscanned complex files.
- Use neutral candidate language.
- Keep changes small and reversible.

Implementation steps:
1. Inspect the relevant files and tests.
2. State the current behavior and dependency assumptions.
3. Implement the smallest correct change.
4. Add or update tests for success and failure paths.
5. Run the specified validation commands.
6. Report files changed, tests run, results, limitations, and any unresolved risk.

Stop conditions:
- required contract is missing;
- source authority is contradictory and materially affects behavior;
- a task would require real sensitive data or unapproved external access;
- a security or permission failure cannot be safely resolved;
- a requested claim cannot be supported by an artifact.
```

### 15.4 Role prompt — Data and Provenance

```
Act as Role 1, Data and Provenance Engineer.
Implement only evidence lifecycle, storage metadata, hashes, versions, provenance, and authorized source retrieval.
Never call hashes proof of authenticity, chain of custody, or admissibility.
Never store credentials or real personal data.
Every output must retain evidence_id, source location, version, method, timestamp, and access context.
Add tests for duplicate files, altered files, multiple supporting sources, unauthorized retrieval, and retention states.
```

### 15.5 Role prompt — Frontend

```
Act as Role 2, Frontend and Visual Investigation Engineer.
Build case-first and evidence-first screens using the documented /api/v1 contracts.
Show uncertainty, missingness, contradictions, review state, masking, denial, and historical versus current relevance.
Never display guilt, criminal score, kingpin, or threat labels.
Never connect directly to Neo4j or expose Cypher.
Add tests for loading, empty, failure, unauthorized, masked, stale, and supernode states.
```

### 15.6 Role prompt — Backend and Security

```
Act as Role 3, Core Backend and Security Engineer.
Implement server-side authorization, authoritative PostgreSQL state, API contracts, jobs, audit, masking, bounded graph queries, and safe errors.
Enforce case, jurisdiction, purpose, classification, role, and sensitivity checks.
Log sensitive actions and denials.
Treat scan failure as not clean.
Do not introduce plaintext credentials.
Add regression tests for horizontal privilege escalation, unauthorized evidence, graph bounds, export denial, unmask justification, and audit completeness.
```

### 15.7 Role prompt — NLP and Ingestion

```
Act as Role 4, NLP and Secure Ingestion Engineer.
Process only accepted clean evidence.
Validate type, magic bytes, structure, size, archive limits, and scanner status before parsing.
Preserve original values, normalized values, source spans, confidence, engine/version, and failure states.
Return candidate entities and relations, not silently verified facts.
Add extraction metrics and adversarial/failure fixtures.
```

### 15.8 Role prompt — Graph and Resolution

```
Act as Role 5, Graph and Entity-Resolution Engineer.
Build a rebuildable POLE+ projection from approved claims and review decisions.
Use transparent matching signals, counter-evidence, contradictions, missingness, and review states.
A shared identifier never automatically proves person identity.
Bound all graph queries, control supernodes, preserve timestamps, and use neutral analytical labels.
Add false-merge, false-split, reversal, rebuild, time-window, and provenance tests.
```

### 15.9 Role prompt — Integration Lead

```
Act as Role 6, Technical Integration Lead and Presenter.
Verify that the complete workflow works from synthetic upload to human-reviewed report.
Freeze and check contracts, IDs, events, states, and errors.
Run integration, security, usability, evaluation, and dry-run checks.
Remove unsupported production, legal, accuracy, and live-access claims.
Report exact blockers and assign one owner per blocker.
```

### 15.10 Code-review prompt

```
Review this change as a strict DRISHTI-NET maintainer.
Check:
1. source provenance and evidence-state correctness;
2. authorization and case/jurisdiction/purpose scope;
3. identity-merge safety and reversibility;
4. graph bounds and direct database exposure;
5. scanner failure and parser safety;
6. audit coverage and secret handling;
7. schema/API compatibility;
8. test coverage for success and failure;
9. neutral, non-accusatory language;
10. unsupported claims or status inflation.
Return findings grouped as BLOCKER, HIGH, MEDIUM, LOW, followed by a merge decision and missing tests.
```

### 15.11 Architecture-review prompt

```
Review the proposed architecture against the DRISHTI-NET blueprint.
Separate target design from demonstrated implementation.
Check source-of-truth ownership, rebuildability, evidence provenance, secure ingestion order, cross-store consistency, authorization boundaries, graph limits, human review, temporal semantics, privacy, and failure behavior.
Identify contradictions with the canonical project memory.
Do not reward extra technologies unless they are necessary and operable in the current MVP.
Return: accepted decisions, required changes, deferred items, unsupported claims, and tests required before approval.
```

### 15.12 Documentation/presentation prompt

```
Rewrite this project text for a technical judge without overclaiming.
Use simple, precise language.
Call outputs candidate relationships or review priorities.
State that the prototype uses synthetic or approved de-identified data.
Distinguish demonstrated behavior, target architecture, roadmap, and limitations.
Do not use criminal, guilt, kingpin, threat, certified, court-ready, or 100%-accurate language unless an approved source and measured artifact specifically support the wording.
Include source filenames for project claims.
```

## 16. Language and naming rules

### 16.1 Preferred terms

| Prefer | Avoid |
| --- | --- |
| candidate relationship | criminal relationship |
| possible bridge | kingpin |
| review priority | threat score |
| source-linked claim | proven fact, when only extracted |
| human-validated for this purpose | legally true |
| tamper-evident audit trail | unalterable database |
| cryptographic transparency mechanism | private blockchain |
| integrity reference | proof of authenticity or admissibility |
| rebuildable graph projection | permanent graph truth |
| shared-identifier candidate | same person |
| current operational relevance | truth has decayed |
| synthetic demonstration | real operational result |

### 16.2 UI language

Every graph and analytics label should be neutral. A relationship card should say:

```
Candidate relationship
Observed in: EV-000001, page 2
Method: structured parser v1
Review state: REVIEW_REQUIRED
Current relevance: medium, based on configured time window
Counter-evidence: EV-000007
Limitations: shared identifier does not establish person identity
```

## 17. Testing and evaluation blueprint

### 17.1 Required test layers

- unit tests for normalization, hash, state transitions, matching signals, and graph rules;
- integration tests for upload → status → extraction → review → projection;
- security tests for authorization, masking, denial, export, secrets, and direct graph access;
- evaluation tests for OCR/NER/relation extraction and false links;
- performance tests with documented dataset size, topology, hardware, browser, concurrency, and measurement boundary;
- end-to-end demo test from clean start.

### 17.2 Golden dataset

Create a fully fictional, versioned dataset containing: three communities; one intended cross-community bridge candidate; one alias that should be accepted; one similar name that should be rejected; one shared phone that should be deferred; one contradiction; one old relationship; one missing field; one high-degree supernode; one masked identifier; truth labels for entities, relationships, contradictions, and decisions.

### 17.3 Metrics

Measure only what can be reproduced. Potential metrics include OCR CER/WER, table extraction, bounding-box accuracy, NER precision/recall/F1, relation precision/recall/F1, false-merge and false-split rate, reviewer agreement, graph known-path correctness, anomaly precision/recall, query P50/P95/P99, result size, source click-through time, access denial rate, audit completeness, tamper detection, and human task time.

Every result must specify dataset version, ground truth, language, model/rule version, hardware, browser, graph size, concurrency, workload, split, measurement boundary, and failure cases.

## 18. 25-day implementation path after the first prototype

| Days | Main objective |
| --- | --- |
| 1–3 | Scope, contracts, schema, roles, synthetic dataset and architecture freeze |
| 4–5 | Reproducible environment, seed data, storage and graph setup |
| 6–10 | Secure ingestion, hash, scan, normalization and extraction baseline |
| 11–12 | Entity candidates, review, provenance and reversibility |
| 13–15 | Graph projection, bounded queries, communities and transparent rules |
| 16–18 | Timeline, workspace, map metadata, filters and evidence click-through |
| 19–20 | Authorization, masking, audit, tamper and secret checks |
| 21–22 | Evaluation, robustness, usability and explanation testing |
| 23–24 | Integration freeze, five dry runs, backup and release candidate |
| 25 | Submission freeze, final hashes, limitations and presentation |

## 19. Final release gates

The release is green only when:

| Gate | Green condition | Red condition |
| --- | --- | --- |
| Data | Synthetic/approved, versioned, traceable | Real or unclear-origin data |
| Evidence | Every important edge opens exact source context | Bare edge or generic file only |
| Identity | Human decision, rationale, counter-evidence and reversal | Silent merge or shared ID treated as identity |
| Security | Server-side denial, masking, audit, tamper and secret scan pass | All users see all data |
| Safety | Neutral candidate language and prohibited-use statement | Guilt, arrest, threat, or certification claim |
| Evaluation | Conditions and limitations documented | Unsupported accuracy or latency claim |
| Integration | Five clean dry runs from upload to report | Manual developer rescue required |
| Release | README, setup, tests, demo script, backups and hashes exist | Reproducibility missing |

## 20. Final agent instruction

When working on DRISHTI-NET, act as a careful senior engineer and evidence-governance collaborator. Read the relevant project sources before changing behavior. Use the smallest reliable implementation. Preserve source distinctions. Ask for clarification only when ambiguity would materially change product behavior, permissions, safety, or data handling; otherwise choose a reversible bounded assumption and record it.

Before claiming completion, report: files read; files changed; architecture or contract decisions made; tests run and results; demonstrated behavior; remaining target or roadmap items; security, privacy, legal-language, or data limitations; exact next step for the team.

Never delete project sources merely to simplify context. Never place credentials in any artifact. Never conceal a contradiction or failed test. Never convert a candidate relationship into a conclusion about criminality.

## References

[1]: `#DRISTI-NET--#ULTIMATEMASTERPROJECTRECONSTRU....pdf` "Primary DRISHTI-NET Master Technical Specification and Forensic Blueprint"
[2]: `DRISHTI-NET_FINAL_PROJECT_MEMORY.md` "Exhaustive DRISHTI-NET project memory and corpus map"
[3]: `DRISHTI-NET_Comprehensive_Updated_Project_Report.md` "Corrected canonical DRISHTI-NET project definition"
[4]: `DRISHTI-NET_Document_3_Technical_Requirements_Updated.md` "Updated technical requirements"
[5]: `DRISHTI-NET_Document_4_Expert_Review.md` "Expert investigator and responsible-AI review"
[6]: `DRISHTI-NET_FINAL_25_DAY_MVP_PLAN.md` "Final 25-day hackathon MVP plan"
[7]: `DRISHTI-NET_SIX_ROLE_TEAM_EXECUTION_HANDBOOK.md` "Six-role team execution handbook"
[8]: `DRISHTI-NET_MASTER_WORKFLOW_AND_7_DAY_PROTOTYPE_PLAN.md` "Easy-language master workflow and seven-day prototype plan"
[9]: `pasted_content.txt` "Supplied role sample and secure-ingestion recommendations"
[10]: `pasted_content_2.txt` "Supplied ClamAV and quarantine implementation review"
[11]: `pasted_content_3.txt` "Supplied team integration and technical execution review"
[12]: `pasted_content_4.txt` "Supplied architecture safeguards and expert Q&A"
