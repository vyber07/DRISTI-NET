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

Pure analytics functions (aggregate, analyze, rule_candidates, snapshot_hash, etc.) live in
graph_analytics.py — they accept only the already-built in-memory graph and have no DB/storage deps.
"""
from __future__ import annotations

import hashlib
import json
import logging
import threading
from datetime import datetime

import networkx as nx
from sqlalchemy.orm import Session

from .. import config
from .masking import case_attributes
from ..models import Claim, Entity, Evidence, MatchCandidate
from . import neo4j_store
from .graph_analytics import (  # re-exported for callers that use `graph_svc.X`
    HISTORICAL_AFTER_DAYS,
    HALF_LIFE_DAYS,
    GOVERNANCE_SET_KEYS,
    _parse_time,
    aggregate,
    _community_stability,
    analyze,
    rule_candidates,
    snapshot_hash,
)

logger = logging.getLogger("drishti.graph")


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
def build_projection(db: Session, case_id: str, t_from: datetime | None = None, t_to: datetime | None = None,
                     include_case_node: bool = False, sync_neo4j: bool = False) -> nx.MultiDiGraph:
    """The authoritative in-process projection for one case, from its claims.

    sync_neo4j (P1.4): only the graph view, which reads bounded results back from Neo4j, asks for the Neo4j copy to be
    brought up to date, and only for the full (unfiltered) projection. Analysis, reports and integrity work on this
    in-memory graph alone. Before P1.4 every caller rewrote the whole case in Neo4j on every request (seconds per view,
    deadlocks between concurrent viewers), and a time-filtered view stored its subset as if it were the whole case.
    """
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
            case_attrs = case_attributes(base.attributes, case_id)  # DEF-033b: never other cases' attributes
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
    if sync_neo4j and t_from is None and t_to is None and neo4j_store.available():
        try:
            ensure_synced(case_id, G)
        except Exception as exc:  # DEF-043 / constitution §6.1: projection failure must not fail the request
            logger.warning("Neo4j projection sync failed for %s, serving in-process projection: %s", case_id, exc)
            G.graph["projection_stale"] = True
    return G


def _neo4j_rows(G: nx.MultiDiGraph) -> tuple[list[dict], list[dict]]:
    """Exactly what is written to Neo4j, in a canonical order (so it can be fingerprinted)."""
    nodes = sorted(({"entity_id": n, "kind": d["kind"], "label": d["label"], "access_class": d["access_class"]}
                    for n, d in G.nodes(data=True)), key=lambda r: r["entity_id"])
    edges = sorted(({"source": u, "target": v, "claim_id": d["claim_id"], "rel_type": d["rel_type"], "evidence_id": d["evidence_id"],
                     "observed_time": d.get("observed_time"), "weight": d.get("weight"), "confidence": d.get("confidence"),
                     "missing": d.get("missing"), "state": d.get("state"), "method": d.get("method"),
                     "jurisdiction": d.get("jurisdiction"), "access_class": d.get("access_class"),
                     "authority_reference": d.get("authority_reference")}
                    for u, v, d in G.edges(data=True)), key=lambda r: (r["claim_id"], r["source"], r["target"]))
    return nodes, edges


def projection_fingerprint(G: nx.MultiDiGraph) -> str:
    """Content hash of everything written to Neo4j for this projection. Same claims -> same fingerprint."""
    nodes, edges = _neo4j_rows(G)
    blob = json.dumps({"nodes": nodes, "edges": edges}, sort_keys=True, default=str, separators=(",", ":"))
    return "p1:" + hashlib.sha256(blob.encode()).hexdigest()


_SYNC_LOCKS: dict[str, threading.Lock] = {}
_SYNC_LOCKS_GUARD = threading.Lock()


def _case_lock(case_id: str) -> threading.Lock:
    with _SYNC_LOCKS_GUARD:
        return _SYNC_LOCKS.setdefault(case_id, threading.Lock())


def ensure_synced(case_id: str, G: nx.MultiDiGraph) -> bool:
    """Bring the Neo4j copy of this case up to date with G; returns True if it had to write.

    Cheap when nothing changed (one indexed read of the stored fingerprint). When it did change, one thread per process
    rewrites it while the others wait and then find it current; across processes the (:Projection) node lock in
    neo4j_store serialises writers. A writer that cannot get the per-process lock within the query timeout raises, and
    build_projection serves the in-process projection flagged stale rather than queue behind it.
    """
    fp = projection_fingerprint(G)
    if neo4j_store.projection_fingerprint(case_id) == fp:
        return False
    lock = _case_lock(case_id)
    if not lock.acquire(timeout=config.NEO4J_QUERY_TIMEOUT_S):
        raise TimeoutError(f"projection sync for {case_id} is busy")
    try:
        if neo4j_store.projection_fingerprint(case_id) == fp:  # another thread wrote it while we waited
            return False
        nodes, edges = _neo4j_rows(G)
        return neo4j_store.write_projection(case_id, nodes, edges, fp)
    finally:
        lock.release()




def candidate_edges(db: Session, case_id: str, merges: dict[str, str]) -> list[dict]:
    out = []
    for m in db.query(MatchCandidate).filter(MatchCandidate.case_id == case_id, MatchCandidate.state.in_(["REVIEW_REQUIRED", "DEFER", "STALE"])).all():
        out.append({"source": merges.get(m.left_entity_id, m.left_entity_id), "target": merges.get(m.right_entity_id, m.right_entity_id),
                    "rel_type": "POSSIBLE_SAME_AS", "state": m.state, "candidate_id": m.candidate_id, "confidence": m.confidence, "count": 1, "relevance": "CANDIDATE"})
    return out


# ----------------------------------------------------------------------------- bounded exploration
def rank_nodes(G: nx.MultiDiGraph) -> list[str]:
    """Most-connected first: number of this case's relationships (claim edges) touching the node, a self-loop counted
    once; ties by entity_id. Identical to neo4j_store.read_bounded's uncentered ORDER BY."""
    def claims(n):
        return len({k for _u, _v, k in G.in_edges(n, keys=True)} | {k for _u, _v, k in G.out_edges(n, keys=True)})
    return sorted(G.nodes, key=lambda n: (-claims(n), n))


