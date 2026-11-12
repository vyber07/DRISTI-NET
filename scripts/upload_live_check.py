"""Checks against the ISOLATED instance on 127.0.0.1:8014 (throwaway SQLite, scratch storage). Never the live stack.

(a) a real dropped connection mid-upload leaves no evidence row and no staging file, and is audited;
(b) a 200 MB streamed upload is hashed correctly while the server's peak memory stays flat;
(c) browser: the upload panel shows the server's limits, uploads through the streaming route, and the client-side
    check refuses an oversized file before sending it.
"""
import hashlib
import os
import socket
import subprocess
import sys
import time
from pathlib import Path

import httpx
from playwright.sync_api import sync_playwright

BASE = os.environ.get("DRISTI_E2E_WEB", "http://127.0.0.1:8014")
if any(m in BASE for m in ("nip.io", "65.0.102.181")):
    sys.exit("refusing to run against the live demo host; point DRISTI_E2E_WEB at an isolated instance")
API = BASE + "/api/v1"
STAGING = Path(os.environ.get("DRISTI_E2E_STAGING", "/tmp/drishti-upload-check/staging"))  # the instance STORAGE_ROOT/staging
TMP = Path(os.environ.get("DRISTI_E2E_TMP", "/tmp"))
MP4 = b"\x00\x00\x00\x18ftypisom\x00\x00\x02\x00isomiso2"
results = []


def check(name, ok, info=""):
    ok = bool(ok)
    results.append(ok)
    print(("PASS " if ok else "FAIL ") + name + (f"  [{info}]" if info else ""))


def token(u):
    r = httpx.post(f"{API}/auth/login", json={"username": u, "password": f"{u}-demo"})
    r.raise_for_status()
    return r.json()["token"]


def server_pid():
    out = subprocess.run(["fuser", f"{BASE.rsplit(':', 1)[-1]}/tcp"], capture_output=True, text=True)
    return int((out.stdout or out.stderr).split()[-1])


def peak_rss_mb(pid):
    for line in Path(f"/proc/{pid}/status").read_text().splitlines():
        if line.startswith("VmHWM:"):
            return int(line.split()[1]) // 1024
    return -1


officer = token("officer")
admin = token("admin")
H = {"Authorization": f"Bearer {officer}"}
AH = {"Authorization": f"Bearer {admin}"}


def evidence_count():
    return len(httpx.get(f"{API}/cases/CASE-0001/evidence", headers=H).json())


# ------------------------------------------------------------------ (a) real interrupted upload
before = evidence_count()
declared = 20 * 1024 * 1024
s = socket.create_connection(("127.0.0.1", 8014))
s.sendall((f"POST /api/v1/cases/CASE-0001/evidence/stream?filename=cut.mp4 HTTP/1.1\r\nHost: 127.0.0.1\r\n"
           f"Authorization: Bearer {officer}\r\nContent-Type: application/octet-stream\r\nContent-Length: {declared}\r\n\r\n").encode())
s.sendall(MP4 + os.urandom(2 * 1024 * 1024))
time.sleep(0.5)
s.close()  # connection dropped with 18 MB still owed
time.sleep(2)
check("dropped upload: no evidence row", evidence_count() == before)
check("dropped upload: no staging file left", not list(STAGING.glob("*.part")), str(list(STAGING.glob("*.part"))))
denied = httpx.get(f"{API}/audit", headers=AH, params={"action": "EVIDENCE_UPLOAD", "outcome": "DENIED", "limit": 20}).json()
check("dropped upload: audited as INTERRUPTED", any(d["detail"].get("code") == "INTERRUPTED" for d in denied))

# ------------------------------------------------------------------ (b) 200 MB streamed, memory flat
pid = server_pid()
rss_before = peak_rss_mb(pid)
size = 200 * 1024 * 1024
h = hashlib.sha256()


