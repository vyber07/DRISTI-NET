# graph evaluation

Computed 2026-11-03T18:51:07+00:00 by `scripts/evaluate.py` against the real ingestion pipeline (upload → scan[testgate] → extract → resolve → graph) run on a throwaway SQLite store, compared to `data/synthetic/truth-labels.json`.

**Scope limitation**: this is exact hit/miss verification of specific planted scenarios in a ~20-person synthetic dataset, not a statistically meaningful precision/recall benchmark over a large annotated corpus -- the golden dataset simply isn't that size. Treat HIT/MISS counts as "does the pipeline still correctly handle this known case", a regression check, not a claim about real-world accuracy.

| check | result | detail |
|---|---|---|
| community C1 (size 20, stability 0.731) | best match: truth community A (Jaccard 0.80) | members: Riverside Traders, +91 90000 00101, +91 90000 00103, +91 90000 00102, +91 90000 00104, Kavya Iyer |
| community C2 (size 18, stability 0.734) | best match: truth community B (Jaccard 0.40) | members: +91 90000 00901, +91 90000 00201, Hilltop Logistics, +91 90000 00203, +91 90000 00202, ACC-DEMO-0201 |
| community C3 (size 8, stability 0.689) | best match: truth community C (Jaccard 1.00) | members: +91 90000 00302, +91 90000 00301, Lakeside Freight, +91 90000 00303, Pooja Menon, Vikram Rao |
| community C4 (size 6, stability 0.47) | no overlap with any truth community | members: ACC-DEMO-0301, ACC-DEMO-0302, ACC-DEMO-0303, Manish Tiwari, ACC-DEMO-0901, DD01 EF 9012 |
| bridge candidate detected: Manish Tiwari's phone (P-BR) | HIT | planted intermediary between community A and community B |
| rule detected: communication_burst (Manish Tiwari's phone → Devika Nair's phone) | HIT | 2025-07-02 21:00–23:00 |
| rule detected: transaction_fan_in (ACC-DEMO-0301) | HIT | 2025-07-20..2025-07-22 |
