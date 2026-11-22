"""PaddleOCR adapter for scanned / low-text PDFs.

Architecture target (docs/context.md §7.2, docs/status.md §8).  Loaded lazily so the API
starts and all unit tests pass even without PaddleOCR installed.

Usage
-----
  from .ocr_adapter import extract_text_from_pdf_bytes

  pages = extract_text_from_pdf_bytes(pdf_bytes)   # list[list[str]] — pages × lines
  # Falls back to pypdf text-layer extraction when PaddleOCR is not installed or when
  # the PDF already contains usable text.  Returns empty strings on failure; never raises.

Provenance
----------
Each extracted line carries a locator that can populate docs/context.md §9.3 fields:
  {"page": int, "line": int, "bbox": [x1, y1, x2, y2], "engine": str, "confidence": float}

Compatibility
-------------
Supports both PaddleOCR 2.x and 3.x:
  - 2.x (paddlepaddle>=2.6, paddleocr>=2.7): uses ocr(img, cls=True) API with
    [[bbox, (text, conf)], ...] return format.
  - 3.x (paddlepaddle>=3.0, paddleocr>=3.0): uses predict(img) API with
    OCRResult objects having rec_texts / rec_scores / rec_polys fields.
  The adapter auto-detects the API version at runtime.

Production note: pin model revisions and pre-cache weights before any release gate.  Never
let a release download unreviewed model weights at runtime.
"""
from __future__ import annotations

import io
import logging
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger("drishti.ocr")

METHOD_VERSION = "0.2.0"


@dataclass
class OcrPage:
    page_number: int           # 1-indexed
    lines: list[str] = field(default_factory=list)
    locators: list[dict] = field(default_factory=list)   # parallel to lines
    engine: str = "pypdf-fallback"
    ocr_applied: bool = False


def _pypdf_pages(pdf_bytes: bytes) -> list[OcrPage]:
    """Best-effort text-layer extraction via pypdf (no external deps).
    Raises on corrupt/truncated PDFs so the pipeline can set EXTRACTION_FAILED.
    Only catches ImportError (pypdf not installed — should never happen; it's in requirements.txt).
    """
    from pypdf import PdfReader  # always available (in requirements.txt)
    reader = PdfReader(io.BytesIO(pdf_bytes))   # raises on corrupt PDF — propagates to caller
    result = []
    for pno, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        lines = text.splitlines()
        locators = [
            {"page": pno, "line": lno, "engine": "pypdf-fallback", "confidence": 1.0}
            for lno in range(1, len(lines) + 1)
        ]
        result.append(OcrPage(page_number=pno, lines=lines, locators=locators,
                              engine="pypdf-fallback", ocr_applied=False))
    return result


def _needs_ocr(pages: list[OcrPage], min_chars_per_page: int = 20) -> bool:
    """Return True if the extracted text is sparse enough to warrant OCR."""
    if not pages:
        return True
    avg_chars = sum(len(l) for p in pages for l in p.lines) / max(len(pages), 1)
    return avg_chars < min_chars_per_page


def _extract_lines_v2(raw: object) -> tuple[list[str], list[float], list[list]]:
    """Parse PaddleOCR 2.x ocr() result: list[list[[bbox, (text, conf)]]] per page."""
    lines: list[str] = []
    scores: list[float] = []
    polys: list[list] = []
    if not raw or not raw[0]:
        return lines, scores, polys
    for item in raw[0]:
        try:
            bbox_raw, (text, conf) = item
            lines.append(str(text))
            scores.append(float(conf))
            polys.append(bbox_raw)
        except Exception:
            continue
    return lines, scores, polys


def _extract_lines_v3(raw_results: list) -> tuple[list[str], list[float], list[list]]:
    """Parse PaddleOCR 3.x predict() result: list of OCRResult objects."""
    lines: list[str] = []
    scores: list[float] = []
    polys: list[list] = []
    for raw in raw_results:
        texts = raw.get("rec_texts") or []
        rec_scores = raw.get("rec_scores") or []
        rec_polys = raw.get("rec_polys") or []
        for text, conf, poly in zip(texts, rec_scores, rec_polys):
            lines.append(str(text))
            scores.append(float(conf))
            polys.append(poly)
    return lines, scores, polys


