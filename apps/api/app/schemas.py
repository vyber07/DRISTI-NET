from __future__ import annotations

from pydantic import BaseModel, Field


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
