import json
import logging
from pathlib import Path

# Add project root to sys.path
import sys
import os
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from apps.api.app.services.nlp_adapter import extract_entities

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

REPORT_TEMPLATE = """# AI Evaluation Report

**Evaluation Date**: 2026-09-19
**Model Profiles**: 
- OCR: PaddleOCR 3.7.0 (en configuration)
- NER: ai4bharat/IndicBERTv2-MLM-only-NER
- Resolution: Deterministic rules (HitL required)

## 1. Document Extraction (OCR)
| Metric | Score | Target (P1) | Status |
|--------|-------|-------------|--------|
| CER (Character Error Rate) | {cer} | < 5.0% | {cer_status} |
| WER (Word Error Rate) | {wer} | < 10.0% | {wer_status} |
| Bounding Box IoU | {iou} | > 0.85 | {iou_status} |

## 2. Named Entity Recognition (NER)
| Entity Type | Precision | Recall | F1 Score | Target F1 | Status |
|-------------|-----------|--------|----------|-----------|--------|
| PERSON      | {p_p}     | {p_r}  | {p_f1}   | > 0.85    | {p_status} |
| ORGANIZATION| {o_p}     | {o_r}  | {o_f1}   | > 0.80    | {o_status} |
| LOCATION    | {l_p}     | {l_r}  | {l_f1}   | > 0.85    | {l_status} |

## 3. Entity Resolution
| Task | Precision | Recall | F1 Score | Target F1 | Status |
|------|-----------|--------|----------|-----------|--------|
| Pairwise Matching | {er_p} | {er_r} | {er_f1} | > 0.90 | {er_status} |

## 4. Provenance
| Metric | Accuracy | Target | Status |
|--------|----------|--------|--------|
| Exact Line Match | {prov_acc} | > 95.0% | {prov_status} |

**Conclusion**: {conclusion}
"""

def _calc_f1(tp, fp, fn):
    p = tp / (tp + fp) if tp + fp > 0 else 0.0
    r = tp / (tp + fn) if tp + fn > 0 else 0.0
    f1 = 2 * p * r / (p + r) if p + r > 0 else 0.0
    return f"{p:.2f}", f"{r:.2f}", f"{f1:.2f}", f1

def evaluate():
    reports_dir = Path(__file__).resolve().parents[1] / "reports"
    reports_dir.mkdir(exist_ok=True)
    report_path = reports_dir / "ai-evaluation.md"
    
    eval_dir = Path(__file__).resolve().parents[1] / "data" / "evaluation"
    gt_file = eval_dir / "ground_truth.json"
    
    if not gt_file.exists():
        logging.warning("Evaluation dataset not found. Outputting NOT EVALUATED.")
        return
        
    logging.info("Running evaluation against held-out dataset...")
    with open(gt_file, 'r') as f:
        data = json.load(f)
    
    tp_p, fp_p, fn_p = 0, 0, 0
    tp_o, fp_o, fn_o = 0, 0, 0
    tp_l, fp_l, fn_l = 0, 0, 0

    # We evaluate against the NLP adapter dynamically
    for doc in data.get("docs", []):
        text = doc["text"]
        truth = doc.get("entities", [])
        
        # Real call to nlp_adapter
        candidates = extract_entities(text)
        
        pred_p = [c.original_text.lower() for c in candidates if c.kind == "PERSON"]
        pred_o = [c.original_text.lower() for c in candidates if c.kind == "ORGANIZATION"]
        pred_l = [c.original_text.lower() for c in candidates if c.kind == "LOCATION"]
        
        true_p = [e["text"].lower() for e in truth if e["type"] == "PERSON"]
        true_o = [e["text"].lower() for e in truth if e["type"] == "ORGANIZATION"]
        true_l = [e["text"].lower() for e in truth if e["type"] == "LOCATION"]
        
        # Calculate true positives etc (simplified metric for evaluation)
        for p in pred_p:
            if p in true_p: tp_p += 1; true_p.remove(p)
            else: fp_p += 1
        fn_p += len(true_p)
        
        for o in pred_o:
            if o in true_o: tp_o += 1; true_o.remove(o)
            else: fp_o += 1
        fn_o += len(true_o)
        
        for l in pred_l:
            if l in true_l: tp_l += 1; true_l.remove(l)
            else: fp_l += 1
        fn_l += len(true_l)
        
    p_p, p_r, p_f1, f1_p = _calc_f1(tp_p, fp_p, fn_p)
    o_p, o_r, o_f1, f1_o = _calc_f1(tp_o, fp_o, fn_o)
    l_p, l_r, l_f1, f1_l = _calc_f1(tp_l, fp_l, fn_l)

    cer = "N/A"
    wer = "N/A"
    iou = "N/A"
    er_p, er_r, er_f1 = "N/A", "N/A", "N/A"
    prov_acc = "N/A"

    report_text = REPORT_TEMPLATE.format(
        cer=cer, cer_status="⚪ Insufficient Data",
        wer=wer, wer_status="⚪ Insufficient Data",
        iou=iou, iou_status="⚪ Insufficient Data",
        p_p=p_p, p_r=p_r, p_f1=p_f1, p_status="🟢 Pass" if f1_p > 0.85 else "🔴 Fail",
        o_p=o_p, o_r=o_r, o_f1=o_f1, o_status="🟢 Pass" if f1_o > 0.80 else "🔴 Fail",
        l_p=l_p, l_r=l_r, l_f1=l_f1, l_status="🟢 Pass" if f1_l > 0.85 else "🔴 Fail",
        er_p=er_p, er_r=er_r, er_f1=er_f1, er_status="⚪ Insufficient Data",
        prov_acc=prov_acc, prov_status="⚪ Insufficient Data",
        conclusion="Models evaluated on available data. NER (PERSON, ORG, LOC) computed dynamically. OCR and ER data missing in sample evaluation set."
    )

    report_path.write_text(report_text)
    logging.info(f"AI evaluation report generated at {report_path}")

if __name__ == "__main__":
    evaluate()
