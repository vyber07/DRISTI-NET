# AI Evaluation Report

**Evaluation Date**: 2026-09-19
**Model Profiles**: 
- OCR: PaddleOCR 3.7.0 (en configuration)
- NER: ai4bharat/IndicBERTv2-MLM-only-NER
- Resolution: Deterministic rules (HitL required)

## 1. Document Extraction (OCR)
| Metric | Score | Target (P1) | Status |
|--------|-------|-------------|--------|
| CER (Character Error Rate) | N/A | < 5.0% | ⚪ Insufficient Data |
| WER (Word Error Rate) | N/A | < 10.0% | ⚪ Insufficient Data |
| Bounding Box IoU | N/A | > 0.85 | ⚪ Insufficient Data |

## 2. Named Entity Recognition (NER)
| Entity Type | Precision | Recall | F1 Score | Target F1 | Status |
|-------------|-----------|--------|----------|-----------|--------|
| PERSON      | 0.00     | 0.00  | 0.00   | > 0.85    | 🔴 Fail |
| ORGANIZATION| 0.00     | 0.00  | 0.00   | > 0.80    | 🔴 Fail |
| LOCATION    | 0.00     | 0.00  | 0.00   | > 0.85    | 🔴 Fail |

## 3. Entity Resolution
| Task | Precision | Recall | F1 Score | Target F1 | Status |
|------|-----------|--------|----------|-----------|--------|
| Pairwise Matching | N/A | N/A | N/A | > 0.90 | ⚪ Insufficient Data |

## 4. Provenance
| Metric | Accuracy | Target | Status |
|--------|----------|--------|--------|
| Exact Line Match | N/A | > 95.0% | ⚪ Insufficient Data |

**Conclusion**: Models evaluated on available data. NER (PERSON, ORG, LOC) computed dynamically. OCR and ER data missing in sample evaluation set.
