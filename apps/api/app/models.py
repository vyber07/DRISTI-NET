"""Authoritative state for the prototype (PostgreSQL in the target architecture, SQLite here).

The graph is a *projection* of Claim/Review rows and can always be rebuilt from them.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base

# ----------------------------------------------------------------------------- shared vocab
ROLES = ("INVESTIGATOR", "EVIDENCE_OFFICER", "REVIEWER", "ANALYST", "AUDITOR", "ADMIN")

EVIDENCE_STATES = (
    "UPLOADED", "HASHED", "QUARANTINED", "MALWARE_SCANNING",
    "CLEAN", "INFECTED", "SCAN_FAILED", "SCAN_TIMEOUT", "SCANNER_UNAVAILABLE",
    "ACCEPTED", "PROCESSING", "EXTRACTED", "ENTITY_CANDIDATES", "HITL", "GRAPH_PROJECTED", "ACTIVE",
    "EXTRACTION_FAILED", "INTEGRITY_MISMATCH", "REJECTED", "STALE", "TOMBSTONED",
)
# Terminal-for-processing states: nothing may be (re)processed out of these without an explicit investigation step.
BLOCKED_STATES = {"INFECTED", "INTEGRITY_MISMATCH", "REJECTED", "TOMBSTONED"}
NON_CLEAN_SCAN_STATES = {"INFECTED", "SCAN_FAILED", "SCAN_TIMEOUT", "SCANNER_UNAVAILABLE"}

REVIEW_STATES = ("REVIEW_REQUIRED", "APPROVE", "REJECT", "DEFER", "REVERSE", "STALE", "CONTRADICTORY")
# ALLOWED = deterministic structured-record claim that policy admits into the projection without a merge decision.
CLAIM_STATES = ("ALLOWED",) + REVIEW_STATES

ENTITY_KINDS = ("PERSON", "ORGANIZATION", "PHONE", "ACCOUNT", "VEHICLE", "LOCATION", "DEVICE", "EVENT", "CASE")
SENSITIVE_KINDS = {"PHONE", "ACCOUNT"}  # masked by default


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ----------------------------------------------------------------------------- users & cases
class User(Base):
    __tablename__ = "users"
    user_id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("USR"))
    username: Mapped[str] = mapped_column(String, unique=True)
    display_name: Mapped[str] = mapped_column(String)
    role: Mapped[str] = mapped_column(String)
    jurisdiction: Mapped[str] = mapped_column(String)
    password_hash: Mapped[str] = mapped_column(String)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Case(Base):
    __tablename__ = "cases"
    case_id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String)
    jurisdiction: Mapped[str] = mapped_column(String)
    purpose: Mapped[str] = mapped_column(String)
    classification: Mapped[str] = mapped_column(String, default="SYNTHETIC_DEMO")
    sensitivity: Mapped[str] = mapped_column(String, default="RESTRICTED")
    # The legal instrument (FIR number, warrant, court order reference -- fictional in this dataset)
    # that authorizes collecting evidence under this case (docs/context.md §10.3 edge property
    # "authority_reference"). Required at creation: a case with no stated legal basis has no business
    # being open.
    authority_reference: Mapped[str] = mapped_column(String)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.user_id"))
    opened_at: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    assignments: Mapped[list["CaseAssignment"]] = relationship(back_populates="case", cascade="all, delete-orphan")


class CaseAssignment(Base):
    __tablename__ = "case_assignments"
    __table_args__ = (UniqueConstraint("case_id", "user_id"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.case_id"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.user_id"))
    purpose: Mapped[str] = mapped_column(String, default="investigation")
    case: Mapped[Case] = relationship(back_populates="assignments")


# ----------------------------------------------------------------------------- evidence & jobs
class Evidence(Base):
    __tablename__ = "evidence"
    __table_args__ = (UniqueConstraint("case_id", "sha256", name="uix_evidence_case_sha"),)
    evidence_id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("EVD"))
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.case_id"), index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    filename: Mapped[str] = mapped_column(String)
    extension: Mapped[str] = mapped_column(String)
    detected_type: Mapped[str] = mapped_column(String)
    size_bytes: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String, index=True)
    status: Mapped[str] = mapped_column(String, default="UPLOADED")
    storage_path: Mapped[str] = mapped_column(String)          # relative to STORAGE_ROOT
    source_label: Mapped[str] = mapped_column(String, default="synthetic")
    record_type: Mapped[str] = mapped_column(String, default="unknown")  # calls|transactions|people|aliases|vehicles|locations|fir|text
    uploaded_by: Mapped[str] = mapped_column(ForeignKey("users.user_id"))
    # Mirrored from the owning Case at upload time (docs/context.md §9.2's Evidence record contract).
    # Deliberately a snapshot, not a live join: an evidence item's own classification/jurisdiction/purpose/
    # access_class must stay fixed to what it was governed by when it was accepted into the case, even if
    # the case's own classification changes later -- an evidentiary record shouldn't retroactively change
    # the rules it was collected under. access_class mirrors Case.sensitivity (same RESTRICTED/SENSITIVE
    # vocabulary Entity already uses).
    classification: Mapped[str] = mapped_column(String, default="SYNTHETIC_DEMO")
    jurisdiction: Mapped[str] = mapped_column(String, default="")
    purpose: Mapped[str] = mapped_column(String, default="")
    access_class: Mapped[str] = mapped_column(String, default="RESTRICTED")
    authority_reference: Mapped[str] = mapped_column(String, default="")
    scan_engine: Mapped[str | None] = mapped_column(String, nullable=True)
    scan_result: Mapped[str | None] = mapped_column(String, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    retention_policy: Mapped[str] = mapped_column(String, default="demo-30d")
    legal_hold: Mapped[bool] = mapped_column(Boolean, default=False)
    tombstoned: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class Job(Base):
    __tablename__ = "jobs"
    job_id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("JOB"))
    evidence_id: Mapped[str] = mapped_column(ForeignKey("evidence.evidence_id"), index=True)
    case_id: Mapped[str] = mapped_column(String, index=True)
    kind: Mapped[str] = mapped_column(String)  # SCAN | EXTRACT | RESOLVE | PROJECT
    status: Mapped[str] = mapped_column(String, default="QUEUED")  # QUEUED RUNNING SUCCEEDED FAILED
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    trace_id: Mapped[str] = mapped_column(String)
    idempotency_key: Mapped[str] = mapped_column(String, unique=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    metrics: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


# ----------------------------------------------------------------------------- entities, claims, provenance
class Entity(Base):
    """A POLE+ node. Global across cases so cross-case appearances can be discovered."""
    __tablename__ = "entities"
    __table_args__ = (UniqueConstraint("kind", "canonical"),)
    entity_id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("ENT"))
    kind: Mapped[str] = mapped_column(String, index=True)
    label: Mapped[str] = mapped_column(String)
    canonical: Mapped[str] = mapped_column(String, index=True)     # normalized identity key within the kind
    attributes: Mapped[dict] = mapped_column(JSON, default=dict)
    access_class: Mapped[str] = mapped_column(String, default="RESTRICTED")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Claim(Base):
    """A machine-extracted assertion: an entity mention, an attribute, or a typed relationship."""
    __tablename__ = "claims"
    claim_id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("CLM"))
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.case_id"), index=True)
    evidence_id: Mapped[str] = mapped_column(ForeignKey("evidence.evidence_id"), index=True)
    kind: Mapped[str] = mapped_column(String)                        # MENTION | ATTRIBUTE | RELATIONSHIP
    rel_type: Mapped[str | None] = mapped_column(String, nullable=True)   # CALLED, TRANSFERRED_TO, USES_PHONE, OWNS_VEHICLE, MEMBER_OF, APPEARS_IN, OBSERVED_AT, NAMED_IN ...
    source_entity_id: Mapped[str] = mapped_column(ForeignKey("entities.entity_id"), index=True)
    target_entity_id: Mapped[str | None] = mapped_column(ForeignKey("entities.entity_id"), nullable=True, index=True)
    attribute: Mapped[str | None] = mapped_column(String, nullable=True)
    original_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    normalized_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    observed_time: Mapped[str | None] = mapped_column(String, nullable=True)   # ISO string as recorded in the source
    valid_from: Mapped[str | None] = mapped_column(String, nullable=True)
    valid_to: Mapped[str | None] = mapped_column(String, nullable=True)
    method: Mapped[str] = mapped_column(String)                      # structured-parser | regex-ner | pdf-text
    method_version: Mapped[str] = mapped_column(String, default="0.1.0")
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    missingness: Mapped[dict] = mapped_column(JSON, default=dict)    # {"amount_inr": "missing in source"}
    state: Mapped[str] = mapped_column(String, default="ALLOWED")    # CLAIM_STATES
    flags: Mapped[dict] = mapped_column(JSON, default=dict)          # {"contradicts": [claim_id...], "supernode": true}
    weight: Mapped[float] = mapped_column(Float, default=1.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Provenance(Base):
    __tablename__ = "provenance"
    provenance_id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("PRV"))
    claim_id: Mapped[str] = mapped_column(ForeignKey("claims.claim_id"), index=True)
    evidence_id: Mapped[str] = mapped_column(ForeignKey("evidence.evidence_id"), index=True)
    locator: Mapped[dict] = mapped_column(JSON, default=dict)   # {"row": 12, "column": "caller"} | {"page": 1, "line": 9, "char_offset": 120} | {"json_path": "$[3].phone"}
    snippet: Mapped[str | None] = mapped_column(Text, nullable=True)
    method: Mapped[str] = mapped_column(String)
    method_version: Mapped[str] = mapped_column(String, default="0.1.0")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


# ----------------------------------------------------------------------------- entity resolution & review
class MatchCandidate(Base):
    """A proposal that two entity records may refer to the same real-world entity. Never auto-merged."""
    __tablename__ = "match_candidates"
    candidate_id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("MCH"))
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.case_id"), index=True)
    left_entity_id: Mapped[str] = mapped_column(ForeignKey("entities.entity_id"))
    right_entity_id: Mapped[str] = mapped_column(ForeignKey("entities.entity_id"))
    block_key: Mapped[str] = mapped_column(String)
    positive_signals: Mapped[list] = mapped_column(JSON, default=list)
    counter_evidence: Mapped[list] = mapped_column(JSON, default=list)
    conflicts: Mapped[list] = mapped_column(JSON, default=list)
    missing: Mapped[list] = mapped_column(JSON, default=list)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    matcher_version: Mapped[str] = mapped_column(String, default="0.1.0")
    state: Mapped[str] = mapped_column(String, default="REVIEW_REQUIRED")
    evidence_ids: Mapped[list] = mapped_column(JSON, default=list)
    assigned_to: Mapped[str | None] = mapped_column(ForeignKey("users.user_id"), nullable=True)
    assigned_at: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Review(Base):
    __tablename__ = "reviews"
    review_id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("REV"))
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.case_id"), index=True)
    target_kind: Mapped[str] = mapped_column(String)   # MATCH | CLAIM
    target_id: Mapped[str] = mapped_column(String, index=True)
    decision: Mapped[str] = mapped_column(String)      # APPROVE REJECT DEFER REVERSE STALE CONTRADICTORY
    reason: Mapped[str] = mapped_column(Text)
    reviewer_id: Mapped[str] = mapped_column(ForeignKey("users.user_id"))
    supersedes_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


# ----------------------------------------------------------------------------- audit & snapshots
class AuditEvent(Base):
    __tablename__ = "audit_events"
    audit_id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("AUD"))
    trace_id: Mapped[str] = mapped_column(String, index=True)
    actor_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    action: Mapped[str] = mapped_column(String, index=True)   # LOGIN, CASE_VIEW, ACCESS_DENIED, EVIDENCE_UPLOAD, SCAN_RESULT, REVIEW_DECISION, UNMASK, EXPORT, ...
    target_kind: Mapped[str | None] = mapped_column(String, nullable=True)
    target_id: Mapped[str | None] = mapped_column(String, nullable=True)
    case_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    outcome: Mapped[str] = mapped_column(String)              # OK | DENIED | ERROR
    detail: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    signature: Mapped[str | None] = mapped_column(String, nullable=True)


class Snapshot(Base):
    __tablename__ = "snapshots"
    snapshot_id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("SNP"))
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.case_id"), index=True)
    kind: Mapped[str] = mapped_column(String)   # GRAPH | REPORT
    content_hash: Mapped[str] = mapped_column(String)
    created_by: Mapped[str] = mapped_column(String)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
