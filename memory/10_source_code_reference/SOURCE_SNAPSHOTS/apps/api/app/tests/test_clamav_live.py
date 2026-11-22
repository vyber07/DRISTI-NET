import pytest
import os
import socket
from .. import config

def _real_clamav_reachable() -> bool:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(1.0)
        s.connect((config.CLAMAV_HOST, config.CLAMAV_PORT))
        s.sendall(b"zINSTREAM\0")
        s.close()
        return True
    except Exception:
        return False

_HAS_CLAMAV = _real_clamav_reachable()
if os.environ.get("REQUIRE_LIVE_TESTS") == "1" and not _HAS_CLAMAV:
    raise RuntimeError("Live tests required but ClamAV is not reachable")

@pytest.fixture
def live_clamav(monkeypatch):
    monkeypatch.setattr(config, "SCANNER_MODE", "clamav")
    yield

@pytest.mark.skipif(not _HAS_CLAMAV, reason=f"No live ClamAV reachable on {config.CLAMAV_HOST}:{config.CLAMAV_PORT}")
def test_real_clamav_application_scan(client, officer, live_clamav):
    """End-to-end test of the real ClamAV application scan path against a live Compose container."""
    EICAR_PAYLOAD = (config.SYNTHETIC_DIR / "documents" / "eicar_test.txt").read_bytes()

    # Clean file -> EXTRACTED (since extraction runs synchronously in the test flow before HITL)
    # The pipeline is: UPLOAD -> QUARANTINE -> SCAN -> CLEAN -> ACCEPTED -> EXTRACT -> EXTRACTED/HITL/etc
    # Use seeded CASE-0002 (the officer is assigned there). The previous version tried to create a case as
    # EVIDENCE_OFFICER, which the API correctly forbids (403: only INVESTIGATOR/ADMIN may create cases), and
    # omitted the required case_id -- so this test had never passed (it is deselected by `make test`).
    case_id = "CASE-0002"

    clean_data = b"Clean content for live integration test"
    r = client.post(f"/api/v1/cases/{case_id}/evidence", headers=officer, files={"file": ("clean.txt", clean_data)}, data={"source_label": "synthetic"})
    assert r.status_code == 201
    
    # We expect the file to pass scan, get accepted and extracted, and land in EXTRACTED state since it has no candidates to trigger HITL 
    # (or possibly HITL depending on exact heuristic, but definitely not INFECTED/QUARANTINED).
    # Since it's a raw clean.txt, let's just assert it is NOT infected and NOT quarantined.
    status = r.json()["status"]
    assert status == "GRAPH_PROJECTED", f"Expected exact terminal state GRAPH_PROJECTED for 0-candidate text file, got {status}"

    # EICAR file -> INFECTED + remains quarantined
    r = client.post(f"/api/v1/cases/{case_id}/evidence", headers=officer, files={"file": ("eicar.txt", EICAR_PAYLOAD)}, data={"source_label": "synthetic"})
    assert r.status_code == 201
    assert r.json()["status"] == "INFECTED"
