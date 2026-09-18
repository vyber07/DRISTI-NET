from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..auth import authorize_case, current_user
from ..db import get_db
from ..models import CaseAssignment, Claim, Entity, Evidence, Provenance, Review, User
from ..schemas import RevealIn
from ..services import graph as graph_svc
from ..services.audit import record_audit
from ..services.masking import mask_label, mask_node, mask_text

router = APIRouter(tags=["graph"])


def _t(s: str | None) -> datetime | None:
    return graph_svc._parse_time(s) if s else None


def claim_out(c: Claim, db: Session, unmasked: bool = False) -> dict:
    src, tgt = db.get(Entity, c.source_entity_id), db.get(Entity, c.target_entity_id) if c.target_entity_id else None
    provs = db.query(Provenance).filter_by(claim_id=c.claim_id).all()
    ev = db.get(Evidence, c.evidence_id)
    reviews = db.query(Review).filter_by(target_kind="CLAIM", target_id=c.claim_id).order_by(Review.created_at).all()
    lab = (lambda k, v: v) if unmasked else mask_label
    txt = (lambda v: v) if unmasked else mask_text
    return {"claim_id": c.claim_id, "case_id": c.case_id, "kind": c.kind, "rel_type": c.rel_type, "attribute": c.attribute,
            "source": {"entity_id": src.entity_id, "kind": src.kind, "label": lab(src.kind, src.label)},
            "target": {"entity_id": tgt.entity_id, "kind": tgt.kind, "label": lab(tgt.kind, tgt.label)} if tgt else None,
            "original_value": txt(c.original_value), "normalized_value": txt(c.normalized_value), "observed_time": c.observed_time,
            "valid_from": c.valid_from, "valid_to": c.valid_to, "method": c.method, "method_version": c.method_version,
            "confidence": c.confidence, "missingness": c.missingness, "state": c.state, "flags": c.flags, "weight": c.weight,
            "evidence": {"evidence_id": ev.evidence_id, "filename": ev.filename, "sha256": ev.sha256, "status": ev.status, "version": ev.version, "record_type": ev.record_type,
                        "jurisdiction": ev.jurisdiction, "access_class": ev.access_class, "authority_reference": ev.authority_reference},
            "provenance": [{"provenance_id": p.provenance_id, "locator": p.locator, "snippet": txt(p.snippet), "method": p.method, "method_version": p.method_version} for p in provs],
            "reviews": [{"review_id": r.review_id, "decision": r.decision, "reason": r.reason, "reviewer_id": r.reviewer_id, "created_at": r.created_at.isoformat()} for r in reviews],
            "access_class": src.access_class}


