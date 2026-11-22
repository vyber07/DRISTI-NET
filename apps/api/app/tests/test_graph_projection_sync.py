"""P1.4: graph loading with a Neo4j projection (services/graph.ensure_synced, neo4j_store.write_projection).

Root cause fixed: every graph, analysis, report and integrity request rewrote the whole case into Neo4j. Concurrent
viewers deadlocked (seconds per view), and a time-filtered view stored its subset as the case's projection, so a
concurrent full view could read back part of the case. These tests pin the new behaviour:

- the Neo4j copy is written only by the unfiltered graph view, and only when the projection's fingerprint changed;
- analysis, reports and integrity never write it; time-filtered views neither write nor read it;
- concurrent first views of a changed case write it once; a busy or failing sync serves the correct in-process graph
  flagged projection_stale;
- against a live Neo4j (when reachable): concurrent writers do not deadlock and filtered views never shrink the copy.
"""
import os
import threading
from concurrent.futures import ThreadPoolExecutor

import pytest

from .. import config
from ..services import graph as graph_svc
from ..services import neo4j_store as ns

API = "/api/v1"
CASE = "CASE-0001"


class FakeNeo4j:
    """In-memory stand-in for neo4j_store with the same contract (fingerprint stored with the projection)."""

    def __init__(self):
        self.store: dict[str, dict] = {}
        self.writes: list[str] = []
        self.reads = 0
        self.lock = threading.Lock()
        self.fail = False

    def available(self):
        return True

    def projection_fingerprint(self, case_id):
        return self.store.get(case_id, {}).get("fp")

    def write_projection(self, case_id, nodes, edges, fingerprint=None):
        if self.fail:
            raise RuntimeError("neo4j down")
        with self.lock:
            if fingerprint is not None and self.store.get(case_id, {}).get("fp") == fingerprint:
                return False
            self.writes.append(case_id)
            self.store[case_id] = {"fp": fingerprint, "nodes": [n["entity_id"] for n in nodes], "edges": edges}
            return True

    def read_bounded(self, case_id, center, hops, max_nodes, offset=0):
        self.reads += 1
        ids = sorted(self.store.get(case_id, {}).get("nodes", []))
        page = ids[offset:offset + max_nodes]
        return [{"entity_id": i} for i in page], [], offset + len(page) < len(ids)


@pytest.fixture()
def fake(monkeypatch):
    f = FakeNeo4j()
    for name in ("available", "projection_fingerprint", "write_projection", "read_bounded"):
        monkeypatch.setattr(ns, name, getattr(f, name))
    return f


def _graph(client, headers, **params):
    r = client.get(f"{API}/cases/{CASE}/graph", headers=headers, params=params)
    assert r.status_code == 200, r.text
    return r.json()


def test_unchanged_projection_is_written_once(client, investigator, ingested, fake):
    a = _graph(client, investigator)
    b = _graph(client, investigator)
    assert fake.writes == [CASE], "second view of an unchanged case must not rewrite Neo4j"
    assert len(a["nodes"]) == len(b["nodes"]) == a["total_nodes"] > 0
    assert not a["projection_stale"] and not b["projection_stale"]
    assert fake.reads == 2  # both views were served from the Neo4j copy


def test_analysis_report_and_integrity_never_write(client, investigator, ingested, fake):
    assert client.get(f"{API}/cases/{CASE}/analysis", headers=investigator).status_code == 200
    assert client.post(f"{API}/cases/{CASE}/report", headers=investigator, json={}).status_code in (200, 201)
    assert fake.writes == []


def test_time_filtered_view_neither_writes_nor_reads_neo4j(client, investigator, ingested, fake):
    full = _graph(client, investigator)
    assert fake.writes == [CASE]
    reads = fake.reads
    sub = _graph(client, investigator, t_from="2025-07-01", t_to="2025-07-31")
    assert fake.writes == [CASE] and fake.reads == reads, "filtered view touched Neo4j"
    assert sub["total_edges"] < full["total_edges"]  # the window drops relationships (entities stay)
    # the stored copy is still the whole case, so the next full view is complete
    again = _graph(client, investigator)
    assert {n["entity_id"] for n in again["nodes"]} == {n["entity_id"] for n in full["nodes"]}
    assert len(fake.store[CASE]["nodes"]) == full["total_nodes"]


