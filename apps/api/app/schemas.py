from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

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
    org_user_id: str | None = None   # organisational user ID (services/org_user_ids.py); None = not allocated
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
    # Bounds match config.LOGIN_USERNAME_MAX_LEN / LOGIN_PASSWORD_MAX_LEN. Oversized input is refused
    # before any hashing, so it cannot be used as a CPU-exhaustion lever.
    username: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=1, max_length=1024)


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


class AttributeRevealIn(BaseModel):
    """Reveal one masked personal attribute of an entity, for one case, with a recorded reason."""
    case_id: str = Field(max_length=64)
    key: str = Field(pattern=r"^(address|dob|phone|account)$")
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
    # Verified organisational office code, e.g. "OFF-DDA". Assigned by an administrator; audit records read it from the user row.
    office_id: str | None = Field(default=None, pattern=r"^[A-Z0-9][A-Z0-9-]{1,31}$")
    password: str = Field(min_length=8, max_length=200)
    # Organisational user ID (optional). Normalised and checked by services/org_user_ids.normalize; omitted = allocate
    # later through PUT /users/{id}/org-user-id.
    org_user_id: str | None = Field(default=None, max_length=64)


class UserUpdateIn(BaseModel):
    """Partial update — only the fields given are changed. Unknown fields are refused (422), so an attempt to change
    the organisational user ID here fails loudly instead of being ignored: that goes through its own audited route."""
    model_config = ConfigDict(extra="forbid")
    display_name: str | None = Field(default=None, min_length=2, max_length=120, pattern=r"\S")
    role: str | None = Field(default=None, pattern=_ROLE_PATTERN)
    jurisdiction: str | None = Field(default=None, max_length=120)
    # Empty string clears the office; otherwise the same format as UserCreateIn.office_id.
    office_id: str | None = Field(default=None, pattern=r"^([A-Z0-9][A-Z0-9-]{1,31})?$")


class OrgUserIdAssignIn(BaseModel):
    """PUT /users/{id}/org-user-id. current_org_user_id is required (null = "I expect no ID"): the change applies only
    if it still matches, so two administrators cannot overwrite each other's change."""
    model_config = ConfigDict(extra="forbid")
    org_user_id: str = Field(max_length=64)
    current_org_user_id: str | None = Field(max_length=64)
    reason: str = Field(max_length=500)
    # True only to fix an ID assigned in error, within DRISHTI_ORG_USER_ID_CORRECTION_HOURS: the old ID is VOIDED
    # (free for its rightful holder) instead of RETIRED (never reusable).
    correction: bool = False


class OrgUserIdRetireIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    current_org_user_id: str | None = Field(max_length=64)
    reason: str = Field(max_length=500)


class PasswordResetIn(BaseModel):
    new_password: str = Field(min_length=8, max_length=200)
