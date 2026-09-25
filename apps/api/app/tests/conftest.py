"""Each test session gets its own DB + storage root so tests never touch the demo data.

Defaults to a throwaway SQLite file for the fast local loop. Set DRISHTI_DATABASE_URL before
running pytest (e.g. to a PostgreSQL URL) to run the same suite against a real Postgres instance
without changing a line of test code -- but point it at a DEDICATED test database, never the demo
one. A bug found via live multi-backend testing (2026-09-12): this fixture used to call `seed()`
without resetting the schema first, so repeated runs against the same persistent Postgres silently
accumulated duplicate evidence/claims/entities across invocations and broke count-based assertions.
For any non-SQLite URL we now drop and recreate the schema at session start, exactly mirroring the
guarantee a fresh SQLite tempfile already gave for the default path.
"""
import os
import tempfile

import unittest.mock

def fake_pipeline(text, **kwargs):
    print("FAKE_PIPELINE CALLED WITH:", len(text))
    print("FAKE_PIPELINE CALLED WITH LEN", len(text))
    results = []
    if "Arjun Malhotara" in text or "Arjun" in text:
        print("FOUND ARJUN IN TEXT")
    if "Arjun Malhotara" in text:
        results.append({"entity_group": "PER", "score": 0.9, "word": "Arjun Malhotara", "start": text.find("Arjun Malhotara")})
    if "Sunrise Enterprises" in text:
        results.append({"entity_group": "ORG", "score": 0.9, "word": "Sunrise Enterprises", "start": text.find("Sunrise Enterprises")})
    if "Silverline Ltd" in text:
        results.append({"entity_group": "ORG", "score": 0.9, "word": "Silverline Ltd", "start": text.find("Silverline Ltd")})
    if "Kavita Rao" in text:
        results.append({"entity_group": "PER", "score": 0.9, "word": "Kavita Rao", "start": text.find("Kavita Rao")})
    if "Vikram Nair" in text:
        results.append({"entity_group": "PER", "score": 0.9, "word": "Vikram Nair", "start": text.find("Vikram Nair")})
    return results

# We mock _get_pipeline to return the fake_pipeline.
# But since test_returns_candidates_with_correct_fields ALSO mocks _get_pipeline locally,
# we need to be careful. The global patch will be overridden by the local patch in that test, which is fine!
_patcher = unittest.mock.patch("apps.api.app.services.nlp_adapter._get_pipeline", return_value=fake_pipeline)
_patcher.start()



from pathlib import Path

_tmp = tempfile.mkdtemp(prefix="drishti-test-")
os.environ["DRISHTI_STORAGE_ROOT"] = _tmp
os.environ.setdefault("DRISHTI_DATABASE_URL", f"sqlite:///{Path(_tmp) / 'test.db'}")
os.environ.setdefault("DRISHTI_SCANNER_MODE", "testgate")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from apps.api.app.main import app  # noqa: E402
from apps.api.app.seed import seed  # noqa: E402
from apps.api.app.config import DATABASE_URL, SYNTHETIC_DIR  # noqa: E402
from apps.api.app.services import neo4j_store  # noqa: E402


def _reset_non_sqlite_schema() -> None:
    from apps.api.app.db import Base, engine

    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)


@pytest.fixture(scope="session")
def client():
    if not DATABASE_URL.startswith("sqlite"):
        _reset_non_sqlite_schema()
    if neo4j_store.available():
        neo4j_store.wipe_all()
    seed()
    return TestClient(app)


def _login(client, username):
    r = client.post("/api/v1/auth/login", json={"username": username, "password": f"{username}-demo"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="session")
def investigator(client):
    return _login(client, "investigator")


@pytest.fixture(scope="session")
def officer(client):
    return _login(client, "officer")


@pytest.fixture(scope="session")
def reviewer(client):
    return _login(client, "reviewer")


@pytest.fixture(scope="session")
def admin(client):
    return _login(client, "admin")


@pytest.fixture(scope="session")
def unassigned(client):
    return _login(client, "unassigned")


@pytest.fixture(scope="session")
def outsider(client):
    return _login(client, "outsider")


@pytest.fixture(scope="session")
def auditor(client):
    return _login(client, "auditor")


def upload(client, headers, case_id, rel, **data):
    p = SYNTHETIC_DIR / rel
    return client.post(f"/api/v1/cases/{case_id}/evidence", headers=headers, files={"file": (p.name, p.read_bytes())}, data={"source_label": "synthetic", **data})


@pytest.fixture(scope="session")
def ingested(client, officer):
    """Case 1 fully ingested (people, aliases, calls, transactions, vehicles, locations, FIR) + case 2 file."""
    out = {}
    for rel in ("people.json", "aliases.json", "calls.csv", "transactions.csv", "vehicles.csv", "locations.csv", "documents/fir_001.pdf"):
        r = upload(client, officer, "CASE-0001", rel)
        assert r.status_code == 201, r.text
        out[Path(rel).name] = r.json()
    r = upload(client, officer, "CASE-0002", "transactions_case2.csv")
    assert r.status_code == 201, r.text
    out["transactions_case2.csv"] = r.json()
    return out
