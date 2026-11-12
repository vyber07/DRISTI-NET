"""Verify the 'Failed to fetch' fixes with the BRANCH frontend + API (127.0.0.1:8016) behind a throwaway nginx (8020).
Never touches the live site.  Usage: ff_verify.py BASE_DIRECT BASE_PROXY NGINX_DIR
Each scenario prints PASS/FAIL with what the user sees."""
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

import httpx
from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _guard import require_loopback  # noqa: E402

require_loopback(sys.argv[1], sys.argv[2])
DIRECT, PROXY, NGINX = sys.argv[1], sys.argv[2], Path(sys.argv[3])
results = []


def nginx(conf):
    shutil.copy(NGINX / conf, NGINX / "active.conf")
    subprocess.run(["docker", "exec", "ff-nginx", "nginx", "-s", "reload"], check=True, capture_output=True)
    time.sleep(1)


def login_ui(page, base, user):
    page.goto(base + "/login")
    page.fill("#officer-id", user)
    page.fill("#password", f"{user}-demo")
    page.click("button[type=submit]")
    page.wait_for_url(lambda u: "/login" not in u, timeout=15000)


def body(page):
    return page.inner_text("body")


def check(name, ok, detail):
    results.append((name, ok))
    print(f"[{'PASS' if ok else 'FAIL'}] {name}\n       {detail}")


