"""AI4Bharat IndicBERT NER adapter — model-backed named entity recognition.

Architecture target (docs/context.md §7.2, docs/status.md §11).  The heavy transformers
branch is import-guarded so all unit tests pass without model weights downloaded.

Model: ai4bharat/IndicBERTv2-MLM-only-NER (token-classification)
  PERSON / ORGANIZATION / LOCATION → maps to DRISHTI-NET's POLE+ entity kinds.

Usage
-----
  from .nlp_adapter import extract_entities

  candidates = extract_entities(text, evidence_id="EV-...", page=1, line_start=1)
  # Returns list[EntityCandidate]; confidence < 0.5 items are filtered out.

Fallback
--------
When transformers / torch is not installed, or model weights are absent, the adapter
returns an empty list silently.  No synthetic entities are generated; the pipeline relies strictly on the active model.  This means the
system degrades gracefully: regex-NER alone is enough for the unit-test suite and the
demo fixtures; real model-backed NER adds coverage for freeform or multilingual text.

STRICT note (AGENTS.md §3): This file and its tests must not be changed without also
running the failure path (model absent / import error → empty list, no exception).

Production note
---------------
Pin an immutable model revision (e.g. via HF Hub commit hash or a local weights cache)
before any release.  Do not let a production build download unreviewed model weights at
runtime.  See docs/adr/012-nlp-adapter.md.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger("drishti.nlp")

METHOD = "indic-bert-ner"
METHOD_VERSION = "0.1.0"

# Map IndicBERT label → DRISHTI-NET entity kind
_LABEL_MAP = {
    "PER": "PERSON",
    "PERSON": "PERSON",
    "ORG": "ORGANIZATION",
    "ORGANIZATION": "ORGANIZATION",
    "LOC": "LOCATION",
    "LOCATION": "LOCATION",
    "LABEL_1": "PERSON",
    "LABEL_2": "PERSON",
    "LABEL_3": "ORGANIZATION",
    "LABEL_4": "ORGANIZATION",
    "LABEL_5": "LOCATION",
    "LABEL_6": "LOCATION",
}

_MODEL_NAME = "ai4bharat/IndicBERTv2-MLM-only-NER"
# DEF-018 / DEF-100: the model was loaded by name only (mutable `main`), and because `main` ships only a pickle
# `pytorch_model.bin`, transformers silently fetched `model.safetensors` from an unmerged conversion PR branch
# (refs/pr/1). Pin the exact commit and load that commit's own weights. Override only with a reviewed commit hash.
_MODEL_REVISION = os.environ.get("DRISHTI_NER_MODEL_REVISION", "924ec1c38bac2cec70ce3b4ed6c2cd60282a518d")
# DRISHTI_NER_OFFLINE=1: never contact huggingface.co; the pinned revision must already be in the local cache.
_OFFLINE = os.environ.get("DRISHTI_NER_OFFLINE", "") == "1"


def _pipeline_kwargs() -> dict:
    return {
        "model": _MODEL_NAME,
        "revision": _MODEL_REVISION,
        "aggregation_strategy": "simple",
        "model_kwargs": {"use_safetensors": False},
    }
_pipeline_instance: Optional[object] = None


@dataclass
class EntityCandidate:
    kind: str                   # PERSON | ORGANIZATION | LOCATION
    original_text: str
    normalized_text: str
    confidence: float
    method: str = METHOD
    method_version: str = METHOD_VERSION
    locator: dict = field(default_factory=dict)   # page / line / char_offset


def _get_pipeline():
    """Lazy-load the transformers NER pipeline (import-guarded)."""
    global _pipeline_instance
    if _pipeline_instance is None:
        if _OFFLINE:  # must be set before transformers/huggingface_hub read it
            os.environ["HF_HUB_OFFLINE"] = "1"
        from transformers import pipeline as hf_pipeline
        logger.info("Loading IndicBERT NER model: %s (first call)", _MODEL_NAME)
        _id2label = {
            0: "O",
            1: "B-PER",
            2: "I-PER",
            3: "B-ORG",
            4: "I-ORG",
            5: "B-LOC",
            6: "I-LOC",
        }
        _pipeline_instance = hf_pipeline("token-classification", **_pipeline_kwargs())
        if hasattr(_pipeline_instance, "model") and hasattr(_pipeline_instance.model, "config"):
            _pipeline_instance.model.config.id2label = _id2label
            _pipeline_instance.model.config.label2id = {v: k for k, v in _id2label.items()}
        logger.info("IndicBERT NER model loaded.")
    return _pipeline_instance


def extract_entities(
    text: str,
    evidence_id: str = "",
    page: int = 1,
    line_start: int = 1,
    confidence_threshold: float = 0.5,
) -> list[EntityCandidate]:
    """Run model-backed NER on *text*.  Returns [] on import failure or model error.

    Each returned EntityCandidate represents a named entity proposed by the model.
    It is a *candidate* — it must go through human review before any merge.

    Parameters
    ----------
    text: source text (single page or paragraph)
    evidence_id: for locator tagging
    page: 1-indexed page number in the source document
    line_start: first line number corresponding to this text block
    confidence_threshold: discard entities whose model confidence is below this value
    """
    if not text or not text.strip():
        return []
    try:
        pipe = _get_pipeline()
    except ImportError as exc:
        logger.debug("transformers not installed, NER skipped: %s", exc)
        return []
    except Exception as exc:
        logger.warning("NER model load failed: %s", exc)
        return []

    try:
        raw = pipe(text)
    except Exception as exc:
        logger.warning("NER inference failed: %s", exc)
        return []

    import re

    # 1. Normalise raw pipeline items into (kind, start, end, score, word) spans.
    spans: list[dict] = []
    for item in raw:
        label_raw: str = item.get("entity_group") or item.get("entity") or ""
        # Strip a BIO *prefix*. (str.lstrip("B-") strips a character set, not a prefix.)
        label = re.sub(r"^[BI]-", "", label_raw)
        kind = _LABEL_MAP.get(label.upper())
        if kind is None:
            continue
        score: float = float(item.get("score", 0.0))
        if score < confidence_threshold:
            continue
        start, end = item.get("start"), item.get("end")
        word = re.sub(r"\s*##\s*", "", item.get("word", "")).strip()
        spans.append({"kind": kind, "start": start, "end": end, "score": score, "word": word})

    # 2. Merge sub-word fragments: same kind and character-adjacent (end == next start, no gap), which is
    #    how "simple" aggregation splits one source word ("Silver" | "line Ltd"). Words separated by any
    #    character are never merged. The merged span keeps the LOWEST constituent score (conservative).
    merged: list[dict] = []
    for s in spans:
        prev = merged[-1] if merged else None
        if (prev is not None and s["kind"] == prev["kind"] and isinstance(s["start"], int)
                and isinstance(prev["end"], int) and s["start"] == prev["end"]):
            prev["end"] = s["end"]
            prev["score"] = min(prev["score"], s["score"])
            prev["word"] = prev["word"] + s["word"]
        else:
            merged.append(dict(s))

    results: list[EntityCandidate] = []
    for s in merged:
        kind, score = s["kind"], s["score"]
        start_char, end_char = s["start"], s["end"]
        # Preserve the exact source span when offsets are available (constitution §9.3/§11.1: retain originals);
        # fall back to the detokenised word only when the pipeline gives no offsets.
        if isinstance(start_char, int) and isinstance(end_char, int) and 0 <= start_char < end_char <= len(text):
            word = text[start_char:end_char].strip()
        else:
            word = s["word"]
            start_char = start_char if isinstance(start_char, int) else 0
        if not word:
            continue
        lines_before = text[:start_char].count("\n")
        results.append(EntityCandidate(
            kind=kind,
            original_text=word,
            normalized_text=_normalize(word, kind),
            confidence=score,
            locator={
                "page": page,
                "line": line_start + lines_before,
                "char_offset": start_char,
                "evidence_id": evidence_id,
                "engine": "indic-bert-ner",
            },
        ))
    return results


def _normalize(text: str, kind: str) -> str:
    """Minimal normalisation — lowercased, collapsed whitespace."""
    import re
    return re.sub(r"\s+", " ", text.lower().strip())


def preload_model() -> bool:
    """Pre-cache model weights.  Call once at container startup in production to avoid
    first-request latency.  Returns True on success, False if transformers is absent."""
    try:
        _get_pipeline()
        return True
    except Exception as exc:
        logger.info("NER model preload skipped: %s", exc)
        return False

