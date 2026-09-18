"""Rebuildable POLE+ graph projection. Builds the projection from Postgres claims, then — whenever
DRISHTI_NEO4J_URI is set — writes it into real Neo4j and serves bounded queries from there via
services/neo4j_store.py (parameterized Cypher, never string-built). With no Neo4j configured, an
equivalent in-process graph covers the zero-install dev/test loop (same pattern as SQLite for Postgres).
NetworkX remains only as a local analysis library for degree/betweenness/community detection on an
already-bounded result set — Neo4j Community has no built-in graph algorithms without the GDS plugin.

Only claims in state ALLOWED or APPROVE enter the projection. Approved identity matches contract two
entity nodes into one; rejected/deferred/pending matches never merge (pending/deferred ones are shown as
dashed POSSIBLE_SAME_AS candidate edges). Contradictory attribute claims flag the node, and history is
never deleted: temporal decay only changes *relevance*.
"""
from __future__ import annotations

import hashlib
import json
import math
import random
from collections import defaultdict
from datetime import datetime, timedelta

import networkx as nx
from sqlalchemy.orm import Session

from .. import config
from ..models import Claim, Entity, Evidence, MatchCandidate
from . import neo4j_store

HISTORICAL_AFTER_DAYS = 365
HALF_LIFE_DAYS = 180


def _parse_time(s: str | None) -> datetime | None:
    if not s:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


# ----------------------------------------------------------------------------- union-find for approved matches
def approved_merges(db: Session, case_id: str) -> dict[str, str]:
    parent: dict[str, str] = {}

    def find(x):
        parent.setdefault(x, x)
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for m in db.query(MatchCandidate).filter_by(case_id=case_id, state="APPROVE").all():
        ra, rb = find(m.left_entity_id), find(m.right_entity_id)
        if ra != rb:
            parent[rb] = ra
    return {x: find(x) for x in list(parent)}


# ----------------------------------------------------------------------------- projection
def build_projection(db: Session, case_id: str, t_from: datetime | None = None, t_to: datetime | None = None, include_case_node: bool = False) -> nx.MultiDiGraph:
    merges = approved_merges(db, case_id)
    claims = db.query(Claim).filter(Claim.case_id == case_id, Claim.state.in_(["ALLOWED", "APPROVE", "CONTRADICTORY"])).all()
    if not include_case_node:  # the CASE hub links every person and would dominate degree/betweenness
        claims = [c for c in claims if c.rel_type not in ("APPEARS_IN", "NAMED_IN")]
    ent_ids = {c.source_entity_id for c in claims} | {c.target_entity_id for c in claims if c.target_entity_id}
    ents = {e.entity_id: e for e in db.query(Entity).filter(Entity.entity_id.in_(ent_ids)).all()} if ent_ids else {}
    # docs/context.md §10.3 requires jurisdiction/authority_reference/access_class on every edge, not
    # just every node. Each claim carries these via its own evidence's governance snapshot (mirrored at
    # upload time, Phase 11) -- fetched here once per evidence_id rather than per claim.
    evd_ids = {c.evidence_id for c in claims}
    evds = {e.evidence_id: e for e in db.query(Evidence).filter(Evidence.evidence_id.in_(evd_ids)).all()} if evd_ids else {}

    G = nx.MultiDiGraph(case_id=case_id)

    def rep(eid: str) -> str:
        r = merges.get(eid, eid)
        # prefer a registry-backed (pid:) entity as representative label
        return r

    def ensure_node(eid: str):
        r = rep(eid)
        e = ents.get(eid)
        if r not in G:
            base = ents.get(r, e)
            case_attrs = (base.attributes or {}).get(case_id, {}) if isinstance(base.attributes, dict) and case_id in (base.attributes or {}) else (base.attributes or {})
            G.add_node(r, entity_id=r, kind=base.kind, label=base.label, merged_from=[], attributes=case_attrs,
                       access_class=base.access_class, flags={})
        if r != eid and e is not None and e.label not in G.nodes[r]["merged_from"] and e.label != G.nodes[r]["label"]:
            G.nodes[r]["merged_from"].append(e.label)
        return r

    for c in claims:
        if c.kind == "ATTRIBUTE":
            n = ensure_node(c.source_entity_id)
            if c.state == "CONTRADICTORY":
                G.nodes[n]["flags"]["contradictory"] = True
                G.nodes[n]["flags"].setdefault("contradictions", []).append({"attribute": c.attribute, "value": c.original_value, "claim_id": c.claim_id, "evidence_id": c.evidence_id})
            continue
        if c.kind != "RELATIONSHIP" or not c.target_entity_id:
            ensure_node(c.source_entity_id)
            continue
        if c.state == "CONTRADICTORY":
            continue
        t = _parse_time(c.observed_time)
        if t_from and t and t < t_from:
            continue
        if t_to and t and t > t_to:
            continue
        s, d = ensure_node(c.source_entity_id), ensure_node(c.target_entity_id)
        evd = evds.get(c.evidence_id)
        G.add_edge(s, d, key=c.claim_id, rel_type=c.rel_type, claim_id=c.claim_id, evidence_id=c.evidence_id,
                   observed_time=c.observed_time, weight=c.weight or 1.0, confidence=c.confidence,
                   missing=bool(c.missingness), state=c.state, method=c.method,
                   jurisdiction=evd.jurisdiction if evd else None, access_class=evd.access_class if evd else None,
                   authority_reference=evd.authority_reference if evd else None)
    if neo4j_store.available():
        _sync_to_neo4j(case_id, G)
    return G