with sync_playwright() as p:
    browser = p.chromium.launch()

    # ---- A1: origin switched to a cross-origin 301 (what live did on 2026-11-11), new client only
    nginx("proxy.conf")
    ctx = browser.new_context(); page = ctx.new_page()
    login_ui(page, PROXY, "investigator"); page.goto(PROXY + "/cases"); page.wait_for_timeout(1500)
    nginx("redirect.conf")
    page.click("a:has-text('Home')"); page.wait_for_timeout(12000)   # 3 retries with back-off
    text = body(page)
    check("A1 cross-origin 301, client fix alone: no raw 'Failed to fetch'",
          "Failed to fetch" not in text and "Cannot reach the DRISTI-NET server" in text,
          f"visible: {[l for l in text.splitlines() if re.search('reach|fail|could not', l, re.I)][:3]}")
    ctx.close()

    # ---- A2: same, with the recommended host-nginx 421 for API calls
    nginx("proxy.conf")
    ctx = browser.new_context(); page = ctx.new_page()
    login_ui(page, PROXY, "investigator"); page.goto(PROXY + "/cases"); page.wait_for_timeout(1500)
    nginx("origin421.conf")
    page.click("a:has-text('Home')"); page.wait_for_timeout(4000)
    text = body(page)
    check("A2 with nginx 421: tab moves to the canonical origin and asks to sign in, no error",
          page.url.startswith("http://localhost:8020/") and "Failed to fetch" not in text and "Could not load" not in text,
          f"ended on {page.url}")
    ctx.close()
    nginx("proxy.conf")

    # ---- B: session revoked while a page fires several requests: straight to sign-in, no error flash
    ctx = browser.new_context(); page = ctx.new_page()
    errors_seen = []
    page.on("framenavigated", lambda f: None)
    login_ui(page, DIRECT, "reviewer"); page.goto(DIRECT + "/cases/CASE-0001"); page.wait_for_timeout(1500)
    admin = httpx.post(f"{DIRECT}/api/v1/auth/login", json={"username": "admin", "password": "admin-demo"}).json()["token"]
    users = {u["username"]: u["user_id"] for u in httpx.get(f"{DIRECT}/api/v1/users", headers={"Authorization": f"Bearer {admin}"}).json()}
    httpx.post(f"{DIRECT}/api/v1/users/{users['reviewer']}/reset-password", headers={"Authorization": f"Bearer {admin}"},
               json={"new_password": "reviewer-demo"})
    page.goto(DIRECT + "/command-center")
    for _ in range(30):
        t = body(page)
        if "Could not load" in t:
            errors_seen.append(t)
        page.wait_for_timeout(100)
    check("B revoked session: sign-in page, no error panel", "/login" in page.url and not errors_seen,
          f"ended on {page.url.replace(DIRECT, '')}; error panels seen: {len(errors_seen)}")
    ctx.close()

    # ---- C: offline during SPA navigation, then back online with no user action
    ctx = browser.new_context(); page = ctx.new_page()
    login_ui(page, DIRECT, "investigator"); page.goto(DIRECT + "/cases/CASE-0001"); page.wait_for_timeout(1500)
    ctx.set_offline(True)
    page.evaluate("window.dispatchEvent(new Event('offline'))")
    page.click("a:has-text('Evidence')"); page.wait_for_timeout(2500)
    t1 = body(page)
    check("C1 offline: banner + plain message, no raw 'Failed to fetch'",
          "You are offline" in t1 and "Failed to fetch" not in t1,
          f"visible: {[l for l in t1.splitlines() if re.search('offline|reach|fail', l, re.I)][:3]}")
    ctx.set_offline(False)
    page.evaluate("window.dispatchEvent(new Event('online'))")
    page.wait_for_timeout(5000)
    t2 = body(page)
    check("C2 back online: evidence loads by itself, no error left",
          "You are offline" not in t2 and "Could not load" not in t2 and "Cannot reach" not in t2,
          f"error/offline text left: {[l for l in t2.splitlines() if re.search('offline|reach|could not', l, re.I)][:3]}")
    ctx.close()

    # ---- E: transient 503 (busy) on a read: retried transparently
    ctx = browser.new_context(); page = ctx.new_page()
    login_ui(page, DIRECT, "investigator")
    hits = {"n": 0}

    def flaky(route):
        hits["n"] += 1
        if hits["n"] <= 2:
            route.fulfill(status=503, headers={"Retry-After": "1", "Content-Type": "application/json"},
                          body='{"detail":"The service is busy.","code":"BUSY","request_id":"REQ-test"}')
        else:
            route.continue_()
    page.route(re.compile(r".*/api/v1/cases(\?.*)?$"), flaky)
    page.goto(DIRECT + "/cases"); page.wait_for_timeout(6000)
    t = body(page)
    check("E transient 503 x2 on the case list: loads after retries, no error shown",
          hits["n"] >= 3 and "Could not load" not in t and "CASE-0001" in t, f"attempts: {hits['n']}")
    ctx.close()

    # ---- F: persistent 503: plain message with the request ID after the retries
    ctx = browser.new_context(); page = ctx.new_page()
    login_ui(page, DIRECT, "investigator")
    page.route(re.compile(r".*/api/v1/cases(\?.*)?$"), lambda r: r.fulfill(
        status=503, headers={"Retry-After": "1", "Content-Type": "application/json", "X-Request-Id": "REQ-busy-demo"},
        body='{"detail":"The service is busy. Please try again in a few seconds.","code":"BUSY","request_id":"REQ-busy-demo"}'))
    page.goto(DIRECT + "/cases"); page.wait_for_timeout(9000)
    t = body(page)
    check("F persistent 503: 'service is busy' message with request ID",
          "The service is busy" in t and "REQ-busy-demo" in t, f"visible: {[l for l in t.splitlines() if 'busy' in l.lower() or 'Request ID' in l][:3]}")
    ctx.close()
    browser.close()

# ---- D (hardening): cache headers and HEAD support
r = httpx.get(DIRECT + "/cases")
asset = re.search(r'/assets/(index-[^"]+\.js)', r.text).group(1)
a = httpx.get(f"{DIRECT}/assets/{asset}")
h = httpx.head(DIRECT + "/")
check("D app shell no-cache, hashed assets immutable, HEAD / answers 200",
      r.headers.get("cache-control") == "no-cache" and "immutable" in a.headers.get("cache-control", "") and h.status_code == 200,
      f"shell={r.headers.get('cache-control')} asset={a.headers.get('cache-control')} HEAD={h.status_code}")

print(f"\n{sum(ok for _, ok in results)}/{len(results)} passed")
