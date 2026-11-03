"""Workflow tests deleted in commit 61e3437 ("Final infrastructure fixes and NLP resolution") while docs/status.md
kept citing them as evidence. Restored verbatim from 61e3437^ on 2026-11-01 (session 4 re-verification, DEF-051)."""
import csv
import io


def _cands(client, h):
    return client.get("/api/v1/cases/CASE-0001/candidates", headers=h).json()


def _find(cands, left, right):
    for m in cands:
        if {m["left"]["label"], m["right"]["label"]} == {left, right}:
            return m
    raise AssertionError(f"no candidate {left} / {right}")


def test_contradiction_is_flagged_not_hidden(client, investigator, ingested):
    cs = client.get("/api/v1/cases/CASE-0001/contradictions", headers=investigator).json()
    assert len(cs) == 2 and {c["original_value"] for c in cs} == {"Kavya Iyer", "Rohan Deshpande"}
    assert {c["evidence"]["filename"] for c in cs} == {"vehicles.csv", "fir_001.pdf"}
    g = client.get("/api/v1/cases/CASE-0001/graph?max_nodes=150", headers=investigator).json()
    veh = [n for n in g["nodes"] if n["kind"] == "VEHICLE" and n["flags"].get("contradictory")]
    assert veh and len(veh[0]["flags"]["contradictions"]) == 2


def test_graph_is_bounded_and_edges_trace_to_source(client, investigator, ingested):
    g = client.get("/api/v1/cases/CASE-0001/graph?hops=99&max_nodes=99999", headers=investigator).json()
    assert g["bounds"]["hops"] <= 2 and g["bounds"]["max_nodes"] <= 150 and g["masked"] is True
    g_small = client.get("/api/v1/cases/CASE-0001/graph?max_nodes=10", headers=investigator).json()
    assert len(g_small["nodes"]) == 10 and g_small["truncated"] is True
    # every edge carries the snapshot_id of the exact bounded view it came from; the same view
    # requested twice yields identical edge snapshot_ids, a smaller bounded view (fewer nodes/edges
    # kept) yields a different one
    assert g["edges"] and all(x["snapshot_id"] == g["snapshot_hash"] for x in g["edges"])
    g_again = client.get("/api/v1/cases/CASE-0001/graph?hops=99&max_nodes=99999", headers=investigator).json()
    assert g_again["snapshot_hash"] == g["snapshot_hash"]
    assert g_small["edges"] and g_small["edges"][0]["snapshot_id"] != g["edges"][0]["snapshot_id"]
    e = next(x for x in g["edges"] if x["rel_type"] == "CALLED")
    d = client.get(f"/api/v1/cases/CASE-0001/edge?source={e['source']}&target={e['target']}&rel_type=CALLED", headers=investigator).json()
    c = d["claims"][0]
    loc = c["provenance"][0]["locator"]
    ctx = client.get(f"/api/v1/evidence/{c['evidence']['evidence_id']}/context?row={loc['row']}", headers=investigator).json()
    assert ctx["hash_match"] is True and any(l["hit"] and l["n"] == loc["row"] for l in ctx["lines"])
    assert ctx["filename"] == "calls.csv"
    # historical vs current relevance
    hist = [x for x in g["edges"] if x["relevance"] == "HISTORICAL"]
    assert hist and hist[0]["last_seen"].startswith("2019") and hist[0]["decay_score"] < 0.05
    assert any(x["relevance"] == "CURRENT" for x in g["edges"])
    # centred, one-hop exploration
    centre = e["source"]
    g1 = client.get(f"/api/v1/cases/CASE-0001/graph?center={centre}&hops=1", headers=investigator).json()
    assert centre in {n["entity_id"] for n in g1["nodes"]} and len(g1["nodes"]) < len(g["nodes"])


