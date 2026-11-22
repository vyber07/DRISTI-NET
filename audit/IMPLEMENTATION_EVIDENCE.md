# Implementation Evidence

This document tracks the verified implementation states against the original architectural roadmap.

| Component | Status | Evidence |
|-----------|--------|----------|
| **NLP Engine** | IMPLEMENTED | `nlp_adapter.py` using `transformers` + `IndicBERTv2-MLM-only-NER` |
| **Regex Restrictions** | IMPLEMENTED | PERSON/ORG Regexes removed; scoped purely to structural IDs. |
| **Kafka Event Bus** | IMPLEMENTED | `bitnami/kafka` in Compose, transactional Outbox implemented in API |
| **Merkle Commits (Besu)** | IMPLEMENTED | `hyperledger/besu` active, anchor endpoints fully bound |
| **AI Evaluation** | IMPLEMENTED | Dynamically computing standard ML metrics (`evaluate_ai.py`) |
| **Frontend Integration** | IMPLEMENTED | HITL graphs and task assignments bridged natively to endpoints |

*All previous placeholders, mocks, and discrepancies have been scrubbed.*
