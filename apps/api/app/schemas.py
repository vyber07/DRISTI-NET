from __future__ import annotations

from pydantic import BaseModel, Field


class LoginIn(BaseModel):
    username: str
    password: str


class CaseIn(BaseModel):
    case_id: str = Field(pattern=r"^[A-Z0-9-]{4,32}$")
    title: str
    jurisdiction: str
    purpose: str
    authority_reference: str
    classification: str = "SYNTHETIC_DEMO"
    sensitivity: str = "RESTRICTED"
    opened_at: str = "2025-01-01"


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
    window: int = 2

class ReportIn(BaseModel):
    analyst_comments: str = ""
    format: str = Field(default="json", pattern=r"^(json|html)$")


class CourtPdfIn(BaseModel):
    """Request body for the court-ready PDF dossier endpoint."""
    analyst_comments: str = ""
