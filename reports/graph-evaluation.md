# graph evaluation

Computed 2026-11-03T19:13:28+00:00 by `scripts/evaluate.py` against the real ingestion pipeline (upload → scan[testgate] → extract → resolve → graph) run on a throwaway SQLite store, compared to `data/synthetic/truth-labels.json`.

**Scope limitation**: this is exact hit/miss verification of specific planted scenarios in a ~20-person synthetic dataset, not a statistically meaningful precision/recall benchmark over a large annotated corpus -- the golden dataset simply isn't that size. Treat HIT/MISS counts as "does the pipeline still correctly handle this known case", a regression check, not a claim about real-world accuracy.

| check | result | detail |
|---|---|---|
| community C1 (size 16, stability 0.87) | best match: truth community B (Jaccard 0.80) | members: +91 90000 00201, Hilltop Logistics, +91 90000 00203, ACC-DEMO-0202, ACC-DEMO-0205, ACC-DEMO-0201 |
| community C2 (size 13, stability 0.639) | best match: truth community A (Jaccard 1.00) | members: Riverside Traders, ACC-DEMO-0102, Kavya Iyer, ACC-DEMO-0101, Rohan Deshpande, Arjun Malhotra |
| community C3 (size 12, stability 0.419) | no overlap with any truth community | members: +91 90000 00901, +91 90000 00101, +91 90000 00103, +91 90000 00102, +91 90000 00301, +91 90000 00104 |
| community C4 (size 11, stability 0.66) | best match: truth community C (Jaccard 0.75) | members: ACC-DEMO-0301, ACC-DEMO-0302, Lakeside Freight, Manish Tiwari, Vikram Rao, ACC-DEMO-0303 |
| bridge candidate detected: Manish Tiwari's phone (P-BR) | HIT | planted intermediary between community A and community B |
| rule detected: communication_burst (Manish Tiwari's phone → Devika Nair's phone) | HIT | 2025-07-02 21:00–23:00 |
| rule detected: transaction_fan_in (ACC-DEMO-0301) | HIT | 2025-07-20..2025-07-22 |
