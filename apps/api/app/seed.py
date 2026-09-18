"""Seed demo users and the two synthetic cases. Idempotent. Run: python -m apps.api.app.seed [--ingest]

--ingest additionally uploads the synthetic files through the same pipeline the UI uses, so a fresh clone can
reach the review/graph screens immediately.
"""
from __future__ import annotations

import sys
import json

from . import config
from .auth import hash_password
from .db import Base, SessionLocal, engine
from .models import Case, CaseAssignment, User

DEMO_USERS = [
    # username, display name, role, jurisdiction, password  (demo credentials — fictional)
    ("investigator", "Investigator Asha (demo)", "INVESTIGATOR", "Demo District A", "investigator-demo"),
    ("officer", "Evidence Officer Ravi (demo)", "EVIDENCE_OFFICER", "Demo District A", "officer-demo"),
    ("reviewer", "Reviewer Meera (demo)", "REVIEWER", "Demo District A", "reviewer-demo"),
    ("analyst", "Analyst Karan (demo)", "ANALYST", "Demo District A", "analyst-demo"),
    ("auditor", "Auditor Leela (demo)", "AUDITOR", "Demo District A", "auditor-demo"),
    ("admin", "Administrator (demo)", "ADMIN", "Demo District A", "admin-demo"),
    ("outsider", "Investigator Nikhil (demo, District B)", "INVESTIGATOR", "Demo District B", "outsider-demo"),
    ("unassigned", "Investigator Priya (demo, not on CASE-0001)", "INVESTIGATOR", "Demo District A", "unassigned-demo"),
]
ASSIGN = {"CASE-0001": ["investigator", "officer", "reviewer", "analyst"], "CASE-0002": ["investigator", "officer", "reviewer", "unassigned"]}


def seed() -> None:
    if config.DATABASE_URL.startswith("sqlite"):
        Base.metadata.create_all(engine)
    db = SessionLocal()
    users = {}
    for username, name, role, jur, pw in DEMO_USERS:
        u = db.query(User).filter_by(username=username).first()
        if u is None:
            u = User(username=username, display_name=name, role=role, jurisdiction=jur, password_hash=hash_password(pw))
            db.add(u)
            db.flush()
        users[username] = u

    cases_added = []
    for c in json.loads((config.SYNTHETIC_DIR / "cases.json").read_text()):
        cases_added.append(c["case_id"])
        case = db.get(Case, c["case_id"])
        if case is None:
            case = Case(**c, owner_id=users["investigator"].user_id)
            db.add(case)
            db.flush()
        
        # Give access to everyone in ASSIGN by default, or just investigator/officer/reviewer/analyst
        assignees = ASSIGN.get(c["case_id"], ["investigator", "officer", "reviewer", "analyst"])
        for uname in assignees:
            if not db.query(CaseAssignment).filter_by(case_id=c["case_id"], user_id=users[uname].user_id).first():
                db.add(CaseAssignment(case_id=c["case_id"], user_id=users[uname].user_id))
    db.commit()
    print("seeded cases:", len(cases_added))



def ingest() -> None:
    """Push the synthetic files through the real API (same code path as the UI)."""
    from fastapi.testclient import TestClient
    from .main import app

    client = TestClient(app)
    tok = client.post("/api/v1/auth/login", json={"username": "officer", "password": "officer-demo"}).json()["token"]
    h = {"Authorization": f"Bearer {tok}"}
    plan = [("CASE-0001", "people.json"), ("CASE-0001", "aliases.json"), ("CASE-0001", "calls.csv"), ("CASE-0001", "transactions.csv"),
            ("CASE-0001", "vehicles.csv"), ("CASE-0001", "locations.csv"), ("CASE-0001", "documents/fir_001.pdf"), ("CASE-0002", "transactions_case2.csv")]
    for case_id, rel in plan:
        p = config.SYNTHETIC_DIR / rel
        r = client.post(f"/api/v1/cases/{case_id}/evidence", headers=h, files={"file": (p.name, p.read_bytes())}, data={"source_label": "synthetic"})
        d = r.json()
        print(f"{case_id} {p.name:24s} → {d.get('status', r.status_code)}  claims={d.get('claim_count')}  {d.get('evidence_id')}")


if __name__ == "__main__":
    seed()
    if "--ingest" in sys.argv:
        ingest()
