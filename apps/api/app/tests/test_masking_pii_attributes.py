"""Personal attributes (address, date of birth) must not appear raw in any non-reveal response.

Raw values come from the database (entity attributes for CASE-0001). Each response is scanned for the full value. The
explicit attribute-reveal endpoint is excluded: it is tested in test_masking_authorization.py.
"""
from apps.api.app.db import SessionLocal
from apps.api.app.models import Entity
from apps.api.app.services.masking import case_attributes
from apps.api.app.tests.test_masking_sweep import ROLES, _read_paths, _report_posts, _token

PII_KEYS = ("address", "dob")


def _raw_pii_values():
    values = set()
    with SessionLocal() as s:
        for e in s.query(Entity).all():
            for key, value in case_attributes(e.attributes, "CASE-0001").items():
                if key in PII_KEYS and isinstance(value, str) and len(value) >= 8:
                    values.add(value)
    return sorted(values, key=len, reverse=True)


def test_synthetic_case_has_pii_to_protect(ingested):
    assert _raw_pii_values(), "the sweep must have real address/dob values to look for"


def test_no_raw_address_or_dob_in_any_non_reveal_response(client, ingested):
    values = _raw_pii_values()
    leaks = {}
    for role in ROLES:
        token = _token(client, role)
        for path, resp in _read_paths(client, token) + _report_posts(client, token):
            for raw in values:
                if raw in resp.text:
                    leaks.setdefault(path, set()).add(role)
                    break
    detail = "\n".join(f"{path}: visible raw to {sorted(roles)}" for path, roles in sorted(leaks.items()))
    assert not leaks, "raw personal attributes in responses:\n" + detail
