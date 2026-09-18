# extraction evaluation

Computed 2026-09-12T22:09:38+00:00 by `scripts/evaluate.py` against the real ingestion pipeline (upload → scan[testgate] → extract → resolve → graph) run on a throwaway SQLite store, compared to `data/synthetic/truth-labels.json`.

**Scope limitation**: this is exact hit/miss verification of specific planted scenarios in a ~20-person synthetic dataset, not a statistically meaningful precision/recall benchmark over a large annotated corpus -- the golden dataset simply isn't that size. Treat HIT/MISS counts as "does the pipeline still correctly handle this known case", a regression check, not a claim about real-world accuracy.

| check | result | detail |
|---|---|---|
| claims extracted (all evidence) | 344 | scale context, not a truth-label comparison |
| entities created | 58 | scale context, not a truth-label comparison |
| contradiction detected: DD01 AB 1234 owner | HIT | vehicles.csv → Kavya Iyer (P-A2) vs fir_001.pdf → Rohan Deshpande (P-A3) |
| missing-field recorded: transactions.csv.amount_inr | HIT | TXN with reference 'amount missing in source' |
| planted relationship extracted: CALLED P-A1↔P-C1 | HIT | no contact after 2019; should render as historical |
