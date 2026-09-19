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

Status: Architecture target.  The import-guarded paddle branch requires
  - paddlepaddle (or paddlepaddle-gpu) >= 2.6
  - paddleocr >= 2.7
which are NOT in requirements.txt (large, GPU-optional dependencies).  When absent the
adapter silently falls back to pypdf text extraction with a "pypdf-fallback" engine tag.

Production note: pin model revisions and pre-cache weights before any release gate.  Never
let a release download unreviewed model weights at runtime.
"""
from __future__ import annotations

import io
import logging
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger("drishti.ocr")

METHOD_VERSION = "0.1.0"


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


def _paddle_pages(pdf_bytes: bytes) -> list[OcrPage]:
    """Run PaddleOCR PP-Structure on rendered PDF images.  Import-guarded so tests pass
    without the heavy dependency installed."""
    try:
        import fitz  # PyMuPDF — renders PDF pages to images
        from paddleocr import PaddleOCR
    except ImportError as exc:
        logger.info("PaddleOCR/PyMuPDF not installed, using pypdf fallback: %s", exc)
        return []

    try:
        # One-time init per process (lazy singleton)
        ocr = _get_paddle_instance()
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        result = []
        for pno in range(len(doc)):
            page = doc[pno]
            pix = page.get_pixmap(dpi=300)
            img_bytes = pix.tobytes("png")

            raw = ocr.ocr(img_bytes, cls=True)   # returns list[list[[bbox, (text, conf)]]]
            lines: list[str] = []
            locators: list[dict] = []
            if raw and raw[0]:
                for lno, item in enumerate(raw[0], start=1):
                    bbox_raw, (text, conf) = item
                    # bbox_raw: [[x1,y1],[x2,y1],[x2,y2],[x1,y2]]
                    xs = [pt[0] for pt in bbox_raw]
                    ys = [pt[1] for pt in bbox_raw]
                    bbox = [min(xs), min(ys), max(xs), max(ys)]
                    lines.append(text)
                    locators.append({
                        "page": pno + 1, "line": lno,
                        "bbox": bbox, "engine": "paddleocr", "confidence": float(conf),
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
    global _paddle_instance
    if _paddle_instance is None:
        from paddleocr import PaddleOCR
        # lang="en" covers English; "ml" or "hindi" can be added for Devanagari when
        # language-specific model weights are pre-cached in production.
        _paddle_instance = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
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
