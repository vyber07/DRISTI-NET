import os
"""Neo4j query-timeout enforcement (TASK_BOARD.md Phase 10), live-verified against a real running
Neo4j -- not assumed from the driver's docs. Skipped when no live Neo4j is reachable, the same
skipif-guarded pattern test_storage_s3.py uses for live MinIO.

config.NEO4J_URI is read fresh on every call to neo4j_store.driver()/available() (not cached at
import time), so monkeypatching it here safely points these tests at a real Neo4j without needing
DRISHTI_NEO4J_URI set for the whole test session (the default test run stays on the zero-install
in-process graph fallback).
"""
import pytest

from .. import config
from ..services import neo4j_store as ns

_LIVE_URI = os.environ.get("DRISHTI_TEST_NEO4J_URI", "bolt://neo4j:7687")
_LIVE_PASSWORD = os.environ.get("DRISHTI_NEO4J_PASSWORD", "")


def _real_neo4j_reachable() -> bool:
    try:
        from neo4j import GraphDatabase
        d = GraphDatabase.driver(_LIVE_URI, auth=("neo4j", _LIVE_PASSWORD), connection_timeout=2)
        with d.session() as s:
            s.run("RETURN 1").single()
        d.close()
        return True
    except Exception:
        return False


_HAS_NEO4J = _real_neo4j_reachable()
if os.environ.get("REQUIRE_LIVE_TESTS") == "1" and not _HAS_NEO4J:
    raise RuntimeError("Live tests required but Neo4j is not reachable")


@pytest.fixture
def live_neo4j(monkeypatch):
    monkeypatch.setattr(config, "NEO4J_URI", _LIVE_URI)
    monkeypatch.setattr(config, "NEO4J_PASSWORD", _LIVE_PASSWORD)
    ns.close()  # drop any cached driver so the new config is picked up
    yield
    ns.close()


@pytest.mark.skipif(not _HAS_NEO4J, reason=f"no live Neo4j reachable on {_LIVE_URI}")
def test_read_bounded_round_trip_live(live_neo4j):
    ns.wipe_all()
    nodes = [{"entity_id": "TMO-E1", "kind": "PERSON", "label": "Alice", "access_class": "RESTRICTED"},
             {"entity_id": "TMO-E2", "kind": "PERSON", "label": "Bob", "access_class": "RESTRICTED"}]
    edges = [{"source": "TMO-E1", "target": "TMO-E2", "claim_id": "TMO-C1", "rel_type": "CALLED",
              "evidence_id": "TMO-EV1", "observed_time": "2025-01-01", "weight": 1.0, "confidence": 1.0,
              "missing": False, "state": "ALLOWED", "method": "x"}]
    ns.write_projection("CASE-TMO-TIMEOUT", nodes, edges)
    n, e, truncated = ns.read_bounded("CASE-TMO-TIMEOUT", None, 1, 10)
    assert {x["entity_id"] for x in n} == {"TMO-E1", "TMO-E2"}
    assert len(e) == 1 and e[0]["rel_type"] == "CALLED"
    assert truncated is False
    ns.wipe_all()


@pytest.mark.skipif(not _HAS_NEO4J, reason=f"no live Neo4j reachable on {_LIVE_URI}")
def test_query_timeout_is_enforced_by_the_real_server(live_neo4j, monkeypatch):
    """A vanishingly small NEO4J_QUERY_TIMEOUT_S must make Neo4j itself abort a genuinely slow query
    (not just accept the parameter and ignore it) -- proven with a query engineered to take longer
    than the timeout, exactly the class of bug that only shows up against a real server."""
    from neo4j.exceptions import ClientError

    monkeypatch.setattr(config, "NEO4J_QUERY_TIMEOUT_S", 0.0001)
    with pytest.raises(ClientError) as exc_info:
        with ns.driver().session() as s:
            s.run(ns._q("UNWIND range(1, 50000000) AS x WITH x WHERE x % 999999999 = 0 RETURN count(x)")).single()
    assert "TransactionTimedOut" in (exc_info.value.code or "")


@pytest.mark.skipif(not _HAS_NEO4J, reason=f"no live Neo4j reachable on {_LIVE_URI}")
def test_default_timeout_does_not_break_normal_queries_live(live_neo4j):
    """The default (generous) timeout must not interfere with an ordinary, fast query."""
    with ns.driver().session() as s:
        assert s.run(ns._q("RETURN 1 AS x")).single()["x"] == 1