def _sync_to_neo4j(case_id: str, G: nx.MultiDiGraph) -> None:
    """Write the projection just built from Postgres claims into real Neo4j (parameterized Cypher).
    Rebuildable: re-running this from the same claims always converges to the same graph.
    """
    nodes = [{"entity_id": n, "kind": d["kind"], "label": d["label"], "access_class": d["access_class"]}
              for n, d in G.nodes(data=True)]
    edges = [{"source": u, "target": v, "claim_id": d["claim_id"], "rel_type": d["rel_type"], "evidence_id": d["evidence_id"],
              "observed_time": d.get("observed_time"), "weight": d.get("weight"), "confidence": d.get("confidence"),
              "missing": d.get("missing"), "state": d.get("state"), "method": d.get("method"),
              "jurisdiction": d.get("jurisdiction"), "access_class": d.get("access_class"), "authority_reference": d.get("authority_reference")}
             for u, v, d in G.edges(data=True)]
    neo4j_store.write_projection(case_id, nodes, edges)


GOVERNANCE_SET_KEYS = {"jurisdiction": "jurisdictions", "access_class": "access_classes", "authority_reference": "authority_references"}


def aggregate(G: nx.MultiDiGraph, reference: datetime | None = None) -> tuple[list[dict], list[dict], datetime | None]:
    """Collapse parallel edges into one summary edge per (source, target, rel_type)."""
    if reference is None:
        times = [_parse_time(d.get("observed_time")) for _, _, d in G.edges(data=True)]
        times = [t for t in times if t]
        reference = max(times) if times else None
    agg: dict[tuple[str, str, str], dict] = {}
    for u, v, d in G.edges(data=True):
        key = (u, v, d["rel_type"])
        a = agg.setdefault(key, {"source": u, "target": v, "rel_type": d["rel_type"], "count": 0, "weight": 0.0, "first_seen": None,
                                 "last_seen": None, "claim_ids": [], "evidence_ids": set(), "min_confidence": 1.0, "missing_count": 0, "methods": set(),
                                 "_governance_seen_at": None, **{set_key: set() for set_key in GOVERNANCE_SET_KEYS.values()}})
        a["count"] += 1
        a["weight"] += d.get("weight") or 0
        a["min_confidence"] = min(a["min_confidence"], d.get("confidence", 1.0))
        a["missing_count"] += 1 if d.get("missing") else 0
        a["methods"].add(d.get("method"))
        if len(a["claim_ids"]) < 50:
            a["claim_ids"].append(d["claim_id"])
        a["evidence_ids"].add(d["evidence_id"])
        for field, set_key in GOVERNANCE_SET_KEYS.items():
            if d.get(field) is not None:
                a[set_key].add(d[field])
        t = d.get("observed_time")
        if t:
            a["first_seen"] = t if a["first_seen"] is None or t < a["first_seen"] else a["first_seen"]
            a["last_seen"] = t if a["last_seen"] is None or t > a["last_seen"] else a["last_seen"]
        # Governance fields (jurisdiction/access_class/authority_reference) are per-evidence, and in
        # normal operation identical across every claim in a case (there is no case-edit endpoint that
        # would let them diverge mid-case). Where they DO differ across the claims collapsed into this
        # one summary edge, take the most recently observed one -- same recency rule as last_seen --
        # rather than picking arbitrarily.
        t_key = t or ""
        if a["_governance_seen_at"] is None or t_key >= a["_governance_seen_at"]:
            a["_governance_seen_at"] = t_key
            a["jurisdiction"], a["access_class"], a["authority_reference"] = d.get("jurisdiction"), d.get("access_class"), d.get("authority_reference")
    edges = []
    for a in agg.values():
        a.pop("_governance_seen_at", None)
        mixed_flags = [len(a.pop(set_key)) > 1 for set_key in GOVERNANCE_SET_KEYS.values()]
        a["governance_mixed"] = any(mixed_flags)
        last = _parse_time(a["last_seen"])
        if reference and last:
            age = (reference - last).days
            a["relevance"] = "HISTORICAL" if age > HISTORICAL_AFTER_DAYS else "CURRENT"
            a["decay_score"] = round(math.exp(-max(age, 0) * math.log(2) / HALF_LIFE_DAYS), 3)
            a["age_days"] = age
        else:
            a["relevance"], a["decay_score"], a["age_days"] = "UNDATED", None, None
        a["evidence_ids"] = sorted(a["evidence_ids"])
        a["methods"] = sorted(m for m in a["methods"] if m)
        a["weight"] = round(a["weight"], 2)
        edges.append(a)
    nodes = []
    U = G.to_undirected(as_view=True)
    deg = {n: len(set(U.neighbors(n))) for n in G.nodes}  # unique neighbours, not parallel edges
    for n, d in G.nodes(data=True):
        nd = dict(d)
        nd["degree"] = deg.get(n, 0)
        if nd["degree"] >= config.SUPERNODE_DEGREE:
            nd["flags"] = {**nd.get("flags", {}), "supernode": True, "supernode_note": f"degree {nd['degree']} ≥ {config.SUPERNODE_DEGREE}; neighbourhood expansion is capped"}
        nodes.append(nd)
    return nodes, edges, reference


