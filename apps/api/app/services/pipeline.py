"""Evidence processing pipeline (runs in-process for the prototype; each stage is a Job row so it can be
moved behind Kafka/Redpanda workers later without changing the state machine).

UPLOADED → HASHED → QUARANTINED → MALWARE_SCANNING → CLEAN → ACCEPTED → PROCESSING → EXTRACTED
         → ENTITY_CANDIDATES → HITL (if any match candidates) → GRAPH_PROJECTED → ACTIVE

Any non-CLEAN scan result leaves the file in quarantine (status = the scan result, path unchanged).
"""
from __future__ import annotations

import traceback

from sqlalchemy.orm import Session

from ..models import BLOCKED_STATES, Evidence, Job, MatchCandidate


class IntegrityMismatch(RuntimeError):
    pass
from . import extract as extract_svc
from . import resolution, scanner, storage
from .audit import record_audit


def _job(db: Session, ev: Evidence, kind: str, trace_id: str) -> Job:
    key = f"{ev.evidence_id}:{kind}"
    job = db.query(Job).filter_by(idempotency_key=key).first()
    if job is None:
        job = Job(evidence_id=ev.evidence_id, case_id=ev.case_id, kind=kind, trace_id=trace_id, idempotency_key=key, attempts=0, metrics={})
        db.add(job)
    job.attempts += 1
    job.status = "RUNNING"
    job.error = None
    job.trace_id = trace_id
    db.flush()
    return job


def run_scan(db: Session, ev: Evidence, trace_id: str, actor_id: str | None) -> bool:
    job = _job(db, ev, "SCAN", trace_id)
    ev.status = "MALWARE_SCANNING"
    db.commit()
    with storage.local_copy(ev.storage_path) as local_path:
        outcome = scanner.scan_file(local_path)
    ev.scan_engine, ev.scan_result = outcome.engine, outcome.result
    ev.status = outcome.result
    job.metrics = {"engine": outcome.engine, "detail": outcome.detail}
    record_audit(db, trace_id, actor_id, "SCAN_RESULT", "EVIDENCE", ev.evidence_id, ev.case_id,
                 outcome="OK" if outcome.is_clean else "BLOCKED", detail={"result": outcome.result, "engine": outcome.engine, "detail": outcome.detail})
    if not outcome.is_clean:
        job.status = "FAILED" if outcome.result != "INFECTED" else "SUCCEEDED"  # the scan itself worked when INFECTED
        job.error = f"{outcome.result}: {outcome.detail}"
        ev.error = f"file remains in quarantine: {outcome.result}"
        db.commit()
        return False
    job.status = "SUCCEEDED"
    ev.storage_path = storage.promote_to_accepted(ev.storage_path)
    ev.status = "ACCEPTED"
    ev.error = None
    db.commit()
    return True


def run_extract(db: Session, ev: Evidence, trace_id: str, actor_id: str | None) -> bool:
    if ev.status not in ("ACCEPTED", "EXTRACTION_FAILED"):
        raise ValueError(f"evidence {ev.evidence_id} is {ev.status}; extraction requires ACCEPTED")
    job = _job(db, ev, "EXTRACT", trace_id)
    ev.status = "PROCESSING"
    db.commit()
    try:
        ok, actual = storage.verify_hash(ev.storage_path, ev.sha256)
        if not ok:
            raise IntegrityMismatch(f"hash mismatch before extraction: manifest {ev.sha256[:12]}… actual {actual[:12]}…")
        data = storage.read_bytes(ev.storage_path)
        stats = extract_svc.extract(db, ev, data)
        job.metrics = stats.__dict__
        job.status = "SUCCEEDED"
        ev.status = "EXTRACTED"
        record_audit(db, trace_id, actor_id, "EXTRACTED", "EVIDENCE", ev.evidence_id, ev.case_id, detail=stats.__dict__)
        db.commit()
        return True
    except Exception as exc:  # parser failure must be visible, never silent
        db.rollback()
        job = _job(db, ev, "EXTRACT", trace_id)
        job.attempts -= 1
        job.status = "FAILED"
        job.error = f"{type(exc).__name__}: {exc}\n{traceback.format_exc()[-800:]}"
        mismatch = isinstance(exc, IntegrityMismatch)
        ev.status = "INTEGRITY_MISMATCH" if mismatch else "EXTRACTION_FAILED"
        ev.error = f"{type(exc).__name__}: {exc}"
        record_audit(db, trace_id, actor_id, "INTEGRITY_MISMATCH" if mismatch else "EXTRACTION_FAILED", "EVIDENCE", ev.evidence_id, ev.case_id, outcome="ERROR", detail={"error": str(exc)})
        db.commit()
        return False


def run_resolve(db: Session, ev: Evidence, trace_id: str, actor_id: str | None) -> int:
    job = _job(db, ev, "RESOLVE", trace_id)
    ev.status = "ENTITY_CANDIDATES"
    db.commit()
    created = resolution.generate_candidates(db, ev.case_id)
    job.metrics = {"candidates_created": len(created)}
    job.status = "SUCCEEDED"
    pending = db.query(MatchCandidate).filter_by(case_id=ev.case_id, state="REVIEW_REQUIRED").count()
    ev.status = "HITL" if pending else "GRAPH_PROJECTED"
    record_audit(db, trace_id, actor_id, "CANDIDATES_GENERATED", "EVIDENCE", ev.evidence_id, ev.case_id, detail={"created": len(created), "pending_review": pending})
    db.commit()
    return len(created)


def process_evidence(db: Session, evidence_id: str, trace_id: str, actor_id: str | None) -> Evidence:
    ev = db.get(Evidence, evidence_id)
    if ev is None:
        raise ValueError("unknown evidence")
    if ev.status in BLOCKED_STATES:
        raise ValueError(f"evidence {evidence_id} is {ev.status}; it cannot re-enter processing")
    if ev.status in ("QUARANTINED", "SCAN_FAILED", "SCAN_TIMEOUT", "SCANNER_UNAVAILABLE"):
        if not run_scan(db, ev, trace_id, actor_id):
            return ev
    if ev.status in ("ACCEPTED", "EXTRACTION_FAILED"):
        if not run_extract(db, ev, trace_id, actor_id):
            return ev
    if ev.status == "EXTRACTED":
        run_resolve(db, ev, trace_id, actor_id)
    return ev


def mark_active(db: Session, case_id: str) -> None:
    """Once no candidates are pending, extracted evidence in the case becomes ACTIVE in the projection."""
    pending = db.query(MatchCandidate).filter_by(case_id=case_id, state="REVIEW_REQUIRED").count()
    for ev in db.query(Evidence).filter(Evidence.case_id == case_id, Evidence.status.in_(["HITL", "GRAPH_PROJECTED", "ACTIVE"])).all():
        ev.status = "HITL" if pending else "ACTIVE"
