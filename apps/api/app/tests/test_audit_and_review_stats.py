import pytest

from ..db import SessionLocal
from ..models import MatchCandidate


@pytest.mark.parametrize("limit", [0, -1, 1001])
def test_global_audit_rejects_out_of_range_limit(client, auditor, limit):
    response = client.get(f"/api/v1/audit?limit={limit}", headers=auditor)
    assert response.status_code == 422


@pytest.mark.parametrize("limit", [0, -1, 1001])
def test_case_audit_rejects_out_of_range_limit(client, investigator, limit):
    response = client.get(f"/api/v1/cases/CASE-0001/audit?limit={limit}", headers=investigator)
    assert response.status_code == 422


def test_audit_accepts_limits_within_documented_bounds(client, auditor, investigator):
    assert client.get("/api/v1/audit?limit=1", headers=auditor).status_code == 200
    assert client.get("/api/v1/cases/CASE-0001/audit?limit=1000", headers=investigator).status_code == 200


def test_identity_merge_stat_counts_approved_candidates_only(client, investigator, ingested):
    response = client.get("/api/v1/cases/CASE-0001/stats", headers=investigator)
    assert response.status_code == 200, response.text

    with SessionLocal() as db:
        candidates = db.query(MatchCandidate).filter_by(case_id="CASE-0001").all()
        approved = sum(candidate.state == "APPROVE" for candidate in candidates)

    assert response.json()["identityMergesCount"] == approved
    assert response.json()["totalTasks"] == len(candidates)