def candidate_edges(db: Session, case_id: str, merges: dict[str, str]) -> list[dict]:
    out = []
    for m in db.query(MatchCandidate).filter(MatchCandidate.case_id == case_id, MatchCandidate.state.in_(["REVIEW_REQUIRED", "DEFER", "STALE"])).all():
        out.append({"source": merges.get(m.left_entity_id, m.left_entity_id), "target": merges.get(m.right_entity_id, m.right_entity_id),
                    "rel_type": "POSSIBLE_SAME_AS", "state": m.state, "candidate_id": m.candidate_id, "confidence": m.confidence, "count": 1, "relevance": "CANDIDATE"})
    return out


# ----------------------------------------------------------------------------- bounded exploration
def bounded_subgraph(G: nx.MultiDiGraph, case_id: str, center: str | None, hops: int, max_nodes: int, offset: int = 0) -> tuple[set[str], bool]:
    """The bounded traversal itself runs as a parameterized Cypher query against Neo4j when configured
    (services/neo4j_store.read_bounded) — the browser never gets unrestricted graph access either way.
    Falls back to an equivalent in-process traversal only when no Neo4j is configured for this deployment.

    `offset` pages through the node listing when `center` is None -- see the docstring on
    neo4j_store.read_bounded for why a centered hop-bounded traversal can't be paged the same way.
    """
    offset = max(0, offset)
    if neo4j_store.available():
        nodes, _edges, truncated = neo4j_store.read_bounded(case_id, center, hops, max_nodes, offset)
        return {n["entity_id"] for n in nodes}, truncated
    hops = max(1, min(hops, config.GRAPH_MAX_HOPS))
    max_nodes = max(5, min(max_nodes, config.GRAPH_MAX_NODES))
    U = G.to_undirected(as_view=True)
    udeg = lambda n: len(set(U.neighbors(n)))
    if center is None or center not in G:
        ranked = sorted(G.nodes, key=lambda n: -udeg(n))
        page = ranked[offset:offset + max_nodes]
        keep = set(page)
        return keep, offset + len(page) < len(ranked)
    keep = {center}
    frontier = [center]
    truncated = False
    for _ in range(hops):
        nxt = []
        for n in frontier:
            neighbours = sorted(set(U.neighbors(n)), key=lambda x: -udeg(x))
            if udeg(n) >= config.SUPERNODE_DEGREE:
                neighbours = neighbours[:config.SUPERNODE_DEGREE]  # cap supernode fan-out
                truncated = True
            for m in neighbours:
                if m not in keep:
                    if len(keep) >= max_nodes:
                        truncated = True
                        break
                    keep.add(m)
                    nxt.append(m)
        frontier = nxt
    return keep, truncated


