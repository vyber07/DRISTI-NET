# entity resolution evaluation

Computed 2026-09-12T22:09:38+00:00 by `scripts/evaluate.py` against the real ingestion pipeline (upload → scan[testgate] → extract → resolve → graph) run on a throwaway SQLite store, compared to `data/synthetic/truth-labels.json`.

**Scope limitation**: this is exact hit/miss verification of specific planted scenarios in a ~20-person synthetic dataset, not a statistically meaningful precision/recall benchmark over a large annotated corpus -- the golden dataset simply isn't that size. Treat HIT/MISS counts as "does the pipeline still correctly handle this known case", a regression check, not a claim about real-world accuracy.

**Decision accuracy over the 3 planted identity pairs: 3/3.** Predicted decision is derived from confidence using this harness's own thresholds (≥0.65 → APPROVE, ≤0.35 → REJECT, else DEFER) purely to score the matcher's signal quality -- the system itself never auto-decides; every candidate still requires human REVIEW_REQUIRED disposition.

| check | result | detail |
|---|---|---|
| Arjun Malhotra (people.json) / Arjun Malhotara (fir_001.pdf) | confidence 0.98 → APPROVE (correct, expected APPROVE) | spelling variation, same phone, same organisation |
| Rahul Verma (P-X1) / Rahul Verma (P-X2) | confidence 0.02 → REJECT (correct, expected REJECT) | same name, conflicting DOB, address and district |
| Tanvi Bhatt (P-B3) / Imran Shaikh (P-B4) | confidence 0.45 → DEFER (correct, expected DEFER) | shared phone +91 90000 00203 only; no person-level evidence |
