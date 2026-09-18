# Project overview

See the README for the elevator pitch and quick start. This folder holds:

- `workflow.md` — the eleven steps, evidence status machine, claim states
- `architecture.md` — prototype vs target architecture and swap points
- `contracts.md` — every endpoint, ID prefix and locator shape
- `data-dictionary.md` — synthetic dataset and the planted scenarios with expected outcomes
- `security.md` — controls mapped to tests and demo steps
- `demo-script.md` — the click-by-click demonstration
- `limitations.md` — demonstrated vs roadmap

Role ownership (from the seven-day plan) maps onto the code as follows:

| Role | Owns |
|------|------|
| 1 Data & provenance | `models.Evidence/Provenance`, `services/storage.py`, `evidence_routes.verify/context/download` |
| 2 Frontend | `apps/web/src/**` |
| 3 Backend & security | `main.py`, `auth.py`, `routes/*`, `services/audit.py`, `tests/test_security.py` |
| 4 NLP & secure ingestion | `services/extract.py`, `services/scanner.py`, `services/pipeline.py` |
| 5 Graph & entity resolution | `services/resolution.py`, `services/graph.py`, `review_routes.py`, `graph_routes.py` |
| 6 Integration & presenter | `seed.py`, `tests/e2e`, `docs/demo-script.md`, `reports/*` |
