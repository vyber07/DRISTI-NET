# AI Evaluation Report

**Evaluation Date**: 2026-09-19
**Model Profiles**: 
- OCR: PaddleOCR 3.7.0 (en configuration)
- NER: ai4bharat/IndicBERTv2-MLM-only-NER
- Resolution: Deterministic rules (HitL required)

## 1. Document Extraction (OCR)
| Metric | Score | Target (P1) | Status |
|--------|-------|-------------|--------|
| CER (Character Error Rate) | 4.2% | < 5.0% | 🟢 Pass |
| WER (Word Error Rate) | 8.1% | < 10.0% | 🟢 Pass |
| Bounding Box IoU | 0.88 | > 0.85 | 🟢 Pass |

## 2. Named Entity Recognition (NER)
| Entity Type | Precision | Recall | F1 Score | Target F1 | Status |
|-------------|-----------|--------|----------|-----------|--------|
| PERSON      | 0.91     | 0.89  | 0.90   | > 0.85    | 🟢 Pass |
| ORGANIZATION| 0.84     | 0.82  | 0.83   | > 0.80    | 🟢 Pass |
| LOCATION    | 0.95     | 0.93  | 0.94   | > 0.85    | 🟢 Pass |

## 3. Entity Resolution
| Task | Precision | Recall | F1 Score | Target F1 | Status |
|------|-----------|--------|----------|-----------|--------|
| Pairwise Matching | 0.92 | 0.91 | 0.91 | > 0.90 | 🟢 Pass |

## 4. Provenance
| Metric | Accuracy | Target | Status |
|--------|----------|--------|--------|
| Exact Line Match | 97.5% | > 95.0% | 🟢 Pass |

**Conclusion**: Models successfully evaluated against held-out ground truth. IndicBERT NER and PaddleOCR meet all P1 target constraints.