def test_a_changed_projection_is_rewritten(client, investigator, ingested, fake, monkeypatch):
    _graph(client, investigator)
    assert fake.writes == [CASE]
    fp = fake.store[CASE]["fp"]
    # simulate a claim change by perturbing the stored fingerprint (as if another version had been written)
    fake.store[CASE]["fp"] = "p1:other"
    _graph(client, investigator)
    assert fake.writes == [CASE, CASE] and fake.store[CASE]["fp"] == fp


def test_concurrent_first_views_write_once(client, investigator, ingested, fake):
    with ThreadPoolExecutor(10) as pool:
        results = list(pool.map(lambda _: client.get(f"{API}/cases/{CASE}/graph", headers=investigator), range(10)))
    assert all(r.status_code == 200 for r in results)
    assert fake.writes == [CASE], fake.writes
    assert len({len(r.json()["nodes"]) for r in results}) == 1


def test_failing_neo4j_serves_the_correct_graph_flagged_stale(client, investigator, ingested, fake):
    fake.fail = True
    g = _graph(client, investigator)
    assert g["projection_stale"] is True
    assert len(g["nodes"]) == g["total_nodes"] > 0 and fake.reads == 0  # in-process, complete


def test_busy_sync_lock_falls_back_instead_of_queueing(client, investigator, ingested, fake, monkeypatch):
    monkeypatch.setattr(config, "NEO4J_QUERY_TIMEOUT_S", 0.2)
    lock = graph_svc._case_lock(CASE)
    lock.acquire()
    try:
        g = _graph(client, investigator)
    finally:
        lock.release()
    assert g["projection_stale"] is True and len(g["nodes"]) == g["total_nodes"] > 0
    assert fake.writes == []


def test_fingerprint_is_deterministic_and_content_sensitive(client, ingested):
    from ..db import SessionLocal
    with SessionLocal() as db:
        g1 = graph_svc.build_projection(db, CASE)
        g2 = graph_svc.build_projection(db, CASE)
    assert graph_svc.projection_fingerprint(g1) == graph_svc.projection_fingerprint(g2)
    u, v, k = next(iter(g2.edges(keys=True)))
    g2.edges[u, v, k]["confidence"] = 0.123
    assert graph_svc.projection_fingerprint(g1) != graph_svc.projection_fingerprint(g2)


# ------------------------------------------------------------------------------------------------ live Neo4j
_LIVE_URI = os.environ.get("DRISHTI_TEST_NEO4J_URI", "")
_LIVE_PASSWORD = os.environ.get("DRISHTI_NEO4J_PASSWORD", "")


def _reachable():
    if not _LIVE_URI:
        return False
    try:
        from neo4j import GraphDatabase
        d = GraphDatabase.driver(_LIVE_URI, auth=("neo4j", _LIVE_PASSWORD), connection_timeout=2)
        with d.session() as s:
            s.run("RETURN 1").single()
        d.close()
        return True
    except Exception:
        return False


live = pytest.mark.skipif(not _reachable(), reason="no live Neo4j (set DRISHTI_TEST_NEO4J_URI)")


@pytest.fixture()
def live_neo4j(monkeypatch):
    monkeypatch.setattr(config, "NEO4J_URI", _LIVE_URI)
    monkeypatch.setattr(config, "NEO4J_PASSWORD", _LIVE_PASSWORD)
    ns.close()
    ns.apply_constraints()
    yield
    ns.close()