def test_supernode_capping_on_a_planted_high_degree_node(client, investigator):
    """docs/context.md §17.2 requires the golden dataset to include 'one high-degree supernode' among
    its planted scenarios, so the supernode-capping code path (config.SUPERNODE_DEGREE,
    graph.py::bounded_subgraph's neighbourhood-fan-out cap) has real test coverage -- it had none: no
    test in this repository exercised it, and the actual golden dataset (data/synthetic/) plants no node
    anywhere near that degree (checked directly: 0 nodes ever get flags.supernode on CASE-0001/0002).
    Rather than risk regenerating the shared golden dataset (breaking the many other tests coupled to
    its exact counts), this plants an isolated hub-and-spoke call pattern in its own dedicated case.
    """
    case = client.post("/api/v1/cases", headers=investigator, json={
        "case_id": "CASE-SUPERNODE", "title": "supernode capping test", "jurisdiction": "Demo District A",
        "purpose": "test", "authority_reference": "FIR-TEST-SUPERNODE",
    })
    assert case.status_code == 201, case.text

    hub = "+91 90000 09999"
    spoke_n = 20  # comfortably above config.SUPERNODE_DEGREE (12)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["caller", "callee", "start_time", "duration_sec"])  # no cell_id: keep this a pure CALLED fan-out, one neighbour per spoke
    for i in range(spoke_n):
        w.writerow([hub, f"+91 90000 08{i:03d}", f"2025-08-01T{10 + i % 12:02d}:00:00", "60"])
    r = client.post("/api/v1/cases/CASE-SUPERNODE/evidence", headers=investigator,
                     files={"file": ("hub_calls.csv", buf.getvalue().encode())}, data={"source_label": "supernode-test"})
    assert r.status_code == 201, r.text

    g = client.get("/api/v1/cases/CASE-SUPERNODE/graph?max_nodes=150", headers=investigator).json()
    # PHONE is a masked kind (services/masking.py) -- the hub's label comes back masked in this
    # response, so find it by degree (unambiguous: every spoke has degree 1, only the hub has spoke_n)
    hub_node = max(g["nodes"], key=lambda n: n["degree"])
    assert hub_node["degree"] == spoke_n
    assert hub_node["flags"]["supernode"] is True and "capped" in hub_node["flags"]["supernode_note"]

    # centered, one-hop exploration must cap fan-out at config.SUPERNODE_DEGREE, not return every spoke
    centered = client.get(f"/api/v1/cases/CASE-SUPERNODE/graph?center={hub_node['entity_id']}&hops=1&max_nodes=150", headers=investigator).json()
    kept_spokes = [n for n in centered["nodes"] if n["entity_id"] != hub_node["entity_id"]]
    assert len(kept_spokes) <= g["bounds"]["supernode_degree"]
    assert centered["truncated"] is True


def test_graph_pagination_pages_through_the_full_uncentered_node_listing(client, investigator, ingested):
    """docs/status.md Role 5 backlog item: graph query pagination. Only meaningful when `center` is
    unset (a centered hop-bounded traversal has no stable total order to page through, see
    bounded_subgraph's docstring) -- paging through the uncentered top-level node listing must reach
    every node exactly once, with no gaps or duplicates, and terminate (next_offset becomes null)."""
    g_all = client.get("/api/v1/cases/CASE-0001/graph?hops=99&max_nodes=99999", headers=investigator).json()
    total = len(g_all["nodes"])
    assert total > 10  # otherwise this test can't actually exercise more than one page

    seen: set[str] = set()
    offset = 0
    pages = 0
    while True:
        page = client.get(f"/api/v1/cases/CASE-0001/graph?max_nodes=10&offset={offset}", headers=investigator).json()
        assert page["offset"] == offset
        ids = {n["entity_id"] for n in page["nodes"]}
        assert not (ids & seen), "pagination must not repeat a node across pages"
        seen |= ids
        pages += 1
        assert pages <= total // 10 + 2, "pagination did not terminate"
        if page["next_offset"] is None:
            assert page["truncated"] is False
            break
        assert page["truncated"] is True
        offset = page["next_offset"]
    assert seen == {n["entity_id"] for n in g_all["nodes"]}
    assert pages > 1  # actually exercised more than one page

    # centered exploration ignores offset rather than silently misbehaving (no stable order to page)
    centre = g_all["edges"][0]["source"]
    c1 = client.get(f"/api/v1/cases/CASE-0001/graph?center={centre}&hops=1&offset=0", headers=investigator).json()
    c2 = client.get(f"/api/v1/cases/CASE-0001/graph?center={centre}&hops=1&offset=5", headers=investigator).json()
    assert {n["entity_id"] for n in c1["nodes"]} == {n["entity_id"] for n in c2["nodes"]}