def bounded_subgraph(G: nx.MultiDiGraph, case_id: str, center: str | None, hops: int, max_nodes: int, offset: int = 0,
                     use_neo4j: bool = True) -> tuple[set[str], bool]:
    """The bounded traversal itself runs as a parameterized Cypher query against Neo4j when configured
    (services/neo4j_store.read_bounded) — the browser never gets unrestricted graph access either way.
    Falls back to an equivalent in-process traversal only when no Neo4j is configured for this deployment.

    `offset` pages through the node listing when `center` is None -- see the docstring on
    neo4j_store.read_bounded for why a centered hop-bounded traversal can't be paged the same way.
    """
    offset = max(0, offset)
    # DEF-071 / DEC-012: centered traversals are bounded in-process on every backend. The Neo4j Cypher traversal
    # did not apply the supernode fan-out cap (a 20-spoke hub returned all 20 neighbours, cap 12) -- found when
    # the restored supernode test ran against live Neo4j. The authoritative projection G is already in memory.
    # use_neo4j=False (P1.4): a time-filtered G is a subset of what Neo4j holds; reading Neo4j would return the full case.
    if use_neo4j and neo4j_store.available() and not G.graph.get("projection_stale") and (center is None or center not in G):
        try:
            nodes, _edges, truncated = neo4j_store.read_bounded(case_id, center, hops, max_nodes, offset)
            ids = {n["entity_id"] for n in nodes}
            if ids <= set(G.nodes):
                return ids, truncated
            # DEF-072: the projection disagrees with the authoritative rows (e.g. another instance wrote this case
            # id into a shared Neo4j). Never serve it; fall back and say so.
            logger.warning("Neo4j projection for %s disagrees with authoritative rows (%d unknown ids); using in-process",
                           case_id, len(ids - set(G.nodes)))
            G.graph["projection_stale"] = True
        except Exception as exc:  # DEF-043: fall back to the authoritative in-process projection
            logger.warning("Neo4j bounded read failed for %s, using in-process projection: %s", case_id, exc)
            G.graph["projection_stale"] = True
    hops = max(1, min(hops, config.GRAPH_MAX_HOPS))
    max_nodes = max(5, min(max_nodes, config.GRAPH_MAX_NODES))
    U = G.to_undirected(as_view=True)
    udeg = lambda n: len(set(U.neighbors(n)))
    if center is None or center not in G:
        # DEF-072 / P1.4: one order on every backend (rank_nodes = the Neo4j listing's ORDER BY), so a request that falls
        # back mid-pagination does not repeat or skip nodes, and the first page holds the most-connected entities.
        ranked = rank_nodes(G)
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
