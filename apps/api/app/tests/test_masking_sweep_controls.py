"""Stronger leak checks and a positive control for the sweep in test_masking_sweep.py.

The positive control matters: a sweep that never sees a raw value proves nothing. The raw download is the one route
meant to return original bytes (authorized investigator, with a reason, audited), so it must register as a hit.
"""
from apps.api.app.tests.test_masking_sweep import ROLES, _raw_sensitive_labels, _read_paths, _report_posts, _token


def _digits(text: str) -> str:
    return "".join(ch for ch in text if ch.isdigit())


def test_no_sensitive_digit_run_in_any_non_reveal_response(client, ingested):
    """Catches a raw number written with different separators (e.g. '+91 98765-43210'), which a literal check misses."""
    labels = _raw_sensitive_labels()
    # The FULL digit sequence of each sensitive number (12 digits for a phone with its country code). Shorter runs
    # coincide with timestamps and hex hashes; a full-length run almost never does.
    cores = {_digits(raw) for raw in labels if len(_digits(raw)) >= 10}
    assert cores, "synthetic case must contain sensitive numbers"
    leaks = []
    for role in ROLES:
        token = _token(client, role)
        for path, resp in _read_paths(client, token) + _report_posts(client, token):
            digits = _digits(resp.text)
            if any(core in digits for core in cores):
                leaks.append(f"{role}: {path} contains the full digit sequence of a sensitive identifier")
    assert not leaks, "\n".join(sorted(set(leaks))[:60])


def test_positive_control_raw_download_exposes_the_values(client, ingested):
    labels = _raw_sensitive_labels()
    token = _token(client, "investigator")
    eid = ingested["calls.csv"]["evidence_id"]
    r = client.post(f"/api/v1/evidence/{eid}/download", headers={"Authorization": f"Bearer {token}"},
                    json={"reason": "positive control for the leak sweep"})
    assert r.status_code == 200
    assert any(raw in r.text for raw in labels), "scanner would not notice a raw value; the sweep proves nothing"
