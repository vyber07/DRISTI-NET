# DRISTI-NET — Master AI, ML & NLP Technical Documentation

**Authority:** `docs/responsible-ai.md`, `docs/adr/012-nlp-adapter.md`, `apps/api/app/services/nlp_adapter.py`, `apps/api/app/services/ocr_adapter.py`  
**Consolidation Date:** 2026-11-19  

---

## 1. Responsible AI Principles & Boundaries

In strict compliance with `docs/context.md` §2 and `docs/responsible-ai.md`:
1. **Zero Autonomous Labeling:** Machine learning models are used strictly as candidate extractors and feature generators. No model ever assigns guilt, suspicion, or threat classifications to individuals.
2. **Mandatory Human Verification:** Every extracted entity and relationship is marked with confidence scores (0.0 to 1.0) and tagged as a *candidate*. Disambiguation proposals require human sign-off.
3. **Fine-Grained Traceability:** AI outputs must cite exact source span coordinates (document page, line, bounding box). Black-box generation without source attribution is rejected.
4. **No LLM Hallucinations:** Generative Large Language Models (LLMs) and ungrounded text generation are intentionally excluded from the analytical reasoning pipeline.

---

## 2. Multilingual Named Entity Recognition (IndicBERTv2)

- **Model:** AI4Bharat `IndicBERTv2-MLM-only-NER` token classification model.
- **Scope:** Specialized in recognizing named entities across Indian linguistic and cultural contexts (PERSON, ORGANIZATION, LOCATION) in mixed English, Hindi, and transliterated scripts.
- **Adapter Architecture (`apps/api/app/services/nlp_adapter.py`):**
  - **Lazy-Loaded:** Model weights load into memory on demand only when extraction jobs are dispatched.
  - **Graceful Fallback:** If `transformers` or GPU/CPU resources are unavailable, the adapter falls back cleanly to regex-based rule extractors, returning an empty candidate list rather than crashing the ingestion pipeline.
  - **Testing Optimization:** The backend test suite utilizes an isolated mock adapter (`FakeNlpAdapter`) to allow full test suite execution in sub-minute runs without downloading heavy multi-gigabyte neural network weights.

---

## 3. Optical Character Recognition (PaddleOCR Adapter)

- **Adapter Architecture (`apps/api/app/services/ocr_adapter.py`):**
  - Uses PaddleOCR for multi-oriented text detection and recognition on scanned investigation documents (FIR copies, seizure memos, handwritten notes).
  - Emits extracted text alongside physical pixel bounding boxes `[x_min, y_min, x_max, y_max]` normalized to page dimensions.
  - Bounding boxes are linked to extracted entities and claims, enabling the frontend document viewer to visually highlight the exact paragraph or line of source text.
  - Falls back to `pypdf` text stream extraction when processing native digital PDFs without scanned images.
