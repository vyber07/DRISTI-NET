# Source of Truth and Evidence Hierarchy

Document ID: DRISTI-AUDIT-001
Version: 1.0
Status: VERIFIED
Date: 2026-09-14
Owner: DRISTI-NET Architecture Team
Source of Truth: System Repository & Active Configuration
Scope: Project-wide Forensic Baseline

## Purpose
This document establishes the absolute hierarchy for resolving contradictions between planned architecture, historical documentation, and actual implementation within the DRISTI-NET project. It dictates how evidence is collected and verified.

## Current Status
**VERIFIED**. The forensic baseline has been established via direct inspection of the codebase (`apps/api`, `apps/web`, `tests`). 

## Target State
N/A - This is a governance document.

## Evidence Hierarchy
When sources conflict regarding a feature's implementation status, the following hierarchy is strictly enforced:

1. **LEVEL 1 (Authoritative): Actual Source Code and Runtime Execution** 
   * *Evidence:* `apps/api/app/**/*.py`, `apps/web/src/**/*.tsx`, and Docker/shell execution behavior.
2. **LEVEL 2: Database Schemas and Migrations**
   * *Evidence:* `apps/api/migrations/versions/` and `apps/api/app/models.py`.
3. **LEVEL 3: Automated Tests and CI/CD Output**
   * *Evidence:* `apps/api/app/tests/`, `tests/e2e/`, and Github Actions/Makefiles.
4. **LEVEL 4: Active Configuration and Infrastructure**
   * *Evidence:* `docker-compose.yml`, `scripts/env.sh`, `.env` templates.
5. **LEVEL 5: Architecture Decision Records (ADRs)**
   * *Evidence:* `docs/adr/*.md` (Represents verified project decisions).
6. **LEVEL 6 (Non-Authoritative): Planning and Overview Documentation**
   * *Evidence:* `README.md`, `PROJECT_STATUS.md`, `TASK_BOARD.md`.

## Conflict Resolution Policy
If a requirement is claimed as "Implemented" in documentation (Level 6) but is not found in the Source Code (Level 1), the feature's status MUST be recorded as **MISSING** or **TARGET**. 

*Example from Current Audit:* 
Documentation claims NLP Transformers are used. Source code (`apps/api/app/services/extract.py`) relies on deterministic RegExp. 
*Resolution:* NLP Transformers are classified as **TARGET**, not CURRENT.

## Related Documents
* `CLAIM_REGISTER.md`
* `IMPLEMENTATION_EVIDENCE.md`
