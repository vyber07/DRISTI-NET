"""Evidence domain service — state machine transitions and content access.

Extracted from evidence_routes.py as part of the backend modularization effort
(docs/engineering/REFACTORING_PLAN.md Stage 4).  Route handlers call these
functions instead of containing the logic inline.
"""
from __future__ import annotations

import io
import json as _json
import re
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..models import Evidence
from ..services.audit import record_audit
from ..services import storage


# ── PDF context helper ────────────────────────────────────────────────────────

def pdf_pages_for_context(data: bytes) -> list[list[str]]:
    """Return per-page line lists for evidence context display (not for extraction).

    Uses pypdf text extraction — fast and deterministic for showing source context
    next to a graph edge. For full OCR extraction, use ocr_adapter.extract_text_from_pdf_bytes.

    Raises HTTPException(422) on parse failure (the original bytes are preserved unchanged).
    """
    from pypdf import PdfReader
    try:
        return [(p.extract_text() or "").splitlines() for p in PdfReader(io.BytesIO(data)).pages]
    except Exception:
        raise HTTPException(422, "source document could not be parsed; the original is preserved unchanged")


# ── Evidence context extraction ───────────────────────────────────────────────

def build_context_window(
    data: bytes,
    extension: str,
    *,
    row: int | None,
    page: int | None,
    line: int | None,
    json_path: str | None,
    window: int,
    mask: bool = True,
) -> dict[str, Any]:
    """Extract a windowed view of source lines around a locator.

    Shared by the masked context endpoint and the authorized reveal endpoint —
    the caller passes ``mask=True`` (default) or ``mask=False`` to control masking.

    Returns a dict suitable for including in the route's JSON response body.
    """
    from ..services.masking import mask_text

    def _apply_mask(text: str) -> str:
        return mask_text(text) if mask else text

    if extension == ".pdf":
        pages = pdf_pages_for_context(data)
        pno = page or 1
        lines = pages[pno - 1] if 0 < pno <= len(pages) else []
        centre = (line or 1) - 1
        locator: dict[str, Any] = {"row": row, "page": page, "line": line}
    else:
        lines = data.decode("utf-8", "replace").splitlines()
        if json_path:
            m = re.match(r"\$\[(\d+)\]", json_path)
            idx = int(m.group(1)) if m else 0
            obj = _json.loads(data.decode("utf-8", "replace"))
            rec = obj[idx] if isinstance(obj, list) and idx < len(obj) else None
            text = _json.dumps(rec, indent=1) if rec is not None else ""
            return {
                "locator": {"json_path": json_path},
                "lines": [
                    {"n": i + 1, "text": _apply_mask(t), "hit": True}
                    for i, t in enumerate(text.splitlines())
                ],
            }
        centre = (row or line or 1) - 1
        locator = {"row": row, "page": page, "line": line}

    lo = max(0, centre - window)
    hi = min(len(lines), centre + window + 1)
    return {
        "locator": locator,
        "lines": [{"n": i + 1, "text": _apply_mask(lines[i]), "hit": i == centre} for i in range(lo, hi)],
    }


# ── State machine helpers ─────────────────────────────────────────────────────

def mark_object_missing(db: Session, ev: Evidence, user_id: str, trace_id: str) -> None:
    """Record an integrity failure when a stored object has disappeared.

    A missing stored object is an integrity failure (docs/context.md §6.1): block
    normal use, keep the record, audit the event.  Idempotent: safe to call if the
    evidence is already in INTEGRITY_MISMATCH state.

    Decision DEC-011: recorded as INTEGRITY_MISMATCH with an explicit reason.
    The caller is responsible for committing the session.
    """
    if ev.status != "INTEGRITY_MISMATCH":
        ev.status = "INTEGRITY_MISMATCH"
        ev.error = "stored object missing"
        record_audit(
            db, trace_id, user_id,
            "INTEGRITY_MISMATCH", "EVIDENCE", ev.evidence_id, ev.case_id,
            outcome="ERROR",
            detail={"expected": ev.sha256, "actual": None, "reason": "stored object missing"},
        )
