"""Case responses name the people on the case (added for the frontend redesign, so the UI stops showing raw USR- IDs)."""


def test_case_lists_assigned_people_by_name(client, investigator):
    case = client.get("/api/v1/cases/CASE-0001", headers=investigator).json()
    people = case["people"]
    assert {p["user_id"] for p in people} == set(case["assigned"])
    owner = [p for p in people if p["is_owner"]]
    assert len(owner) == 1 and owner[0]["user_id"] == case["owner_id"]
    assert all(p["display_name"] and p["role"] for p in people)
    # Only identity fields: nothing about credentials, and only this case's members.
    # org_user_id: the organisational user ID (ADR-019), an identifier like user_id, not a credential.
    assert all(set(p) == {"user_id", "org_user_id", "display_name", "role", "purpose", "is_owner"} for p in people)
    names = {p["display_name"] for p in people}
    assert not any("not on CASE-0001" in n for n in names), "unassigned users must not appear"


def test_case_people_not_returned_to_a_user_without_access(client, unassigned):
    r = client.get("/api/v1/cases/CASE-0001", headers=unassigned)
    assert r.status_code == 403 and "people" not in r.text
