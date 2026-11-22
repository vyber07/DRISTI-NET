# DRISTI-NET — Master Implementation Roadmap

**Authority:** `DRISTI_NET_PRIORITIZED_IMPLEMENTATION_ROADMAP.md`, `DRISTI_NET_PENDING_FEATURES.md`, `docs/status.md`  
**Consolidation Date:** 2026-11-19  

---

## 1. Prioritized Roadmap Phases

### Immediate Active Priorities (Phase 2 Hardening)
- **Priority 1: Full Docker Compose Production Verification:** Conduct end-to-end integration test of the live multi-container stack (`docker compose up`) under active load.
- **Priority 2: Repository Cleanup & Memory Consolidation:** Complete consolidation of loose root documentation into structured `memory/`, remove verified duplicate files, and update `.gitignore`.
- **Priority 3: Codebase Architecture Audit:** Review backend routes, domain services, and frontend feature modules for clean separation of UI from business logic.

### Upcoming Architecture Targets (Phase 3 Enterprise Readiness)
- **Priority 4: Large-Scale Multilingual NER Benchmarking:** Benchmark IndicBERTv2 across extensive Hindi, Tamil, and Bengali synthetic corpus.
- **Priority 5: Frontend Bounding Box Overlay:** Render PaddleOCR pixel bounding boxes directly over PDF page views in the evidence inspection drawer.
- **Priority 6: Coarse Spatial Overlap (H3 Analytics):** Implement Uber H3 hexagonal spatial aggregation for coarse movement pattern comparison across cases.

### Long-Term Roadmap (v2.0+)
- **Priority 7: Extended POLE+ Kinds:** Introduce additional node types: `Alias`, `Device`, `SIM`, `H3Cell`, `Communication`, `FinancialEvent`.
- **Priority 8: Cooperative Mid-Flight Cypher Cancellation:** Support real-time cancellation tokens for long-running Neo4j queries.
- **Priority 9: Air-Gapped Kubernetes Deployment:** Helm charts with High Availability PostgreSQL and Neo4j clustering.
