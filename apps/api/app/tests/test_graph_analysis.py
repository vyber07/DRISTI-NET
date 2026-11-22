"""Community stability score (TASK_BOARD.md Phase 10): greedy_modularity_communities is deterministic,
so rerunning it unchanged would trivially "stabilise" at 1.0 and say nothing real. _community_stability
instead reruns detection on the core subgraph with a random slice of its edges removed each trial and
scores each community by how much of its membership survives -- these tests prove that mechanic actually
discriminates between a genuinely robust grouping and a fragile one, not just returning a constant.
"""
import networkx as nx

from ..services.graph import _community_stability, aggregate


def test_aggregate_flags_governance_mixed_when_constituent_claims_disagree():
    """In normal operation every claim behind an edge shares one case's jurisdiction/access_class/
    authority_reference (no case-edit endpoint lets them diverge mid-case). aggregate() must still
    surface it -- not silently pick one -- on the rare/pathological case where they don't agree, and
    the most recently observed value wins (same recency rule the existing last_seen field already uses).
    """
    G = nx.MultiDiGraph()
    G.add_edge("A", "B", key="c1", rel_type="CALLED", claim_id="c1", evidence_id="e1", observed_time="2025-01-01T00:00:00",
               weight=1.0, confidence=1.0, missing=False, state="ALLOWED", method="structured-parser",
               jurisdiction="Demo District A", access_class="RESTRICTED", authority_reference="FIR-DEMO-001")
    G.add_edge("A", "B", key="c2", rel_type="CALLED", claim_id="c2", evidence_id="e2", observed_time="2025-06-01T00:00:00",
               weight=1.0, confidence=1.0, missing=False, state="ALLOWED", method="structured-parser",
               jurisdiction="Demo District B", access_class="SENSITIVE", authority_reference="FIR-DEMO-002")
    _nodes, edges, _ref = aggregate(G)
    e = edges[0]
    assert e["governance_mixed"] is True
    # most recently observed (2025-06-01) constituent wins, not the first one added
    assert e["jurisdiction"] == "Demo District B" and e["access_class"] == "SENSITIVE" and e["authority_reference"] == "FIR-DEMO-002"


def test_aggregate_governance_not_mixed_when_all_claims_agree():
    G = nx.MultiDiGraph()
    for i in range(3):
        G.add_edge("A", "B", key=f"c{i}", rel_type="CALLED", claim_id=f"c{i}", evidence_id=f"e{i}", observed_time="2025-01-01T00:00:00",
                   weight=1.0, confidence=1.0, missing=False, state="ALLOWED", method="structured-parser",
                   jurisdiction="Demo District A", access_class="RESTRICTED", authority_reference="FIR-DEMO-001")
    _nodes, edges, _ref = aggregate(G)
    e = edges[0]
    assert e["governance_mixed"] is False
    assert e["jurisdiction"] == "Demo District A" and e["access_class"] == "RESTRICTED" and e["authority_reference"] == "FIR-DEMO-001"


def test_dense_clique_is_far_more_stable_than_a_sparse_path():
    clique = nx.complete_graph(6)
    path = nx.path_graph(6)
    clique_score = _community_stability(clique, [set(clique.nodes)])[0]
    path_score = _community_stability(path, [set(path.nodes)])[0]
    assert clique_score == 1.0
    assert path_score < clique_score
    assert 0.0 <= path_score < 1.0


def test_deterministic_for_a_fixed_seed():
    g = nx.gnm_random_graph(12, 20, seed=7)
    comm = [set(range(6)), set(range(6, 12))]
    a = _community_stability(g, comm, seed=42)
    b = _community_stability(g, comm, seed=42)
    assert a == b


def test_no_communities_or_no_edges_does_not_crash():
    assert _community_stability(nx.Graph(), []) == []
    empty = nx.Graph()
    empty.add_nodes_from([1, 2, 3])
    assert _community_stability(empty, [{1, 2, 3}]) == [1.0]