def _bbox_from_poly(poly: list) -> list:
    """Convert a 4-point polygon to a flat [x1, y1, x2, y2] bounding box."""
    try:
        xs = [pt[0] for pt in poly]
        ys = [pt[1] for pt in poly]
        return [float(min(xs)), float(min(ys)), float(max(xs)), float(max(ys))]
    except Exception:
        return []


def _paddle_pages(pdf_bytes: bytes) -> list[OcrPage]:
    """Run PaddleOCR on rendered PDF images.  Import-guarded so the API starts and
    tests pass without the heavy dependency installed.

    Supports PaddleOCR 2.x (ocr() API) and 3.x (predict() API) transparently.
    Falls back to pypdf on any import or runtime error — never raises.
    """
    try:
        import fitz  # PyMuPDF — renders PDF pages to images
        from paddleocr import PaddleOCR  # noqa: F401 — import check only
    except ImportError as exc:
        logger.info("PaddleOCR/PyMuPDF not installed, using pypdf fallback: %s", exc)
        return []

    try:
        ocr = _get_paddle_instance()
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        result = []
        for pno in range(len(doc)):
            page = doc[pno]
            pix = page.get_pixmap(dpi=300)
            img_bytes = pix.tobytes("png")

            # Auto-detect 2.x vs 3.x API at call time
            if hasattr(ocr, "predict"):
                # PaddleOCR 3.x
                raw_results = list(ocr.predict(img_bytes))
                texts, scores, polys = _extract_lines_v3(raw_results)
            else:
                # PaddleOCR 2.x
                raw = ocr.ocr(img_bytes, cls=True)
                texts, scores, polys = _extract_lines_v2(raw)

            lines: list[str] = []
            locators: list[dict] = []
            for lno, (text, conf, poly) in enumerate(zip(texts, scores, polys), start=1):
                lines.append(text)
                locators.append({
                    "page": pno + 1, "line": lno,
                    "bbox": _bbox_from_poly(poly),
                    "engine": "paddleocr", "confidence": conf,
                })
            result.append(OcrPage(page_number=pno + 1, lines=lines, locators=locators,
                                  engine="paddleocr", ocr_applied=True))
        doc.close()
        return result
    except Exception as exc:
        logger.warning("PaddleOCR pipeline error, falling back to pypdf: %s", exc)
        return []


_paddle_instance: Optional[object] = None


def _get_paddle_instance():
    """Lazy singleton for the PaddleOCR model.  Supports 2.x and 3.x init signatures."""
    global _paddle_instance
    if _paddle_instance is None:
        from paddleocr import PaddleOCR
        import inspect
        params = inspect.signature(PaddleOCR.__init__).parameters
        # PaddleOCR 2.x accepts use_angle_cls + show_log; 3.x removed both
        if "use_angle_cls" in params:
            _paddle_instance = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
        else:
            _paddle_instance = PaddleOCR(lang="en")
    return _paddle_instance


def extract_text_from_pdf_bytes(pdf_bytes: bytes) -> list[OcrPage]:
    """Public entry point.  Always returns a list of OcrPage (may be empty on total failure).
    Tries PaddleOCR only when the pypdf text layer is sparse (scanned / image-only PDF).
    """
    pages = _pypdf_pages(pdf_bytes)
    if _needs_ocr(pages):
        paddle = _paddle_pages(pdf_bytes)
        if paddle:
            return paddle
    return pages


def pages_to_line_lists(ocr_pages: list[OcrPage]) -> list[list[str]]:
    """Convert to the [[line, ...], ...] format expected by Extractor._pages()."""
    return [p.lines for p in ocr_pages]
