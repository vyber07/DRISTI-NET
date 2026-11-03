"""NER model loading is pinned (DEF-100), and the adapter is exercised against the real model at least once
(DEF-027: every other backend test replaces the pipeline with conftest's fake)."""
import pytest

from ..services import nlp_adapter


def test_model_load_is_pinned_to_an_immutable_revision_and_its_own_weights():
    kw = nlp_adapter._pipeline_kwargs()
    assert kw["model"] == "ai4bharat/IndicBERTv2-MLM-only-NER"
    assert len(kw["revision"]) == 40 and all(c in "0123456789abcdef" for c in kw["revision"]), "a commit hash, not a branch"
    assert kw["model_kwargs"]["use_safetensors"] is False  # never pull weights from the refs/pr/1 conversion branch


def test_real_model_through_the_adapter_maps_labels_correctly(monkeypatch):
    """Label order is not documented (the model repo has no card); this pins the empirically observed mapping:
    1/2 person, 3/4 organisation, 5/6 location. Uses only the local cache -- never the network."""
    transformers = pytest.importorskip("transformers")
    monkeypatch.setenv("HF_HUB_OFFLINE", "1")
    try:
        pipe = transformers.pipeline("token-classification", **nlp_adapter._pipeline_kwargs())
    except OSError as exc:  # only "not in the local cache" may skip; any other error is a real failure
        pytest.skip(f"pinned NER model not in the local cache: {exc}")
    pipe.model.config.id2label = {0: "O", 1: "B-PER", 2: "I-PER", 3: "B-ORG", 4: "I-ORG", 5: "B-LOC", 6: "I-LOC"}
    monkeypatch.setattr(nlp_adapter, "_get_pipeline", lambda: pipe)
    text = "Priya Nair works at Infosys Limited in Bengaluru and travelled to Mumbai ."
    found = {(c.kind, c.original_text) for c in nlp_adapter.extract_entities(text, evidence_id="EVD-test", page=1, line_start=1)}
    assert ("ORGANIZATION", "Infosys Limited") in found, found
    assert ("LOCATION", "Bengaluru") in found and ("LOCATION", "Mumbai") in found, found
    assert ("PERSON", "Priya Nair") in found, found
    for kind, txt in found:  # every candidate is a source span, never a fabricated string
        assert txt in text
