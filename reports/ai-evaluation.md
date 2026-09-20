# AI Evaluation Report

**Evaluation Date**: 2026-09-19
**Model Profiles**: 
- OCR: PaddleOCR 3.7.0 (en configuration)
- NER: ai4bharat/IndicBERTv2-MLM-only-NER
- Resolution: Deterministic rules (HitL required)

## 1. Document Extraction (OCR)
| Metric | Score | Target (P1) | Status |
|--------|-------|-------------|--------|
| CER (Character Error Rate) | NOT EVALUATED | < 5.0% | 🔴 Missing Data |
| WER (Word Error Rate) | NOT EVALUATED | < 10.0% | 🔴 Missing Data |
| Bounding Box IoU | NOT EVALUATED | > 0.85 | 🔴 Missing Data |

## 2. Named Entity Recognition (NER)
| Entity Type | Precision | Recall | F1 Score | Target F1 | Status |
|-------------|-----------|--------|----------|-----------|--------|
| PERSON      | NOT EVAL.     | NOT EVAL.  | NOT EVAL.   | > 0.85    | 🔴 Missing Data |
| ORGANIZATION| NOT EVAL.     | NOT EVAL.  | NOT EVAL.   | > 0.80    | 🔴 Missing Data |
| LOCATION    | NOT EVAL.     | NOT EVAL.  | NOT EVAL.   | > 0.85    | 🔴 Missing Data |

## 3. Entity Resolution
| Task | Precision | Recall | F1 Score | Target F1 | Status |
|------|-----------|--------|----------|-----------|--------|
| Pairwise Matching | NOT EVAL. | NOT EVAL. | NOT EVAL. | > 0.90 | 🔴 Missing Data |

## 4. Provenance
| Metric | Accuracy | Target | Status |
|--------|----------|--------|--------|
| Exact Line Match | NOT EVALUATED | > 95.0% | 🔴 Missing Data |

**Conclusion**: AI pipeline is implemented and integrated, but formal evaluation metrics (CER/WER/F1) cannot be computed because the ground-truth held-out dataset is missing. Metrics are NOT EVALUATED.
