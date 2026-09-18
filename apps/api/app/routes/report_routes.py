from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from ..auth import authorize_case, require_roles
from ..db import get_db
from ..models import Claim, Entity, Evidence, MatchCandidate, Review, Snapshot, User
from ..schemas import ReportIn
from ..services import graph as graph_svc
from ..services.audit import record_audit
from ..services.masking import mask_label, mask_text
from ..services.report import build_report, render_html
from .case_routes import case_out
from .evidence_routes import evidence_out

router = APIRouter(tags=["report"])


@router.post("/cases/{case_id}/report")
def export_report(case_id: str, body: ReportIn, request: Request, user: User = Depends(require_roles("INVESTIGATOR", "REVIEWER", "ANALYST", "ADMIN")), db: Session = Depends(get_db)):
    case = authorize_case(db, user, case_id, request, action="EXPORT")
    G = graph_svc.build_projection(db, case_id)
    nodes, edges, _ = graph_svc.aggregate(G)
    labels = {n["entity_id"]: mask_label(n["kind"], n["label"]) for n in nodes}
    snap_hash = graph_svc.snapshot_hash(nodes, edges)
    snap = Snapshot(case_id=case_id, kind="GRAPH", content_hash=snap_hash, created_by=user.user_id,
                    payload={"node_count": len(nodes), "edge_count": len(edges), "node_ids": [n["entity_id"] for n in nodes]})
    db.add(snap)
    db.flush()

    reviews = []
    for m in db.query(MatchCandidate).filter_by(case_id=case_id).all():
        l, r = db.get(Entity, m.left_entity_id), db.get(Entity, m.right_entity_id)
        last = db.query(Review).filter_by(target_kind="MATCH", target_id=m.candidate_id).order_by(Review.created_at.desc()).first()
        reviews.append({"candidate_id": m.candidate_id, "state": m.state, "left": l.label, "right": r.label, "confidence": m.confidence,
                        "positive_signals": [s["signal"] for s in m.positive_signals], "conflicts": [c["attribute"] for c in m.conflicts],
                        "reviewer": last.reviewer_id if last else None, "reason": mask_text(last.reason) if last else None,
                        "decided_at": last.created_at.isoformat() if last else None, "evidence_ids": m.evidence_ids})
    for c in db.query(Claim).filter_by(case_id=case_id, state="CONTRADICTORY").all():
        e = db.get(Entity, c.source_entity_id)
        reviews.append({"state": "CONTRADICTORY", "entity": mask_label(e.kind, e.label), "attribute": c.attribute, "value": mask_text(c.original_value),
                        "evidence_id": c.evidence_id, "locator": str(c.flags.get("contradicts", [])), "claim_id": c.claim_id})

    rels = sorted(edges, key=lambda e: -e["count"])[:60]
    for e in rels:
        e["source"], e["target"] = labels.get(e["source"], e["source"]), labels.get(e["target"], e["target"])
        e.pop("claim_ids", None)
    analysis = graph_svc.analyze(G)
    for key in ("degree", "weighted_degree", "bridge_candidates"):
        for item in analysis[key]:
            item["label"] = mask_label(item["kind"], item["label"])
    for comm in analysis["communities"]:
        for mm in comm.get("members", []):
            mm["label"] = mask_label(mm["kind"], mm["label"])
    for r in analysis["rules"]:
        for k in ("subject", "object"):
            if k in r:
                r[k] = mask_text(r[k])
        if "sources" in r:
            r["sources"] = [mask_text(s) for s in r["sources"]]

    aud = record_audit(db, request.state.trace_id, user.user_id, "EXPORT", "CASE", case_id, case_id, detail={"format": body.format, "snapshot_id": snap.snapshot_id})
    db.flush()
    rep = build_report(case=case_out(case, db), evidence=[evidence_out(e) for e in db.query(Evidence).filter_by(case_id=case_id).all()],
                       reviews=reviews, relationships=rels, analysis=analysis, snapshot_id=f"{snap.snapshot_id} ({snap_hash[:16]})", audit_id=aud.audit_id,
                       analyst_comments=body.analyst_comments, access_context={"user": user.username, "role": user.role, "jurisdiction": user.jurisdiction, "trace_id": request.state.trace_id, "masked": True})
    db.add(Snapshot(case_id=case_id, kind="REPORT", content_hash=snap_hash, created_by=user.user_id, payload={"audit_id": aud.audit_id, "format": body.format}))
    db.commit()
    if body.format == "html":
        return HTMLResponse(render_html(rep))
    return rep