def _community_stability(core: nx.Graph, communities: list[set], trials: int = 20, drop_frac: float = 0.15, seed: int = 42) -> list[float]:
    """Bootstrap-style robustness check for greedy_modularity_communities, which is itself deterministic
    -- rerunning it on the exact same graph would trivially "stabilise" at 1.0 every time and say nothing
    real. Instead this reruns detection `trials` times on the core subgraph with a random `drop_frac`
    fraction of its edges removed each time, and scores each original community by the best Jaccard
    overlap it finds among that trial's communities, averaged across trials. A community whose membership
    barely changes when a chunk of the underlying evidence is held out deserves more weight than one that
    only appears because of a handful of edges; this makes that distinction visible instead of presenting
    every community as equally solid. Seeded for reproducibility (tests assert on the resulting numbers).
    """
    if not communities:
        return []
    edges = list(core.edges())
    if not edges:
        return [1.0 for _ in communities]
    rng = random.Random(seed)
    n_drop = max(1, min(len(edges), int(len(edges) * drop_frac)))
    scores = [[] for _ in communities]
    for _ in range(trials):
        dropped_idx = set(rng.sample(range(len(edges)), n_drop))
        H = core.copy()
        H.remove_edges_from(edges[i] for i in dropped_idx)
        H.remove_nodes_from([n for n in list(H.nodes) if H.degree(n) == 0])
        try:
            perturbed = [set(c) for c in nx.community.greedy_modularity_communities(H)] if H.number_of_edges() else []
        except Exception:
            perturbed = []
        for idx, orig in enumerate(communities):
            best = max((len(orig & p) / len(orig | p) for p in perturbed if orig | p), default=0.0)
            scores[idx].append(best)
    return [round(sum(s) / len(s), 3) if s else 1.0 for s in scores]


