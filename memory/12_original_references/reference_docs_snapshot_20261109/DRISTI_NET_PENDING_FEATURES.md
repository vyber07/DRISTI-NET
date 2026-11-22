# DRISTI-NET Pending Features and Targets

Statuses below are based on inspected source and project docs. “Planned” means documented target without evidence of working implementation. Absence from code is not treated as a historical requirement unless cited.

| ID | Feature | Status | Evidence / remaining work | Priority |
|---|---|---|---|---|
| PN-01 | Token revocation and self-service password recovery | NOT IMPLEMENTED | No route found in inspected `auth_routes.py`; add secure recovery/revocation design and tests. | P1 |
| PN-02 | Durable immutable external audit anchoring for all audit events | PLANNED — NOT IMPLEMENTED | Optional Merkle/Besu anchors exist for integrity references, but no demonstrated complete immutable audit ledger. | P1 |
| PN-03 | PostgreSQL + S3/MinIO restore drill | PLANNED — NOT IMPLEMENTED | `operations/RESTORE_TEST_REPORT.md` does not prove this path; run restore to isolated environment and compare records/bytes. | P0 |
| PN-04 | Off-host encrypted backup and tested RPO/RTO | PLANNED — NOT IMPLEMENTED | Backup policy documents goals; implementation/restore evidence not supplied. | P1 |
| PN-05 | Formal NER/OCR quality evaluation and language tuning | PLANNED — NOT IMPLEMENTED | Existing evaluation is small; `docs/status.md` says language/data version remain target. | P2 |
| PN-06 | H3 spatial-overlap analytics | PLANNED — NOT IMPLEMENTED | `docs/status.md`; current map is local point projection only. | P4 |
| PN-07 | Additional POLE+ kinds (Alias, Device, SIM, H3Cell, Communication, FinancialEvent) | PLANNED — NOT IMPLEMENTED | `graph/README.md`, `docs/status.md`. | P4 |
| PN-08 | Safe mid-flight graph query cancellation | PLANNED — NOT IMPLEMENTED | `docs/status.md` calls cancellation an architecture target. | P3 |
| PN-09 | Kubernetes deployment | PLANNED — NOT IMPLEMENTED | `docs/limitations.md`; Compose/systemd is present. | P4 |
| PN-10 | Historical conversation audit | UNVERIFIABLE | No prior conversations were supplied in the repository or this turn. Repository issue registers are the available history. | P2 |
| PN-11 | CI pipeline and automated release gates | UNVERIFIABLE | No `.github/` workflows found; other CI providers not established. | P2 |
| PN-12 | Live integrations (Postgres, object store, Redis, Neo4j, Kafka, ClamAV, Besu) | UNVERIFIABLE | Configuration/code exists but current connections unavailable; Compose cannot interpolate without required variables. | P1 |
