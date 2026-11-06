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

import logging
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
    if neo4j_store.available():
        try:
            _sync_to_neo4j(case_id, G)
        except Exception as exc:  # DEF-043 / constitution §6.1: projection failure must not fail the request
            logger.warning("Neo4j projection sync failed for %s, serving in-process projection: %s", case_id, exc)
            G.graph["projection_stale"] = True
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
    # DEF-071 / DEC-012: centered traversals are bounded in-process on every backend. The Neo4j Cypher traversal
    # did not apply the supernode fan-out cap (a 20-spoke hub returned all 20 neighbours, cap 12) -- found when
    # the restored supernode test ran against live Neo4j. The authoritative projection G is already in memory.
    if neo4j_store.available() and not G.graph.get("projection_stale") and (center is None or center not in G):
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
        # DEF-072: page in the same order the Neo4j listing uses when Neo4j is configured, so a request that falls
        # back mid-pagination does not mix two orderings (nodes repeated or skipped across pages).
        if neo4j_store.available():
            ranked = sorted(G.nodes)
        else:
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
