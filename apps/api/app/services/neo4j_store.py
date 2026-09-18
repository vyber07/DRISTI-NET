"""Real Neo4j-backed graph projection.

Postgres claims/reviews remain authoritative (docs/context.md §17); this module writes the *approved*
projection into Neo4j via parameterized Cypher (never string-built) and reads it back with a bounded,
parameterized traversal — the piece that must never be exposed to the browser directly. If the graph
projection is ever wiped, `write_projection` rebuilds it from the same Postgres claims that produced it.

Only active when DRISHTI_NEO4J_URI is set (see config.py) — the fast local/test loop otherwise builds an
equivalent in-process graph with no external service, same pattern as DATABASE_URL defaulting to SQLite.
"""
from __future__ import annotations

from .. import config

_driver = None


def _q(text: str):
    """Wrap Cypher text with the server-enforced per-query timeout (config.NEO4J_QUERY_TIMEOUT_S) --
    distinct from the connection timeout in driver(), which only bounds reaching the server."""
    from neo4j import Query
    return Query(text, timeout=config.NEO4J_QUERY_TIMEOUT_S)


def available() -> bool:
    return bool(config.NEO4J_URI)


def driver():
    global _driver
    if _driver is None:
        from neo4j import GraphDatabase
        auth = (config.NEO4J_USER, config.NEO4J_PASSWORD) if config.NEO4J_PASSWORD else None
        # Without these the driver's defaults leave a request hanging for ~60s when Neo4j is unreachable
        # (measured live: docker stop on the neo4j container, a graph request took 56.6s to finally 500)
        # -- a real reliability bug, not a hypothetical one, found via failure-injection testing
        # (TASK_BOARD.md). connection_timeout bounds the initial TCP/handshake attempt; max_transaction_retry_time
        # bounds the driver's own retry backoff on transient errors so the two don't compound.
        _driver = GraphDatabase.driver(
            config.NEO4J_URI, auth=auth,
            connection_timeout=config.NEO4J_CONNECTION_TIMEOUT_S,
            max_transaction_retry_time=config.NEO4J_CONNECTION_TIMEOUT_S,
        )
    return _driver


def close() -> None:
    global _driver
    if _driver is not None:
        _driver.close()
        _driver = None


def wipe_all() -> None:
    """Delete every node/relationship. Test-isolation only (conftest.py) -- the real application never
    calls this; production data is never wiped by application code. Neo4j is rebuildable from Postgres
    claims (write_projection), so this is safe: it only ever removes what a subsequent build_projection
    call will re-create from the source of truth.

    Bug this fixes (found via live multi-backend testing, 2026-09-12): write_projection only ever
    MERGEs/adds entity nodes and grows their `case_ids` -- it never deletes a stale node. Across many
    live test runs against the same persistent Neo4j container, stale entities accumulated and an
    unordered `LIMIT` in read_bounded could return them instead of the current run's real entities,
    making the route's keep-set intersect with nothing and silently return zero nodes.
    """
    with driver().session() as s:
        s.run("MATCH (n) DETACH DELETE n")


def apply_constraints() -> None:
    """Apply graph/constraints.cypher — the single source of truth for Neo4j constraints/indexes."""
    from .. import config as _config
    path = _config.REPO_ROOT / "graph" / "constraints.cypher"
    statements = [s.strip() for s in path.read_text().split(";") if s.strip() and not s.strip().startswith("//")]
    with driver().session() as s:
        for stmt in statements:
            s.run(stmt)


def write_projection(case_id: str, nodes: list[dict], edges: list[dict]) -> None:
    """Rebuild this case's projection in Neo4j from the given (already-merged, already-approved) nodes/edges.
    Idempotent: re-running with the same input converges to the same graph (MERGE, not CREATE).
    """
    with driver().session() as s:
        s.execute_write(_write_projection_tx, case_id, nodes, edges)


