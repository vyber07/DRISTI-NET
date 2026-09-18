# Graph model (POLE+)

Node kinds: PERSON · ORGANIZATION · PHONE · ACCOUNT · VEHICLE · LOCATION · DEVICE · EVENT · CASE

Relationship types produced by the extractors:

| rel_type | source → target | from |
|----------|-----------------|------|
| CALLED | PHONE → PHONE | calls.csv |
| OBSERVED_AT | PHONE → LOCATION (cell) | calls.csv |
| TRANSFERRED_TO | ACCOUNT → ACCOUNT | transactions*.csv, FIR |
| USES_PHONE | PERSON → PHONE | people.json, FIR |
| HOLDS_ACCOUNT | PERSON → ACCOUNT | people.json |
| MEMBER_OF | PERSON → ORGANIZATION | people.json, FIR |
| OWNS_VEHICLE | PERSON → VEHICLE | vehicles.csv |
| APPEARS_IN / NAMED_IN | PERSON → CASE | people.json / FIR (hidden from the default projection) |
| POSSIBLE_SAME_AS | PERSON ⇢ PERSON | match candidate (dashed, never a merge) |

Every projected edge carries `claim_id`, `evidence_id`, `observed_time`, `confidence`, `method`, `state`. Aggregated edges add
`count`, `first_seen`, `last_seen`, `relevance` (CURRENT / HISTORICAL / UNDATED) and `decay_score`.
