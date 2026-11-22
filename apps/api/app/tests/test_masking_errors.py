"""Error responses, logs and metadata must not carry the sensitive values that were sent in.

FastAPI's default 422 response repeats the rejected input, so an oversized login password would come back in the body.
"""
import pytest

PASSWORD_MARKER = "SECRETMARK-7f3a9c-do-not-echo"


def test_oversized_password_is_not_echoed_in_validation_error(client):
    r = client.post("/api/v1/auth/login", json={"username": "investigator", "password": PASSWORD_MARKER + "x" * 1100})
    assert r.status_code == 422
    assert PASSWORD_MARKER not in r.text
    assert "x" * 50 not in r.text


def test_oversized_username_is_not_echoed_in_validation_error(client):
    marker = "PHONE-MARK-91234567890"
    r = client.post("/api/v1/auth/login", json={"username": marker + "u" * 300, "password": "pw"})
    assert r.status_code == 422
    assert marker not in r.text


@pytest.mark.parametrize("path", ["/api/v1/cases/CASE-0001/evidence?limit=abc", "/api/v1/audit?limit=abc"])
def test_query_validation_errors_do_not_echo_input_secret(client, path):
    marker = "QUERY-SECRET-MARK-55"
    r = client.get(path.replace("abc", marker))
    assert marker not in r.text