def _write_projection_tx(tx, case_id: str, nodes: list[dict], edges: list[dict]) -> None:
    # Entities are a global registry in Postgres (an ACCOUNT/PHONE/etc. entity can be referenced by claims
    # from more than one case) — so a node's case membership is a *set*, not overwritten wholesale by the
    # next case's sync. But it must still be RECONCILED, not just grown: when an approved identity match
    # merges entity B into A, the current projection no longer contains B as a top-level node (it becomes
    # `merged_from` on A) -- if B's membership in this case were left untouched, it would sit in Neo4j
    # forever as a stale node that an unordered LIMIT read can still return, even though it no longer
    # corresponds to anything build_projection currently produces for this case (found via live testing,
    # 2026-09-12: intermittent empty graph reads). So first drop this case from any entity not in the
    # current node set, then (re)add it to the ones that are.
    new_ids = [n["entity_id"] for n in nodes]
    tx.run(
        """
        MATCH (e:Entity) WHERE $case_id IN e.case_ids AND NOT e.entity_id IN $new_ids
        SET e.case_ids = [x IN e.case_ids WHERE x <> $case_id]
        """,
        case_id=case_id, new_ids=new_ids,
    )
    tx.run(
        """
        UNWIND $nodes AS n
        MERGE (e:Entity {entity_id: n.entity_id})
        SET e.kind = n.kind, e.label = n.label, e.access_class = n.access_class,
            e.case_ids = CASE WHEN e.case_ids IS NULL THEN [$case_id]
                               WHEN NOT $case_id IN e.case_ids THEN e.case_ids + $case_id
                               ELSE e.case_ids END
        """,
        case_id=case_id, nodes=nodes,
    )
    tx.run("MATCH ()-[r:REL {case_id: $case_id}]-() DELETE r", case_id=case_id)
    tx.run(
        """
        UNWIND $edges AS ed
        MATCH (a:Entity {entity_id: ed.source}), (b:Entity {entity_id: ed.target})
        MERGE (a)-[r:REL {claim_id: ed.claim_id}]->(b)
        SET r.rel_type = ed.rel_type, r.evidence_id = ed.evidence_id, r.observed_time = ed.observed_time,
            r.weight = ed.weight, r.confidence = ed.confidence, r.missing = ed.missing,
            r.state = ed.state, r.method = ed.method, r.case_id = $case_id,
            r.jurisdiction = ed.jurisdiction, r.access_class = ed.access_class, r.authority_reference = ed.authority_reference
        """,
        case_id=case_id, edges=edges,
    )


def read_bounded(case_id: str, center: str | None, hops: int, max_nodes: int, offset: int = 0) -> tuple[list[dict], list[dict], bool]:
    """Server-side bounded, parameterized Cypher traversal — the browser never runs this query itself.
    Enforces case scope, a hop limit, and a node-count limit at the database, not just in application code.

    `offset` pages through the node listing when `center` is None (an ORDER BY makes the paging stable
    across requests) -- there is no equivalent for a centered hop-bounded traversal: a BFS neighbourhood
    has no natural total order to page through, so `offset` is accepted but has no effect when `center`
    is set (same "don't fake it" posture as everywhere else in this codebase; see docs/adr/004).
    """
    hops = max(1, min(hops, config.GRAPH_MAX_HOPS))
    max_nodes = max(5, min(max_nodes, config.GRAPH_MAX_NODES))
    offset = max(0, offset)
    with driver().session() as s:
        if center:
            rows = s.run(
                _q(f"""
                MATCH (c:Entity {{entity_id: $center}}) WHERE $case_id IN c.case_ids
                CALL {{
                    WITH c
                    MATCH p = (c)-[rels:REL*1..{hops}]-(n:Entity)
                    WHERE all(rel IN rels WHERE rel.case_id = $case_id) AND $case_id IN n.case_ids
                    RETURN DISTINCT n
                    LIMIT $max_nodes
                }}
                RETURN collect(DISTINCT c) + collect(DISTINCT n) AS nodes
                """),
                center=center, case_id=case_id, max_nodes=max_nodes,
            ).single()
            node_records = rows["nodes"] if rows else []
        else:
            node_records = [r["n"] for r in s.run(
                _q("MATCH (n:Entity) WHERE $case_id IN n.case_ids RETURN n ORDER BY n.entity_id SKIP $offset LIMIT $max_nodes"),
                case_id=case_id, max_nodes=max_nodes, offset=offset,
            )]
        node_ids = [n["entity_id"] for n in node_records]
        nodes = [dict(n) for n in node_records]
        edges = []
        if node_ids:
            for rec in s.run(
                _q("""
                MATCH (a:Entity)-[r:REL {case_id: $case_id}]->(b:Entity)
                WHERE a.entity_id IN $ids AND b.entity_id IN $ids
                RETURN a.entity_id AS source, b.entity_id AS target, r AS rel
                """),
                case_id=case_id, ids=node_ids,
            ):
                r = dict(rec["rel"])
                r["source"], r["target"] = rec["source"], rec["target"]
                edges.append(r)
        total = s.run(_q("MATCH (n:Entity) WHERE $case_id IN n.case_ids RETURN count(n) AS c"), case_id=case_id).single()["c"]
        truncated = (offset + len(node_ids) < total) if center is None else len(node_ids) >= max_nodes
    return nodes, edges, truncated