def body():
    first = MP4 + os.urandom(1024 * 1024 - len(MP4))
    h.update(first)
    yield first
    sent = len(first)
    while sent < size:
        chunk = os.urandom(min(1024 * 1024, size - sent))
        h.update(chunk)
        sent += len(chunk)
        yield chunk


t0 = time.time()
r = httpx.post(f"{API}/cases/CASE-0001/evidence/stream", params={"filename": "cctv-200mb.mp4", "process": "true"},
               headers={**H, "Content-Type": "application/octet-stream", "Content-Length": str(size)}, content=body(), timeout=600)
elapsed = time.time() - t0
rss_after = peak_rss_mb(pid)
check("200 MB streamed upload accepted", r.status_code == 201, f"{r.status_code} in {elapsed:.1f}s")
if r.status_code == 201:
    b = r.json()
    check("200 MB: server hash equals client hash", b["sha256"] == h.hexdigest())
    check("200 MB: scanned and promoted (stored only, no content extraction)", b["storage_area"] == "accepted" and b["record_type"] == "video", b["status"])
check("200 MB: server peak memory grew by less than 64 MB", rss_after - rss_before < 64, f"peak {rss_before} -> {rss_after} MB")

# ------------------------------------------------------------------ (c) browser
csv_path = TMP / "upload-ui.csv"
# A recognised record type (call records), so the upload is followed through extraction too.
csv_path.write_text(f"call_id,caller,callee,start_time,duration_s,tower_id\nUI-{os.urandom(4).hex()},+91 90000 55501,+91 90000 55502,2025-07-01 10:00:00,60,TWR-UI\n")
png_path = TMP / "upload-too-big.png"
png_path.write_bytes(b"\x89PNG\r\n\x1a\n" + os.urandom(2 * 1024 * 1024))
httpx.put(f"{API}/upload-policies/IMAGE", headers=AH, json={"max_mb": 1, "enabled": True, "reason": "browser check limit"})
console_errors = []
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1400, "height": 1000})
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    posts = []
    page.on("request", lambda req: posts.append(req.url) if req.method == "POST" and "/evidence/stream" in req.url else None)
    page.goto(BASE + "/login")
    page.fill("#officer-id", "officer")
    page.fill("#password", "officer-demo")
    page.click("button[type=submit]")
    page.wait_for_url(lambda u: "/login" not in u, timeout=15000)
    page.goto(BASE + "/cases/CASE-0001/evidence")
    page.wait_for_selector("[data-testid=upload-limits]", timeout=15000)
    limits = page.inner_text("[data-testid=upload-limits]")
    check("browser: upload panel lists the server's limits", "CCTV and other video" in limits and "up to 1 MB" in limits, limits[:140].replace("\n", " | "))
    page.set_input_files("input[type=file]", str(csv_path))
    page.get_by_role("button", name="Upload", exact=True).click()
    page.wait_for_selector("[data-testid=upload-result]", timeout=30000)
    msg = page.inner_text("[data-testid=upload-result]")
    check("browser: CSV uploads through the streaming route", msg.startswith("Uploaded") and any("/evidence/stream" in u for u in posts), msg)
    n_posts = len(posts)
    page.set_input_files("input[type=file]", str(png_path))
    page.get_by_role("button", name="Upload", exact=True).click()
    page.wait_for_function("document.querySelector('[data-testid=upload-result]') && document.querySelector('[data-testid=upload-result]').innerText.startsWith('Not uploaded')", timeout=10000)
    msg2 = page.inner_text("[data-testid=upload-result]")
    check("browser: oversized file refused before sending", "larger than the 1 MB limit" in msg2 and len(posts) == n_posts, msg2)
    page.screenshot(path=str(TMP / "upload-panel.png"), full_page=False)
    browser.close()
bad = [e for e in console_errors if "favicon" not in e]
check("browser: no console errors", not bad, "; ".join(bad)[:200])
print(f"\n{sum(results)} passed, {len(results) - sum(results)} failed")
sys.exit(0 if all(results) else 1)
