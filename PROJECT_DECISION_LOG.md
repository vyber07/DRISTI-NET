# DRISTI-NET — Project Decision Log

**Document ID:** DRISTI-DEC-001  
**Last Updated:** 2026-11-01  

---

| Decision ID | Date | Area | Decision | Rationale | Alternatives Considered |
|---|---|---|---|---|---|
| **DEC-001** | 2026-11-01 | Governance | Adopt `docs/context.md` as non-negotiable project constitution. | Establishes immutable boundaries, neutral language rules, and prevents status inflation. | Free-form development roadmap (rejected). |
| **DEC-002** | 2026-11-01 | Architecture | Preserve PostgreSQL + MinIO/S3 as authoritative stores; Neo4j as reconstructible projection. | Guarantees analytical flexibility without risking data loss if graph store is rebuilt. | Dual-authoritative model (rejected as prone to split-brain). |
| **DEC-003** | 2026-11-01 | Verification | Reconstruct 32-phase canonical roadmap combining Phases 0-22 with Phases 23-31. | Preserves historical continuity (Export 11, commit `0310914`) while incorporating recent additions (Kafka, Besu, NLP). | Inventing an entirely new roadmap (strictly prohibited by directive). |
| **DEC-004** | 2026-11-01 | Tooling | Standardize on `.venv311` (Python 3.11.14) and Node 24.22.0. | Contains full runtime requirements including PyTorch, PaddleOCR, Transformers, and Playwright. | System python without dependencies (incompatible). |
| **DEC-005** | 2026-11-01 | Testing | Fix frontend TypeScript build check from `tsc --noEmit` to `tsc -b --noEmit`. | References-only `tsconfig.json` bypasses checks in non-build mode, masking syntax errors. | Merging all tsconfig files into one (disrupts project references architecture). |
| **DEC-006** | 2026-11-01 | Language | Reconcile UI copy to strictly neutral terminology per Constitution §16. | Avoids illegal claims of court certification, admissibility guarantees, or automated guilt. | Retaining legacy "court-ready" marketing labels (rejected). |
