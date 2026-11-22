"""Pure graph analytics functions — no database session, no storage, no neo4j_store.

All functions here accept an already-built ``nx.MultiDiGraph`` (or ``nx.Graph`` for the
community stability helper) and return plain Python structures.  They can be unit-tested
without a database fixture or any infrastructure dependency.

Extracted from services/graph.py (Stage 4, 2026-11-06).
"""
from __future__ import annotations

import hashlib
import json
import math
import random
from collections import defaultdict
from datetime import datetime, timedelta
from typing import TYPE_CHECKING

import networkx as nx

if TYPE_CHECKING:
    pass

from .. import config

# ------------------------------------------------------------------------------- constants

HISTORICAL_AFTER_DAYS = 365
HALF_LIFE_DAYS = 180
GOVERNANCE_SET_KEYS = {
    "jurisdiction": "jurisdictions",
    "access_class": "access_classes",
    "authority_reference": "authority_references",
}


# ------------------------------------------------------------------------------- time parsing

def _parse_time(s: str | None) -> datetime | None:
    if not s:
        return None
    # DEF-087: also the ISO 'T' forms a browser datetime-local input sends. Values carrying a zone
    # are not accepted anywhere (stored times are recorded without one), so they fall through to None.
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M", "%Y-%m-%d %H:%M"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


# ------------------------------------------------------------------------------- edge aggregation

def aggregate(
    G: nx.MultiDiGraph, reference: datetime | None = None
) -> tuple[list[dict], list[dict], datetime | None]:
    """Collapse parallel edges into one summary edge per (source, target, rel_type).

    Returns (nodes, edges, reference_time).  Adds relevance / decay_score / age_days per edge.
    Supernode flag is applied to nodes whose degree meets config.SUPERNODE_DEGREE.
    """
    if reference is None:
        times = [_parse_time(d.get("observed_time")) for _, _, d in G.edges(data=True)]
        times = [t for t in times if t]
        reference = max(times) if times else None

    agg: dict[tuple[str, str, str], dict] = {}
    for u, v, d in G.edges(data=True):
        key = (u, v, d["rel_type"])
        a = agg.setdefault(key, {
            "source": u, "target": v, "rel_type": d["rel_type"],
            "count": 0, "weight": 0.0, "first_seen": None, "last_seen": None,
            "claim_ids": [], "evidence_ids": set(), "min_confidence": 1.0,
            "missing_count": 0, "methods": set(),
            "_governance_seen_at": None,
            **{set_key: set() for set_key in GOVERNANCE_SET_KEYS.values()},
        })
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
        # normal operation identical across every claim in a case. Where they DO differ, take the most
        # recently observed one — same recency rule as last_seen.
        t_key = t or ""
        if a["_governance_seen_at"] is None or t_key >= a["_governance_seen_at"]:
            a["_governance_seen_at"] = t_key
            a["jurisdiction"] = d.get("jurisdiction")
            a["access_class"] = d.get("access_class")
            a["authority_reference"] = d.get("authority_reference")

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
    deg = {n: len(set(U.neighbors(n))) for n in G.nodes}
    for n, d in G.nodes(data=True):
        nd = dict(d)
        nd["degree"] = deg.get(n, 0)
        if nd["degree"] >= config.SUPERNODE_DEGREE:
            nd["flags"] = {
                **nd.get("flags", {}),
                "supernode": True,
                "supernode_note": f"degree {nd['degree']} ≥ {config.SUPERNODE_DEGREE}; neighbourhood expansion is capped",
            }
        nodes.append(nd)
    return nodes, edges, reference


# ------------------------------------------------------------------------------- community stability

def _community_stability(
    core: nx.Graph,
    communities: list[set],
    trials: int = 20,
    drop_frac: float = 0.15,
    seed: int = 42,
) -> list[float]:
    """Bootstrap-style robustness check for greedy_modularity_communities.

    Reruns detection ``trials`` times on the core subgraph with a random ``drop_frac``
    fraction of edges removed each time, scoring each original community by its best
    Jaccard overlap against the perturbed communities.  Seeded for reproducibility.
    """
    if not communities:
        return []
    edges = list(core.edges())
    if not edges:
        return [1.0 for _ in communities]
    rng = random.Random(seed)
    n_drop = max(1, min(len(edges), int(len(edges) * drop_frac)))
    scores: list[list[float]] = [[] for _ in communities]
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


# ------------------------------------------------------------------------------- explainable analysis