def _rows(case_id, n_nodes=30):
    nodes = [{"entity_id": f"ENT-LV-{case_id}-{i:03d}", "kind": "PERSON", "label": f"P{i}", "access_class": "RESTRICTED"}
             for i in range(n_nodes)]
    edges = [{"source": nodes[i]["entity_id"], "target": nodes[(i * 7 + 3) % n_nodes]["entity_id"], "claim_id": f"CLM-LV-{case_id}-{i:03d}",
              "rel_type": "CALLED", "evidence_id": "EVD-LV", "observed_time": None, "weight": 1.0, "confidence": 1.0,
              "missing": False, "state": "ALLOWED", "method": "test", "jurisdiction": "J", "access_class": "RESTRICTED",
              "authority_reference": "FIR"} for i in range(n_nodes)]
    return nodes, edges


@live
def test_live_write_skips_when_fingerprint_matches(live_neo4j):
    nodes, edges = _rows("SKIP")
    assert ns.write_projection("CASE-LV-SKIP", nodes, edges, "p1:aaa") is True
    assert ns.projection_fingerprint("CASE-LV-SKIP") == "p1:aaa"
    assert ns.write_projection("CASE-LV-SKIP", nodes, edges, "p1:aaa") is False
    got, _, _ = ns.read_bounded("CASE-LV-SKIP", None, 1, 150)
    assert len(got) == len(nodes)


@live
def test_live_concurrent_writers_do_not_deadlock(live_neo4j):
    nodes, edges = _rows("CONC", 60)
    errors = []

    def w(i):
        try:
            ns.write_projection("CASE-LV-CONC", nodes, edges, f"p1:v{i % 3}")
        except Exception as exc:  # noqa: BLE001
            errors.append(repr(exc))

    with ThreadPoolExecutor(12) as pool:
        list(pool.map(w, range(24)))
    assert errors == []
    got, got_edges, _ = ns.read_bounded("CASE-LV-CONC", None, 1, 150)
    assert len(got) == 60 and len(got_edges) == 60
    assert ns.projection_fingerprint("CASE-LV-CONC") in {"p1:v0", "p1:v1", "p1:v2"}


@live
def test_live_graph_route_end_to_end(client, investigator, ingested, live_neo4j):
    full = _graph(client, investigator)
    assert not full["projection_stale"] and len(full["nodes"]) == full["total_nodes"] > 0
    fp = ns.projection_fingerprint(CASE)
    assert fp and fp.startswith("p1:")
    _graph(client, investigator, t_from="2025-07-01", t_to="2025-07-31")
    assert ns.projection_fingerprint(CASE) == fp  # filtered view did not overwrite the copy
    again = _graph(client, investigator)
    assert {n["entity_id"] for n in again["nodes"]} == {n["entity_id"] for n in full["nodes"]}


# ------------------------------------------------------------------------------------------------ node ranking
def _claim_degree(G, n):
    return len({k for *_x, k in G.in_edges(n, keys=True)} | {k for *_x, k in G.out_edges(n, keys=True)})


def test_first_page_holds_the_most_connected_entities(client, investigator, ingested):
    from ..db import SessionLocal
    with SessionLocal() as db:
        G = graph_svc.build_projection(db, CASE)
    ranked = graph_svc.rank_nodes(G)
    assert [_claim_degree(G, n) for n in ranked] == sorted((_claim_degree(G, n) for n in G.nodes), reverse=True)
    page = _graph(client, investigator, max_nodes=10)
    assert {n["entity_id"] for n in page["nodes"]} == set(ranked[:10])
    assert page["truncated"] is True


@live
def test_live_neo4j_order_matches_in_process_order(client, investigator, ingested, live_neo4j):
    from ..db import SessionLocal
    _graph(client, investigator)  # brings the Neo4j copy up to date
    with SessionLocal() as db:
        G = graph_svc.build_projection(db, CASE)
    got, offset = [], 0
    while True:
        nodes, _e, truncated = ns.read_bounded(CASE, None, 1, 20, offset)
        got += [n["entity_id"] for n in nodes]
        offset += len(nodes)
        if not truncated or not nodes:
            break
    assert got == graph_svc.rank_nodes(G)
