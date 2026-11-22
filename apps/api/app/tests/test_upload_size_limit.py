"""SEC-10: the upload handler must reject an oversized file before buffering all of it, not after.

Lowers config.MAX_UPLOAD_MB for the duration of each test so the fixture file can stay small and
the test fast, while still exercising the real chunked-read path in evidence_routes._read_bounded.
"""
from .. import config


def test_oversized_upload_rejected_without_creating_an_evidence_row(client, officer, monkeypatch):
    monkeypatch.setattr(config, "MAX_UPLOAD_MB", 1)
    oversized = b"x" * (2 * 1024 * 1024)  # 2 MB against a 1 MB cap

    before = client.get("/api/v1/cases/CASE-0001/evidence", headers=officer).json()
    r = client.post("/api/v1/cases/CASE-0001/evidence", headers=officer,
                     files={"file": ("too-big.txt", oversized)}, data={"source_label": "synthetic"})
    assert r.status_code == 413, r.text

    after = client.get("/api/v1/cases/CASE-0001/evidence", headers=officer).json()
    assert len(after) == len(before), "a rejected oversized upload must not create an Evidence row"


def test_upload_within_the_lowered_cap_still_succeeds(client, officer, monkeypatch):
    monkeypatch.setattr(config, "MAX_UPLOAD_MB", 1)
    small = b"name,phone\nFits Fine,+91-900-000-0000\n"

    r = client.post("/api/v1/cases/CASE-0001/evidence", headers=officer,
                     files={"file": ("fits.csv", small)}, data={"source_label": "synthetic", "process": "false"})
    assert r.status_code == 201, r.text
