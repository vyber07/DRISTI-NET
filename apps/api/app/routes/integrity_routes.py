"""Integrity and ledger-anchor routes.

POST /cases/{case_id}/integrity/anchor
  Computes the Merkle root over all ACCEPTED/ACTIVE evidence SHA-256 hashes in the case
  and optionally submits it to a configured Besu ledger endpoint.
  Returns the LedgerAnchor record.

GET /cases/{case_id}/integrity/anchors
  Lists all ledger anchors for a case (most recent first).

GET /cases/{case_id}/integrity/anchors/{anchor_id}/proof/{evidence_sha256}
  Returns the Merkle inclusion proof for a specific evidence SHA-256 hash in the anchor.

POST /cases/{case_id}/report/court-pdf
  Generates a court-ready evidence dossier PDF (BSA s.63(4)(c) reference structure).
  Returns the PDF binary.

All routes are case-scoped and authorization-gated.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ..auth import authorize_case, require_roles
from ..db import get_db
from ..models import Evidence, Entity, MatchCandidate, Review, Snapshot, User
from ..schemas import ReportIn, CourtPdfIn
from ..services import graph as graph_svc
from ..services import integrity as integrity_svc
from ..services.audit import record_audit
from ..services.masking import mask_label, mask_text
from ..services.court_pdf import generate_court_pdf
from .case_routes import case_out
from .evidence_routes import evidence_out

router = APIRouter(tags=["integrity"])


# ─── helpers ─────────────────────────────────────────────────────────────────

def _anchor_out(anchor) -> dict:
    return {
        "anchor_id": anchor.anchor_id,
        "case_id": anchor.case_id,
        "merkle_root": anchor.merkle_root,
        "leaf_count": len(anchor.leaf_hashes),
        "anchor_status": anchor.anchor_status,
        "tx_hash": anchor.tx_hash,
        "block_number": anchor.block_number,
        "chain_id": anchor.chain_id,
        "endpoint": anchor.endpoint,
        "note": anchor.note,
        "created_at": anchor.created_at.isoformat(),
        "created_by": anchor.created_by,
    }


def _get_case_evidence_hashes(db: Session, case_id: str) -> list[str]:
    """Return ordered list of SHA-256 hashes for all non-quarantined evidence in the case."""
    evs = (db.query(Evidence)
             .filter(Evidence.case_id == case_id,
                     Evidence.status.notin_(["QUARANTINED", "INFECTED", "REJECTED", "TOMBSTONED", "INTEGRITY_MISMATCH"]))
             .order_by(Evidence.created_at)
             .all())
    return [e.sha256 for e in evs]


# ─── routes ──────────────────────────────────────────────────────────────────

@router.post("/cases/{case_id}/integrity/anchor", status_code=201)
def create_anchor(
    case_id: str,
    request: Request,
    user: User = Depends(require_roles("INVESTIGATOR", "REVIEWER", "ANALYST", "ADMIN")),
    db: Session = Depends(get_db),
):
    """Compute the Merkle root over all accepted evidence SHA-256 hashes and record it.
    Optionally submits to a Besu ledger if DRISHTI_BESU_ENDPOINT and DRISHTI_BESU_SIGNING_KEY
    are configured (evaluation only — never use a plaintext key in production).

    The Merkle root is an integrity reference, not a chain-of-custody certificate.
    """
    case = authorize_case(db, user, case_id, request, action="INTEGRITY_ANCHOR")
    leaf_hashes = _get_case_evidence_hashes(db, case_id)
    if not leaf_hashes:
        raise HTTPException(422, "No accepted evidence in this case; cannot compute Merkle root")

    import os
    besu_endpoint = os.environ.get("DRISHTI_BESU_ENDPOINT", "")
    besu_key = os.environ.get("DRISHTI_BESU_SIGNING_KEY", "")

    anchor = integrity_svc.build_and_anchor(
        db_session=db,
        case_id=case_id,
        evidence_sha256_list=leaf_hashes,
        created_by=user.user_id,
        besu_endpoint=besu_endpoint,
        besu_signing_key=besu_key,
    )
    record_audit(db, request.state.trace_id, user.user_id, "INTEGRITY_ANCHOR", "CASE", case_id, case_id,
                 detail={"anchor_id": anchor.anchor_id, "merkle_root": anchor.merkle_root,
                         "leaf_count": len(leaf_hashes), "anchor_status": anchor.anchor_status})
    db.commit()
    return _anchor_out(anchor)


@router.get("/cases/{case_id}/integrity/anchors")
def list_anchors(
    case_id: str,
    request: Request,
    user: User = Depends(require_roles("INVESTIGATOR", "REVIEWER", "ANALYST", "ADMIN", "AUDITOR")),
    db: Session = Depends(get_db),
):
    authorize_case(db, user, case_id, request, action="INTEGRITY_VIEW")
    anchors = (db.query(integrity_svc.LedgerAnchor)
                 .filter_by(case_id=case_id)
                 .order_by(integrity_svc.LedgerAnchor.created_at.desc())
                 .limit(50)
                 .all())
    return [_anchor_out(a) for a in anchors]


@router.get("/cases/{case_id}/integrity/anchors/{anchor_id}/proof/{leaf_sha256}")
def merkle_proof(
    case_id: str,
    anchor_id: str,
    leaf_sha256: str,
    request: Request,
    user: User = Depends(require_roles("INVESTIGATOR", "REVIEWER", "ANALYST", "ADMIN", "AUDITOR")),
    db: Session = Depends(get_db),
):
    """Return the Merkle inclusion proof for a specific evidence SHA-256 hash.
    The proof can be verified offline with integrity.MerkleProof.verify().
    """
    authorize_case(db, user, case_id, request, action="INTEGRITY_PROOF")
    anchor = db.query(integrity_svc.LedgerAnchor).filter_by(anchor_id=anchor_id, case_id=case_id).first()
    if anchor is None:
        raise HTTPException(404, "anchor not found")
    try:
        idx = anchor.leaf_hashes.index(leaf_sha256)
    except ValueError:
        raise HTTPException(404, f"SHA-256 {leaf_sha256[:16]}… not found in anchor leaf set")
    try:
        proof = integrity_svc.merkle_proof(anchor.leaf_hashes, idx)
    except Exception as exc:
        raise HTTPException(500, f"Proof computation failed: {exc}")
    return {
        "anchor_id": anchor_id,
        "merkle_root": anchor.merkle_root,
        "leaf_sha256": leaf_sha256,
        "leaf_index": idx,
        "siblings": proof.siblings,
        "valid": proof.verify(),
        "note": "Verify offline: recompute the root from leaf + siblings and compare with merkle_root.",
    }


@router.post("/cases/{case_id}/report/court-pdf")
def export_court_pdf(
    case_id: str,
    body: CourtPdfIn,
    request: Request,
    user: User = Depends(require_roles("INVESTIGATOR", "REVIEWER", "ANALYST", "ADMIN")),
    db: Session = Depends(get_db),
):
    """Generate a court-ready evidence dossier PDF with BSA s.63(4)(c) reference fields.

    Returns the PDF binary (Content-Type: application/pdf).
    The dossier includes a prominent disclaimer: it is NOT a legal certificate.
    Signature, device, custody, and examiner fields must be completed by an authorised officer.
    """
    case = authorize_case(db, user, case_id, request, action="COURT_PDF_EXPORT")

    # Build graph snapshot (same as standard report)
    G = graph_svc.build_projection(db, case_id)
    nodes, edges, _ = graph_svc.aggregate(G)
    labels = {n["entity_id"]: mask_label(n["kind"], n["label"]) for n in nodes}
    snap_hash = graph_svc.snapshot_hash(nodes, edges)
    snap = Snapshot(case_id=case_id, kind="GRAPH", content_hash=snap_hash, created_by=user.user_id,
                    payload={"node_count": len(nodes), "edge_count": len(edges)})
    db.add(snap)
    db.flush()

    # Reviews
    reviews = []
    for m in db.query(MatchCandidate).filter_by(case_id=case_id).all():
        l_ent = db.get(Entity, m.left_entity_id)
        r_ent = db.get(Entity, m.right_entity_id)
        last_rev = db.query(Review).filter_by(target_kind="MATCH", target_id=m.candidate_id).order_by(Review.created_at.desc()).first()
        reviews.append({
            "candidate_id": m.candidate_id, "state": m.state,
            "left": l_ent.label if l_ent else "", "right": r_ent.label if r_ent else "",
            "confidence": m.confidence,
            "reviewer": last_rev.reviewer_id if last_rev else None,
            "decided_at": last_rev.created_at.isoformat() if last_rev else None,
        })

    # Relationships (masked)
    rels = sorted(edges, key=lambda e: -e.get("count", 0))[:40]
    for e in rels:
        e["source"] = mask_label(*_entity_kind_label(db, e.get("source", "")))
        e["target"] = mask_label(*_entity_kind_label(db, e.get("target", "")))
        e.pop("claim_ids", None)

    analysis = graph_svc.analyze(G)
    for key in ("degree", "weighted_degree", "bridge_candidates"):
        for item in analysis.get(key, []):
            item["label"] = mask_label(item.get("kind", ""), item.get("label", ""))

    # Most-recent anchor
    latest_anchor = (db.query(integrity_svc.LedgerAnchor)
                       .filter_by(case_id=case_id)
                       .order_by(integrity_svc.LedgerAnchor.created_at.desc())
                       .first())
    leaf_hashes = _get_case_evidence_hashes(db, case_id)
    merkle_root_val = integrity_svc.merkle_root(leaf_hashes) if leaf_hashes else None

    aud = record_audit(db, request.state.trace_id, user.user_id, "COURT_PDF_EXPORT", "CASE", case_id, case_id,
                       detail={"snapshot_id": snap.snapshot_id, "has_anchor": latest_anchor is not None})
    db.flush()

    evidence_list = [evidence_out(e) for e in db.query(Evidence).filter_by(case_id=case_id).all()]
    case_dict = case_out(case, db)

    pdf_bytes = generate_court_pdf(
        case=case_dict,
        evidence_list=evidence_list,
        reviews=reviews,
        relationships=rels,
        analysis=analysis,
        merkle_root=merkle_root_val,
        ledger_anchor=_anchor_out(latest_anchor) if latest_anchor else None,
        graph_snapshot_id=f"{snap.snapshot_id} ({snap_hash[:16]})",
        analyst_comments=body.analyst_comments,
        generated_by=user.username,
        trace_id=request.state.trace_id,
    )

    db.add(Snapshot(case_id=case_id, kind="REPORT", content_hash=snap_hash, created_by=user.user_id,
                    payload={"audit_id": aud.audit_id, "format": "court_pdf"}))
    db.commit()

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="dristinet-court-dossier-{case_id}.pdf"',
                 "X-Trace-Id": request.state.trace_id,
                 "X-Merkle-Root": merkle_root_val or ""},
    )


def _entity_kind_label(db: Session, entity_id: str):
    ent = db.get(Entity, entity_id)
    if ent:
        return ent.kind, ent.label
    return "", entity_id