# ----------------------------------------------------------------------------- explainable analysis
def analyze(G: nx.MultiDiGraph) -> dict:
    U = nx.Graph()
    for u, v, d in G.edges(data=True):
        if u == v:
            continue
        if U.has_edge(u, v):
            U[u][v]["weight"] += 1
        else:
            U.add_edge(u, v, weight=1)
    for n in G.nodes:
        U.add_node(n)
    labels = {n: G.nodes[n]["label"] for n in G.nodes}
    kinds = {n: G.nodes[n]["kind"] for n in G.nodes}

    degree = sorted(({"entity_id": n, "label": labels[n], "kind": kinds[n], "degree": d} for n, d in U.degree()), key=lambda x: -x["degree"])[:10]
    weighted = sorted(({"entity_id": n, "label": labels[n], "kind": kinds[n], "weighted_degree": d} for n, d in U.degree(weight="weight")), key=lambda x: -x["weighted_degree"])[:10]

    # bridge candidates: betweenness on person/phone/account/org subgraph (structural, neutral language)
    core = U.subgraph([n for n in U if kinds[n] in ("PERSON", "PHONE", "ACCOUNT", "ORGANIZATION", "VEHICLE")]).copy()
    bet = nx.betweenness_centrality(core, normalized=True) if core.number_of_nodes() > 2 else {}
    bridges = sorted(({"entity_id": n, "label": labels[n], "kind": kinds[n], "betweenness": round(b, 4)} for n, b in bet.items()), key=lambda x: -x["betweenness"])[:5]

    communities = []
    comm_sets: list[set] = []
    if core.number_of_edges() > 0:
        try:
            for i, comm in enumerate(nx.community.greedy_modularity_communities(core)):
                comm_sets.append(set(comm))
                members = sorted(comm, key=lambda n: -core.degree(n))
                communities.append({"community_id": f"C{i+1}", "size": len(members), "members": [{"entity_id": n, "label": labels[n], "kind": kinds[n]} for n in members[:12]]})
        except Exception as exc:  # community detection is best-effort
            communities = [{"error": str(exc)}]
    if comm_sets:
        for c, score in zip(communities, _community_stability(core, comm_sets)):
            c["stability"] = score
            c["stability_note"] = ("share of this community's membership that survives when a random 15% "
                                    "of this view's edges are removed, averaged over 20 trials — a robustness "
                                    "check against how much this grouping depends on exactly which evidence "
                                    "is present, not a confidence or accuracy percentage")
    # which community does each bridge candidate touch?
    comm_of = {m["entity_id"]: c["community_id"] for c in communities for m in c.get("members", [])}
    for b in bridges:
        touched = {comm_of.get(nb) for nb in U.neighbors(b["entity_id"]) if comm_of.get(nb)}
        b["touches_communities"] = sorted(touched)
        b["note"] = "candidate bridge / possible intermediary — structural observation only, not an accusation"

    return {"degree": degree, "weighted_degree": weighted, "bridge_candidates": bridges, "communities": communities,
            "rules": rule_candidates(G), "language_note": "All outputs are review priorities derived from the evidence approved for this case. They do not assert guilt, threat, or wrongdoing."}


def rule_candidates(G: nx.MultiDiGraph, burst_n: int = 8, burst_window_h: int = 2, fanin_k: int = 4, fanin_days: int = 3) -> list[dict]:
    out = []
    labels = {n: G.nodes[n]["label"] for n in G.nodes}
    # communication burst: ≥ burst_n CALLED edges between the same pair inside burst_window_h hours
    pair_times: dict[tuple[str, str], list[datetime]] = defaultdict(list)
    fanin: dict[str, list[tuple[datetime, str]]] = defaultdict(list)
    for u, v, d in G.edges(data=True):
        t = _parse_time(d.get("observed_time"))
        if not t:
            continue
        if d["rel_type"] == "CALLED":
            pair_times[(u, v)].append(t)
        elif d["rel_type"] == "TRANSFERRED_TO":
            fanin[v].append((t, u))
    for (u, v), times in pair_times.items():
        times.sort()
        for i in range(len(times)):
            j = i
            while j + 1 < len(times) and times[j + 1] - times[i] <= timedelta(hours=burst_window_h):
                j += 1
            if j - i + 1 >= burst_n:
                out.append({"rule": "communication_burst", "version": "1.0", "subject": labels[u], "object": labels[v], "source": u, "target": v,
                            "count": j - i + 1, "window_start": times[i].isoformat(sep=" "), "window_end": times[j].isoformat(sep=" "),
                            "explanation": f"{j-i+1} calls within {burst_window_h}h (threshold {burst_n})", "priority": "review"})
                break
    for v, items in fanin.items():
        items.sort()
        for i in range(len(items)):
            srcs = {items[i][1]}
            j = i
            while j + 1 < len(items) and items[j + 1][0] - items[i][0] <= timedelta(days=fanin_days):
                j += 1
                srcs.add(items[j][1])
            if len(srcs) >= fanin_k:
                out.append({"rule": "transaction_fan_in", "version": "1.0", "subject": labels[v], "target": v, "distinct_sources": len(srcs),
                            "sources": [labels[s] for s in sorted(srcs)], "window_start": items[i][0].isoformat(sep=" "), "window_end": items[j][0].isoformat(sep=" "),
                            "explanation": f"{len(srcs)} distinct source accounts within {fanin_days} days (threshold {fanin_k})", "priority": "review"})
                break
    return out


def snapshot_hash(nodes: list[dict], edges: list[dict]) -> str:
    payload = json.dumps({"nodes": sorted(n["entity_id"] for n in nodes),
                          "edges": sorted((e["source"], e["target"], e["rel_type"], e.get("count", 0)) for e in edges)}, sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()