@router.get("/cases/{case_id}/graph")
def graph(case_id: str, request: Request, center: str | None = None, hops: int = 1, max_nodes: int = 100, offset: int = 0,
          t_from: str | None = None, t_to: str | None = None, include_candidates: bool = True,
          user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Bounded projection. hops ≤ GRAPH_MAX_HOPS and max_nodes ≤ GRAPH_MAX_NODES are enforced server-side.
    `offset` pages through the node listing when `center` is unset — a centered hop-bounded traversal has
    no natural total order to page through (see bounded_subgraph's docstring), so `offset` is accepted
    but has no effect once `center` is given.
    """
    authorize_case(db, user, case_id, request, action="GRAPH_VIEW")
    if offset < 0:
        raise HTTPException(422, "offset must be >= 0")
    G = graph_svc.build_projection(db, case_id, _t(t_from), _t(t_to))
    keep, truncated = graph_svc.bounded_subgraph(G, case_id, center, hops, max_nodes, offset)
    nodes, edges, reference = graph_svc.aggregate(G)
    nodes = [mask_node(n) for n in nodes if n["entity_id"] in keep]
    edges = [e for e in edges if e["source"] in keep and e["target"] in keep]
    cands = []
    if include_candidates:
        merges = graph_svc.approved_merges(db, case_id)
        cands = [c for c in graph_svc.candidate_edges(db, case_id, merges) if c["source"] in keep and c["target"] in keep]
    snap_hash = graph_svc.snapshot_hash(nodes, edges)
    for e in edges:
        # Edge-level snapshot_id (TASK_BOARD.md Phase 10): the content hash of *this exact bounded view*
        # (this case's approved claims, this hop/max_nodes/time-window bound), not a per-request DB row --
        # a persisted Snapshot row per /graph call would be pure write volume with no reader (only report
        # export needs a durable, citable snapshot). Deterministic and rebuildable, same guarantee
        # test_projection_is_rebuildable already proves for the whole graph: two clients who see the same
        # snapshot_id for an edge saw the same claims projected the same way, so a client caching or
        # diffing edges across requests can tell whether the underlying view actually changed.
        e["snapshot_id"] = snap_hash
    record_audit(db, request.state.trace_id, user.user_id, "GRAPH_VIEW", "CASE", case_id, case_id, detail={"center": center, "hops": hops, "nodes": len(nodes), "offset": offset})
    db.commit()
    # Pagination (Role 5 backlog item, docs/status.md): only meaningful when `center` is unset -- see
    # bounded_subgraph's docstring for why a centered hop-bounded traversal has no stable total order to
    # page through. `next_offset` is null once there is nothing further to page to.
    next_offset = offset + len(nodes) if (center is None and truncated) else None
    return {"case_id": case_id, "nodes": nodes, "edges": edges, "candidate_edges": cands, "truncated": truncated,
            "bounds": {"hops": min(hops, graph_svc.config.GRAPH_MAX_HOPS), "max_nodes": min(max_nodes, graph_svc.config.GRAPH_MAX_NODES), "supernode_degree": graph_svc.config.SUPERNODE_DEGREE},
            "reference_time": reference.isoformat(sep=" ") if reference else None, "total_nodes": G.number_of_nodes(), "total_edges": G.number_of_edges(),
            "snapshot_hash": snap_hash, "masked": True, "offset": offset, "next_offset": next_offset}


@router.get("/cases/{case_id}/locations")
def locations(case_id: str, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """LOCATION entities that appear in this case's approved claims, for the map view (docs/status.md
    Role 2 backlog item). Bounded to config.GRAPH_MAX_NODES, the same server-side cap the graph endpoint
    itself uses — a map view is a different projection of the same claim data, not an unbounded query.
    Entities with no valid lat/lon (e.g. a cell tower row that only ever appeared via a calls.csv
    cell_id, before/without a matching locations.csv row) are still returned with `has_coords: false`
    rather than silently dropped, so the UI can report "N locations without coordinates" honestly.
    """
    authorize_case(db, user, case_id, request, action="LOCATION_VIEW")
    ent_ids = {r[0] for r in db.query(Claim.source_entity_id).filter(Claim.case_id == case_id, Claim.state.in_(["ALLOWED", "APPROVE"])).all()}
    ent_ids |= {r[0] for r in db.query(Claim.target_entity_id).filter(Claim.case_id == case_id, Claim.target_entity_id.isnot(None), Claim.state.in_(["ALLOWED", "APPROVE"])).all()}
    q = db.query(Entity).filter(Entity.kind == "LOCATION", Entity.entity_id.in_(ent_ids)) if ent_ids else db.query(Entity).filter(Entity.entity_id.in_([]))
    total = q.count()
    ents = q.order_by(Entity.entity_id).limit(graph_svc.config.GRAPH_MAX_NODES).all()
    out = []
    for e in ents:
        case_attrs = (e.attributes or {}).get(case_id, {}) if isinstance(e.attributes, dict) and case_id in (e.attributes or {}) else (e.attributes or {})
        lat, lon = case_attrs.get("lat"), case_attrs.get("lon")
        try:
            lat_f, lon_f = float(lat), float(lon)
            has_coords = True
        except (TypeError, ValueError):
            lat_f, lon_f, has_coords = None, None, False
        out.append({"entity_id": e.entity_id, "label": e.label, "kind_detail": case_attrs.get("kind"),
                    "lat": lat_f, "lon": lon_f, "has_coords": has_coords})
    record_audit(db, request.state.trace_id, user.user_id, "LOCATION_VIEW", "CASE", case_id, case_id, detail={"count": len(out)})
    db.commit()
    return {"case_id": case_id, "locations": out, "truncated": total > len(out), "total": total}


@router.get("/cases/{case_id}/analysis")
def analysis(case_id: str, request: Request, t_from: str | None = None, t_to: str | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)):
    authorize_case(db, user, case_id, request, action="ANALYSIS_VIEW")
    G = graph_svc.build_projection(db, case_id, _t(t_from), _t(t_to))
    res = graph_svc.analyze(G)
    for key in ("degree", "weighted_degree", "bridge_candidates"):
        for item in res[key]:
            item["label"] = mask_label(item["kind"], item["label"])
    for comm in res["communities"]:
        for m in comm.get("members", []):
            m["label"] = mask_label(m["kind"], m["label"])
    for r in res["rules"]:
        for k in ("subject", "object"):
            if k in r:
                r[k] = mask_text(r[k])
        if "sources" in r:
            r["sources"] = [mask_text(s) for s in r["sources"]]
    return res


@router.get("/cases/{case_id}/timeline")
def timeline(case_id: str, request: Request, t_from: str | None = None, t_to: str | None = None, entity_id: str | None = None,
             limit: int = 500, user: User = Depends(current_user), db: Session = Depends(get_db)):
    authorize_case(db, user, case_id, request, action="TIMELINE_VIEW")
    q = db.query(Claim).filter(Claim.case_id == case_id, Claim.kind == "RELATIONSHIP", Claim.observed_time.isnot(None), Claim.state.in_(["ALLOWED", "APPROVE"]))
    if entity_id:
        q = q.filter((Claim.source_entity_id == entity_id) | (Claim.target_entity_id == entity_id))
    if t_from:
        q = q.filter(Claim.observed_time >= t_from)
    if t_to:
        q = q.filter(Claim.observed_time <= t_to)
    claims = q.order_by(Claim.observed_time).limit(min(limit, 2000)).all()
    ents = {e.entity_id: e for e in db.query(Entity).filter(Entity.entity_id.in_({c.source_entity_id for c in claims} | {c.target_entity_id for c in claims if c.target_entity_id})).all()} if claims else {}
    all_times = [c.observed_time for c in db.query(Claim.observed_time).filter(Claim.case_id == case_id, Claim.observed_time.isnot(None)).all() for c in [c]]
    ref = max(all_times) if all_times else None
    events = []
    for c in claims:
        s, t = ents[c.source_entity_id], ents.get(c.target_entity_id)
        age = (graph_svc._parse_time(ref) - graph_svc._parse_time(c.observed_time)).days if ref and graph_svc._parse_time(c.observed_time) else None
        events.append({"claim_id": c.claim_id, "time": c.observed_time, "rel_type": c.rel_type,
                       "source": {"entity_id": s.entity_id, "kind": s.kind, "label": mask_label(s.kind, s.label)},
                       "target": {"entity_id": t.entity_id, "kind": t.kind, "label": mask_label(t.kind, t.label)} if t else None,
                       "evidence_id": c.evidence_id, "relevance": ("HISTORICAL" if age is not None and age > graph_svc.HISTORICAL_AFTER_DAYS else "CURRENT"),
                       "missing": c.missingness, "confidence": c.confidence})
    return {"case_id": case_id, "reference_time": ref, "count": len(events), "events": events}


@router.get("/cases/{case_id}/edge")
def edge_detail(case_id: str, request: Request, source: str, target: str, rel_type: str, limit: int = 50, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Evidence drawer: every claim (with provenance) behind an aggregated graph edge — merged nodes included."""
    authorize_case(db, user, case_id, request, action="EDGE_VIEW")
    merges = graph_svc.approved_merges(db, case_id)
    src_ids = [e for e, r in merges.items() if r == source] or [source]
    tgt_ids = [e for e, r in merges.items() if r == target] or [target]
    src_ids, tgt_ids = list(set(src_ids) | {source}), list(set(tgt_ids) | {target})
    claims = db.query(Claim).filter(Claim.case_id == case_id, Claim.rel_type == rel_type, Claim.source_entity_id.in_(src_ids), Claim.target_entity_id.in_(tgt_ids),
                                    Claim.state.in_(["ALLOWED", "APPROVE"])).order_by(Claim.observed_time).limit(min(limit, 500)).all()
    record_audit(db, request.state.trace_id, user.user_id, "EDGE_VIEW", "EDGE", f"{source}->{target}:{rel_type}", case_id, detail={"claims": len(claims)})
    db.commit()
    return {"source": source, "target": target, "rel_type": rel_type, "claims": [claim_out(c, db) for c in claims]}


@router.get("/claims/{claim_id}")
def get_claim(claim_id: str, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    c = db.get(Claim, claim_id)
    if c is None:
        raise HTTPException(404, "unknown claim")
    authorize_case(db, user, c.case_id, request, action="CLAIM_VIEW")
    return claim_out(c, db)


@router.get("/entities/{entity_id}")
def get_entity(entity_id: str, request: Request, case_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Entity card incl. cross-case appearances — other cases are only named if the user may access them."""
    authorize_case(db, user, case_id, request, action="ENTITY_VIEW")
    e = db.get(Entity, entity_id)
    if e is None:
        raise HTTPException(404, "unknown entity")
    all_cases = {r[0] for r in db.query(Claim.case_id).filter((Claim.source_entity_id == entity_id) | (Claim.target_entity_id == entity_id)).distinct()}
    mine = {a.case_id for a in db.query(CaseAssignment).filter_by(user_id=user.user_id).all()} if user.role not in ("ADMIN", "AUDITOR") else all_cases
    visible = sorted((all_cases & mine) - {case_id})
    hidden = len(all_cases - mine - {case_id})
    claims = db.query(Claim).filter(Claim.case_id == case_id, (Claim.source_entity_id == entity_id) | (Claim.target_entity_id == entity_id)).order_by(Claim.observed_time).limit(200).all()
    case_attrs = (e.attributes or {}).get(case_id, {}) if isinstance(e.attributes, dict) and case_id in (e.attributes or {}) else (e.attributes or {})
    return {"entity_id": e.entity_id, "kind": e.kind, "label": mask_label(e.kind, e.label), "masked": e.kind in ("PHONE", "ACCOUNT"),
            "attributes": {k: v for k, v in case_attrs.items()}, "access_class": e.access_class,
            "cross_case": {"visible_cases": visible, "restricted_case_count": hidden, "total_cases": len(all_cases)},
            "claims": [claim_out(c, db) for c in claims]}


@router.post("/entities/{entity_id}/reveal")
def reveal(entity_id: str, body: RevealIn, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Authorized unmasking. Requires a reason, is role-gated, and always writes an UNMASK audit event."""
    authorize_case(db, user, body.case_id, request, action="UNMASK")
    if user.role not in ("INVESTIGATOR", "REVIEWER", "ADMIN"):
        record_audit(db, request.state.trace_id, user.user_id, "UNMASK", "ENTITY", entity_id, body.case_id, outcome="DENIED", detail={"reason": body.reason, "why": "role not permitted"})
        db.commit()
        raise HTTPException(403, f"role {user.role} may not reveal masked values")
    e = db.get(Entity, entity_id)
    if e is None:
        raise HTTPException(404, "unknown entity")
    case_claims = db.query(Claim).filter(
        Claim.case_id == body.case_id,
        (Claim.source_entity_id == entity_id) | (Claim.target_entity_id == entity_id)
    ).first()
    if not case_claims:
        record_audit(db, request.state.trace_id, user.user_id, "UNMASK", "ENTITY", entity_id, body.case_id, outcome="DENIED", detail={"reason": body.reason, "why": "entity not in case"})
        db.commit()
        raise HTTPException(403, "entity does not belong to this case")
    aud = record_audit(db, request.state.trace_id, user.user_id, "UNMASK", "ENTITY", entity_id, body.case_id, detail={"reason": body.reason, "kind": e.kind})
    db.commit()
    return {"entity_id": entity_id, "kind": e.kind, "value": e.label, "audit_id": aud.audit_id, "reason": body.reason}
