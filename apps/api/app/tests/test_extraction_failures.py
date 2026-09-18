"""Corrupt-input fixtures proving EXTRACTION_FAILED is reached (not silently swallowed or crashing
the process) and that the evidence can be retried via the existing /process endpoint. Also covers the
parser resource caps (CSV row / JSON record / PDF page limits) enforced in validate_upload().

The two corruption fixtures pass validate_upload() (well-formed CSV / real PDF magic bytes) so the
failure is a genuine parser-time error, not something caught earlier by upload validation.
"""
import io

from .. import config
from ..services.extract import validate_upload
from .conftest import upload


def test_corrupt_csv_reaches_extraction_failed_and_is_retryable(client, officer, investigator, admin):
    r = upload(client, officer, "CASE-0001", "corrupt/calls_corrupt.csv")
    assert r.status_code == 201, r.text
    ev = r.json()
    assert ev["status"] == "EXTRACTION_FAILED"
    kinds = [j["kind"] for j in ev["jobs"]]
    assert kinds == ["SCAN", "EXTRACT"]
    extract_job = ev["jobs"][-1]
    assert extract_job["status"] == "FAILED" and extract_job["attempts"] == 1
    assert "ValueError" in extract_job["error"]

    fetched = client.get(f"/api/v1/evidence/{ev['evidence_id']}", headers=investigator).json()
    assert fetched["status"] == "EXTRACTION_FAILED" and fetched["error"]

    # retry: same malformed bytes deterministically fail again (no silent success, no crash,
    # error stays visible) and the attempt count advances -- proving retry is a real, safe path.
    r2 = client.post(f"/api/v1/evidence/{ev['evidence_id']}/process", headers=admin, json={})
    assert r2.status_code == 200, r2.text
    retried = r2.json()
    assert retried["status"] == "EXTRACTION_FAILED"
    retry_job = retried["jobs"][-1]
    assert retry_job["kind"] == "EXTRACT" and retry_job["status"] == "FAILED" and retry_job["attempts"] == 2


def test_truncated_pdf_reaches_extraction_failed(client, officer, investigator):
    r = upload(client, officer, "CASE-0001", "corrupt/fir_001_truncated.pdf")
    assert r.status_code == 201, r.text
    ev = r.json()
    assert ev["status"] == "EXTRACTION_FAILED"
    extract_job = ev["jobs"][-1]
    assert extract_job["kind"] == "EXTRACT" and extract_job["status"] == "FAILED"
    assert "PdfStreamError" in extract_job["error"] or "Stream has ended" in extract_job["error"]

    fetched = client.get(f"/api/v1/evidence/{ev['evidence_id']}", headers=investigator).json()
    assert fetched["status"] == "EXTRACTION_FAILED" and fetched["error"]


def test_csv_row_cap_rejected_at_upload(monkeypatch):
    monkeypatch.setattr(config, "CSV_MAX_ROWS", 3)
    csv_bytes = b"caller,callee,start_time\n" + b"+91900,+91901,2025-07-02T10:00:00\n" * 4
    v = validate_upload("calls_huge.csv", csv_bytes)
    assert v.ok is False and "row limit" in v.reason


def test_json_record_cap_rejected_at_upload(monkeypatch):
    monkeypatch.setattr(config, "JSON_MAX_RECORDS", 2)
    json_bytes = b'[{"person_id": "p1"}, {"person_id": "p2"}, {"person_id": "p3"}]'
    v = validate_upload("people_huge.json", json_bytes)
    assert v.ok is False and "record limit" in v.reason


def test_pdf_page_cap_rejected_at_upload(monkeypatch):
    from pypdf import PdfWriter

    monkeypatch.setattr(config, "PDF_MAX_PAGES", 3)
    w = PdfWriter()
    for _ in range(5):
        w.add_blank_page(width=72, height=72)
    buf = io.BytesIO()
    w.write(buf)
    v = validate_upload("big.pdf", buf.getvalue())
    assert v.ok is False and "page limit" in v.reason


def test_pdf_page_cap_does_not_shadow_corruption(monkeypatch):
    """A truncated/corrupt PDF must still pass validation (and fail visibly at extraction, see
    test_truncated_pdf_reaches_extraction_failed) rather than being rejected here as a page-limit hit."""
    monkeypatch.setattr(config, "PDF_MAX_PAGES", 1)
    truncated = (config.SYNTHETIC_DIR / "corrupt" / "fir_001_truncated.pdf").read_bytes()
    v = validate_upload("fir_001_truncated.pdf", truncated)
    assert v.ok is True
