"""SEC-11/BUG-NEW-06: successful reads of analysis, timeline, claims, entity and evidence detail/
context/claims must each write an audit event, matching the existing pattern for graph/edge/location
views. Each test reads the newest matching audit event for the actor and asserts it names this read."""

from ..db import SessionLocal
from ..models import AuditEvent


def _latest(db, actor_id: str, action: str):
    return (db.query(AuditEvent)
              .filter_by(actor_id=actor_id, action=action)
              .order_by(AuditEvent.created_at.desc())
              .first())


def _actor_id(client, headers) -> str:
    return client.get("/api/v1/auth/me", headers=headers).json()["user_id"]


def test_analysis_view_is_audited(client, investigator):
    actor = _actor_id(client, investigator)
    assert client.get("/api/v1/cases/CASE-0001/analysis", headers=investigator).status_code == 200
    with SessionLocal() as db:
        assert _latest(db, actor, "ANALYSIS_VIEW") is not None


def test_timeline_view_is_audited(client, investigator):
    actor = _actor_id(client, investigator)
    assert client.get("/api/v1/cases/CASE-0001/timeline", headers=investigator).status_code == 200
    with SessionLocal() as db:
        assert _latest(db, actor, "TIMELINE_VIEW") is not None


def test_claim_view_is_audited(client, ingested, investigator):
    actor = _actor_id(client, investigator)
    g = client.get("/api/v1/cases/CASE-0001/graph?max_nodes=150", headers=investigator).json()
    edge = next(e for e in g["edges"])
    claim_id = client.get(f"/api/v1/cases/CASE-0001/edge?source={edge['source']}&target={edge['target']}&rel_type={edge['rel_type']}",
                          headers=investigator).json()["claims"][0]["claim_id"]
    assert client.get(f"/api/v1/claims/{claim_id}", headers=investigator).status_code == 200
    with SessionLocal() as db:
        assert _latest(db, actor, "CLAIM_VIEW") is not None


def test_entity_view_is_audited(client, ingested, investigator):
    actor = _actor_id(client, investigator)
    g = client.get("/api/v1/cases/CASE-0001/graph?max_nodes=150", headers=investigator).json()
    entity_id = g["nodes"][0]["entity_id"]
    assert client.get(f"/api/v1/entities/{entity_id}?case_id=CASE-0001", headers=investigator).status_code == 200
    with SessionLocal() as db:
        assert _latest(db, actor, "ENTITY_VIEW") is not None


def test_evidence_view_is_audited(client, ingested, investigator):
    actor = _actor_id(client, investigator)
    ev_id = ingested["vehicles.csv"]["evidence_id"]
    assert client.get(f"/api/v1/evidence/{ev_id}", headers=investigator).status_code == 200
    with SessionLocal() as db:
        assert _latest(db, actor, "EVIDENCE_VIEW") is not None


def test_evidence_context_view_is_audited(client, ingested, investigator):
    actor = _actor_id(client, investigator)
    ev_id = ingested["vehicles.csv"]["evidence_id"]
    assert client.get(f"/api/v1/evidence/{ev_id}/context?row=0", headers=investigator).status_code == 200
    with SessionLocal() as db:
        assert _latest(db, actor, "EVIDENCE_CONTEXT") is not None


def test_evidence_claims_view_is_audited(client, ingested, investigator):
    actor = _actor_id(client, investigator)
    ev_id = ingested["vehicles.csv"]["evidence_id"]
    assert client.get(f"/api/v1/evidence/{ev_id}/claims", headers=investigator).status_code == 200
    with SessionLocal() as db:
        assert _latest(db, actor, "EVIDENCE_CLAIMS_VIEW") is not None
