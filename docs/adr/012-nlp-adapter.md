# ADR-012: AI / NLP adapter (IndicBERT NER)

## Problem

FIR and document extraction currently uses regex-NER for PERSON, ORGANIZATION, and LOCATION
entities.  Regex works well for the prepared synthetic fixture but is brittle against
unstructured, multilingual, or handwritten-OCR text that a real court document may contain.

## Options considered

- **Regex only** (existing) — fast, deterministic, no weights to manage; brittle against
  free-form text, Hindi/Devanagari, variant formatting.
- **spaCy / GLiNER** — good English coverage; weaker Hindi support; heavier dependency.
- **AI4Bharat IndicBERTv2-MLM-only-NER** — fine-tuned token-classification model covering
  Indian-language named entities (PERSON / ORGANIZATION / LOCATION); matches the legal/crime
  domain data distribution better than en-core-web-* models.
- **OpenAI / Gemini API** — rejected by LLM policy in docs/context.md §11.5: no PII to
  third-party LLM APIs.

## Decision

Add `services/nlp_adapter.py` as an **import-guarded additive pass** on top of the existing
regex-NER.  The adapter activates only when `transformers` and model weights are present.
Regex-NER continues to run unconditionally.

NER model: `ai4bharat/IndicBERTv2-MLM-only-NER` (HuggingFace token-classification pipeline).

## Key constraints

- All NER candidates from the model receive **state = REVIEW_REQUIRED** and must be reviewed
  by a human before entering the graph (docs/context.md §11.2, never automatic merge).
- The adapter method tag is `"indic-bert-ner"` stored in Claim.method.
- Confidence threshold defaults to 0.5; items below are discarded.
- Model weights are not downloaded at runtime in production — they must be pre-cached.
- PII never leaves the system (no API call to a third-party service).

## Trade-offs

- First-call latency when weights are cold (~2–5 s on CPU); eliminated by preload_model()
  at container startup.
- Model accuracy on legal-Devanagari text has not been independently benchmarked against
  this project's data — extraction-evaluation.md honest-scope note applies.
- Regex-NER remains necessary for structured identifiers (phone, account, registration number)
  because the model does not return those entity types.

## Rollback

Remove the `from .nlp_adapter import extract_entities` call from `extract_document()`.
Regex-NER continues unchanged; no DB migration required.

## Verification

`test_new_components.py::TestNlpAdapter` — covers empty text, transformers absent (returns []),
mocked candidates with correct fields, and inference error returning empty list.
