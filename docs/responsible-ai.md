# Responsible-AI commitments (as built)

Drawn from `docs/context.md` §2, §11 and §16. Each line names where the commitment is enforced.

| Commitment | Where enforced |
|---|---|
| The model proposes; a human decides every person-level merge | `services/resolution.py` only creates `MatchCandidate`; `services/graph.approved_merges` contracts nodes only on `APPROVE` |
| Every decision is attributed, reasoned, timestamped, reversible | `Review` rows, `REVERSE` path, `REVIEW_DECISION` audit |
| Shared identifiers are signals, not identity | `shared_phone` signal carries the caveat text; deferred pair in golden data |
| Counter-evidence, conflicts and missingness are shown beside positive signals | `MatchCandidate.counter_evidence / conflicts / missing`; Review UI |
| Contradictions are preserved, not resolved silently | `extract.flag_contradictions` → `CONTRADICTORY` claims, both kept |
| History is never rewritten; decay affects relevance only | `graph.aggregate` (`relevance`, `decay_score`), Timeline historical mode |
| Neutral vocabulary in all analytic output | `graph.analyze` labels; `test_analysis_uses_neutral_language` |
| Sensitive identifiers masked by default; reveal needs a reason and is audited | `services/masking.py`; `POST /entities/{id}/reveal` |
| No real personal data | `data/synthetic/generate.py`, `LICENSE_OR_PROJECT_NOTICE.md` |
| No LLM in the decision path | none is used; policy for any future use is §11.5 of the constitution |
| Claims about the system carry a status (Demonstrated / target / roadmap) | `docs/status.md`, `docs/limitations.md` |

Banned words in product copy and analytics output: *criminal, kingpin, guilty, threat score, risk score, suspect, certified, court-ready, 100 % accurate*.