def analyze(G: nx.MultiDiGraph) -> dict:
    """Return degree, betweenness, community, and rule summaries for a bounded subgraph.

    Language contract (docs/context.md §5): outputs use *review priority*, *possible bridge*,
    *candidate* — never *threat*, *guilt*, *criminal*, *proven*.
    """
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

    degree = sorted(
        ({"entity_id": n, "label": labels[n], "kind": kinds[n], "degree": d} for n, d in U.degree()),
        key=lambda x: -x["degree"],
    )[:10]
    weighted = sorted(
        ({"entity_id": n, "label": labels[n], "kind": kinds[n], "weighted_degree": d} for n, d in U.degree(weight="weight")),
        key=lambda x: -x["weighted_degree"],
    )[:10]

    # bridge candidates: betweenness on person/phone/account/org subgraph (structural, neutral language)
    core = U.subgraph([n for n in U if kinds[n] in ("PERSON", "PHONE", "ACCOUNT", "ORGANIZATION", "VEHICLE")]).copy()
    bet = nx.betweenness_centrality(core, normalized=True) if core.number_of_nodes() > 2 else {}
    bridges = sorted(
        ({"entity_id": n, "label": labels[n], "kind": kinds[n], "betweenness": round(b, 4)} for n, b in bet.items()),
        key=lambda x: -x["betweenness"],
    )[:5]

    communities: list[dict] = []
    comm_sets: list[set] = []
    if core.number_of_edges() > 0:
        try:
            for i, comm in enumerate(nx.community.greedy_modularity_communities(core)):
                comm_sets.append(set(comm))
                members = sorted(comm, key=lambda n: -core.degree(n))
                communities.append({
                    "community_id": f"C{i + 1}",
                    "size": len(members),
                    "members": [{"entity_id": n, "label": labels[n], "kind": kinds[n]} for n in members[:12]],
                })
        except Exception as exc:
            communities = [{"error": str(exc)}]
    if comm_sets:
        for c, score in zip(communities, _community_stability(core, comm_sets)):
            c["stability"] = score
            c["stability_note"] = (
                "share of this community's membership that survives when a random 15% "
                "of this view's edges are removed, averaged over 20 trials — a robustness "
                "check against how much this grouping depends on exactly which evidence "
                "is present, not a confidence or accuracy percentage"
            )

    # DEF-089: use full community sets, not the capped member list.
    comm_of = {n: f"C{i + 1}" for i, cset in enumerate(comm_sets) for n in cset}
    for b in bridges:
        touched = {comm_of.get(nb) for nb in U.neighbors(b["entity_id"]) if comm_of.get(nb)}
        b["touches_communities"] = sorted(touched)
        b["note"] = "candidate bridge / possible intermediary — structural observation only, not an accusation"

    return {
        "degree": degree,
        "weighted_degree": weighted,
        "bridge_candidates": bridges,
        "communities": communities,
        "rules": rule_candidates(G),
        "language_note": (
            "All outputs are review priorities derived from the evidence approved for this case. "
            "They do not assert guilt, threat, or wrongdoing."
        ),
    }


def rule_candidates(
    G: nx.MultiDiGraph,
    burst_n: int = 8,
    burst_window_h: int = 2,
    fanin_k: int = 4,
    fanin_days: int = 3,
) -> list[dict]:
    """Detect communication-burst and transaction-fan-in patterns in the graph.

    Returns review-priority items — structural observations, not assertions of wrongdoing.
    """
    out: list[dict] = []
    labels = {n: G.nodes[n]["label"] for n in G.nodes}
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
                out.append({
                    "rule": "communication_burst", "version": "1.0",
                    "subject": labels[u], "object": labels[v], "source": u, "target": v,
                    "count": j - i + 1,
                    "window_start": times[i].isoformat(sep=" "),
                    "window_end": times[j].isoformat(sep=" "),
                    "explanation": f"{j - i + 1} calls within {burst_window_h}h (threshold {burst_n})",
                    "priority": "review",
                })
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
                out.append({
                    "rule": "transaction_fan_in", "version": "1.0",
                    "subject": labels[v], "target": v,
                    "distinct_sources": len(srcs),
                    "sources": [labels[s] for s in sorted(srcs)],
                    "window_start": items[i][0].isoformat(sep=" "),
                    "window_end": items[j][0].isoformat(sep=" "),
                    "explanation": f"{len(srcs)} distinct source accounts within {fanin_days} days (threshold {fanin_k})",
                    "priority": "review",
                })
                break
    return out


# ------------------------------------------------------------------------------- snapshot hash

def snapshot_hash(nodes: list[dict], edges: list[dict]) -> str:
    """Deterministic SHA-256 of the node/edge set for client-side cache-busting."""
    payload = json.dumps({
        "nodes": sorted(n["entity_id"] for n in nodes),
        "edges": sorted(
            (e["source"], e["target"], e["rel_type"], e.get("count", 0))
            for e in edges
        ),
    }, sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()
