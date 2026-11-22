from __future__ import annotations

from pydantic import BaseModel, Field

from .models import ROLES

_ROLE_PATTERN = "^(" + "|".join(ROLES) + ")$"


# ---------------------------------------------------------------------------
# Output schemas — these mirror the dict shapes returned by helper functions
# in route files (case_out, evidence_out, etc.). Adding response_model= to
# a route makes FastAPI validate and document the response shape without
# changing what the route actually returns.
# ---------------------------------------------------------------------------

class CasePersonOut(BaseModel):
    user_id: str
    display_name: str
    role: str
    purpose: str
    is_owner: bool


class CaseOut(BaseModel):
    case_id: str
    title: str
    jurisdiction: str
    purpose: str
    authority_reference: str
    classification: str
    sensitivity: str
    owner_id: str
    opened_at: str
    assigned: list[str]
    people: list[CasePersonOut]
    evidence_count: int
    pending_reviews: int


class JobOut(BaseModel):
    job_id: str
    kind: str
    status: str
    attempts: int
    trace_id: str | None = None
    error: str | None = None
    metrics: dict | None = None


class EvidenceOut(BaseModel):
    evidence_id: str
    case_id: str
    version: int
    filename: str | None = None
    extension: str | None = None
    detected_type: str | None = None
    record_type: str | None = None
    size_bytes: int
    sha256: str
    status: str
    storage_area: str
    source_label: str | None = None
    uploaded_by: str
    scan_engine: str | None = None
    scan_result: str | None = None
    error: str | None = None
    retention_policy: str | None = None
    legal_hold: bool
    tombstoned: bool
    created_at: str
    updated_at: str
    classification: str
    jurisdiction: str
    purpose: str
    access_class: str  # sensitivity label string, e.g. "RESTRICTED" or "SENSITIVE"
    authority_reference: str
    # Optional — present when fetched individually (evidence_out(ev, db))
    jobs: list[JobOut] | None = None
    claim_count: int | None = None


# ---------------------------------------------------------------------------
# Input schemas
# ---------------------------------------------------------------------------

class LoginIn(BaseModel):
    username: str
    password: str


def _today() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).date().isoformat()


class CaseIn(BaseModel):
    case_id: str = Field(pattern=r"^[A-Z0-9-]{4,32}$")
    # Required text must say something: a case without an authority reference or purpose is not an authorized case
    # (docs/context.md §6 "Authorized case created"). Previously blank strings were accepted.
    title: str = Field(min_length=3, max_length=200, pattern=r"\S")
    jurisdiction: str = Field(min_length=2, max_length=120, pattern=r"\S")
    purpose: str = Field(min_length=3, max_length=500, pattern=r"\S")
    authority_reference: str = Field(min_length=3, max_length=120, pattern=r"\S")
    classification: str = "SYNTHETIC_DEMO"
    sensitivity: str = "RESTRICTED"
    # was a fixed "2025-01-01", so every new case claimed to have been opened on that date
    opened_at: str = Field(default_factory=_today, pattern=r"^\d{4}-\d{2}-\d{2}$")


class AssignIn(BaseModel):
    username: str
    purpose: str = "investigation"





class DecisionIn(BaseModel):
    decision: str = Field(pattern=r"^(APPROVE|REJECT|DEFER|REVERSE|STALE|CONTRADICTORY)$")
    reason: str = Field(min_length=3, max_length=2000)


class RevealIn(BaseModel):
    case_id: str
    reason: str = Field(min_length=5, max_length=500)


class ContextRevealIn(BaseModel):
    reason: str = Field(min_length=5, max_length=500)
    row: int | None = None
    page: int | None = None
    line: int | None = None
    json_path: str | None = None
    window: int = Field(default=2, ge=0, le=10)  # DEF-046: unbounded window unmasked a whole file in one call

class DownloadIn(BaseModel):
    """Reason for downloading unmasked raw evidence; recorded in the audit log (DEF-101)."""
    reason: str = Field(min_length=5, max_length=500)

class ReportIn(BaseModel):
    analyst_comments: str = ""
    format: str = Field(default="json", pattern=r"^(json|html)$")


class CourtPdfIn(BaseModel):
    """Request body for the integrity-reference PDF dossier endpoint."""
    analyst_comments: str = ""


class UserCreateIn(BaseModel):
    username: str = Field(min_length=3, max_length=40, pattern=r"^[a-z0-9_.-]+$")
    display_name: str = Field(min_length=2, max_length=120, pattern=r"\S")
    role: str = Field(pattern=_ROLE_PATTERN)
    jurisdiction: str = Field(default="", max_length=120)
    password: str = Field(min_length=8, max_length=200)


class UserUpdateIn(BaseModel):
    """Partial update — only the fields given are changed."""
    display_name: str | None = Field(default=None, min_length=2, max_length=120, pattern=r"\S")
    role: str | None = Field(default=None, pattern=_ROLE_PATTERN)
    jurisdiction: str | None = Field(default=None, max_length=120)


class PasswordResetIn(BaseModel):
    new_password: str = Field(min_length=8, max_length=200)