def test_graph_pagination_rejects_negative_offset(client, investigator, ingested):
    r = client.get("/api/v1/cases/CASE-0001/graph?offset=-1", headers=investigator)
    assert r.status_code == 422


def test_graph_edges_carry_jurisdiction_access_class_authority_reference(client, investigator, ingested):
    """docs/context.md §10.3 requires jurisdiction/authority_reference/access_class on every graph edge,
    not just every node. Every edge in CASE-0001 is built from claims whose evidence all mirrors the
    same case, so every edge should show that case's own governance values and never be flagged mixed."""
    case = client.get("/api/v1/cases/CASE-0001", headers=investigator).json()
    assert case["authority_reference"] == "FIR-DEMO-001"
    g = client.get("/api/v1/cases/CASE-0001/graph?hops=99&max_nodes=99999", headers=investigator).json()
    assert g["edges"]
    for e in g["edges"]:
        assert e["jurisdiction"] == case["jurisdiction"]
        assert e["access_class"] == case["sensitivity"]  # Evidence.access_class mirrors Case.sensitivity
        assert e["authority_reference"] == "FIR-DEMO-001"
        assert e["governance_mixed"] is False
    ev = ingested["calls.csv"]
    assert ev["jurisdiction"] == case["jurisdiction"] and ev["authority_reference"] == "FIR-DEMO-001"
    assert ev["access_class"] == case["sensitivity"]


def test_locations_endpoint_returns_coordinates_for_map_view(client, investigator, ingested):
    """docs/status.md Role 2 backlog item: map view over location entities. LOCATION entities that
    appear in this case's approved claims come back with parsed lat/lon (or has_coords: false, never
    silently dropped, if a row somehow lacks them)."""
    r = client.get("/api/v1/cases/CASE-0001/locations", headers=investigator)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["case_id"] == "CASE-0001"
    assert len(body["locations"]) >= 5  # locations.csv plants 5 named sites for this case
    with_coords = [l for l in body["locations"] if l["has_coords"]]
    assert with_coords, "at least the locations.csv-sourced sites must carry real lat/lon"
    for loc in with_coords:
        assert isinstance(loc["lat"], float) and isinstance(loc["lon"], float)
    names = {l["label"] for l in body["locations"]}
    assert "Ghat Road Tower" in names or "TWR-A-01" in names


def test_locations_endpoint_denies_unassigned_user(client, unassigned, ingested):
    r = client.get("/api/v1/cases/CASE-0001/locations", headers=unassigned)
    assert r.status_code == 403


def test_analysis_uses_neutral_language(client, investigator, ingested):
    a = client.get("/api/v1/cases/CASE-0001/analysis", headers=investigator).json()
    assert a["bridge_candidates"] and "candidate bridge" in a["bridge_candidates"][0]["note"]
    assert len(a["communities"]) >= 3
    assert all(isinstance(c["stability"], float) and 0.0 <= c["stability"] <= 1.0 and c["stability_note"] for c in a["communities"])
    assert {r["rule"] for r in a["rules"]} == {"communication_burst", "transaction_fan_in"}
    text = str(a).lower()
    for banned in ("kingpin", "criminal", "guilty", "threat score", "suspect"):
        assert banned not in text


def test_timeline_filters_and_cross_case(client, investigator, ingested, unassigned):
    t = client.get("/api/v1/cases/CASE-0001/timeline?t_to=2020-01-01", headers=investigator).json()
    assert t["count"] == 8 and all(e["relevance"] == "HISTORICAL" for e in t["events"])
    t2 = client.get("/api/v1/cases/CASE-0001/timeline?t_from=2025-07-02&t_to=2025-07-03", headers=investigator).json()
    assert t2["count"] >= 12
    # the bridge candidate's account appears in CASE-0002 as well; visibility is access-filtered
    g = client.get("/api/v1/cases/CASE-0001/graph?max_nodes=150", headers=investigator).json()
    acct = next(n for n in g["nodes"] if n["kind"] == "ACCOUNT" and n["label"].endswith("01") and "0901" in n["entity_id"] or n["label"] == "ACC-DEMO-••01")
    e = client.get(f"/api/v1/entities/{acct['entity_id']}?case_id=CASE-0001", headers=investigator).json()
    assert e["cross_case"]["total_cases"] >= 1
