"""Reproduce 'Failed to fetch' and related page failures with the LIVE frontend code (main, identical bundle hash)
against an isolated API (127.0.0.1:8016) and a throwaway nginx (8020). Never touches the live site.

Usage: ff_repro.py BASE_DIRECT BASE_PROXY DIST_DIR NGINX_DIR
Prints observations (what the user sees, and failed requests) for scenarios A-D.
"""
import os
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
DIRECT, PROXY, DIST, NGINX = sys.argv[1], sys.argv[2], Path(sys.argv[3]), Path(sys.argv[4])
SHOTS = Path(os.environ.get("FF_SHOTS", "/tmp"))


def login_ui(page, base, user):
    page.goto(base + "/login")
    page.fill("#officer-id", user)
    page.fill("#password", f"{user}-demo")
    page.click("button[type=submit]")
    page.wait_for_url(lambda u: "/login" not in u, timeout=15000)


def visible_errors(page):
    text = page.inner_text("body")
    hits = [line.strip() for line in text.splitlines() if re.search(r"fail|error|could not|unable|denied|expired", line, re.I)]
    return hits[:6]


def instrument(page):
    failed, console = [], []
    page.on("requestfailed", lambda r: failed.append(f"{r.method} {r.url.split('8016')[-1].split('8020')[-1]} -> {r.failure}"))
    page.on("console", lambda m: console.append(m.text[:160]) if m.type == "error" else None)
    page.on("pageerror", lambda e: console.append("pageerror: " + str(e)[:160]))
    return failed, console


def report(name, page, failed, console):
    print(f"\n=== {name}")
    print("visible:", visible_errors(page))
    print("failed requests:", failed[:8])
    print("console errors:", console[:6])


with sync_playwright() as p:
    browser = p.chromium.launch()

    # ---- A: origin switched to a redirect while the tab is open (live, 2026-11-11 11:53)
    shutil.copy(NGINX / "proxy.conf", NGINX / "active.conf")
    subprocess.run(["docker", "exec", "ff-nginx", "nginx", "-s", "reload"], check=True, capture_output=True)
    time.sleep(1)
    ctx = browser.new_context()
    page = ctx.new_page()
    failed, console = instrument(page)
    login_ui(page, PROXY, "investigator")
    page.goto(PROXY + "/cases")
    page.wait_for_timeout(1500)
    shutil.copy(NGINX / "redirect.conf", NGINX / "active.conf")
    subprocess.run(["docker", "exec", "ff-nginx", "nginx", "-s", "reload"], check=True, capture_output=True)
    time.sleep(1)
    page.click("a:has-text('Home')")  # SPA navigation: no page load, only API calls
    page.wait_for_timeout(2500)
    report("A: origin now redirects (tab left open)", page, failed, console)
    page.screenshot(path=str(SHOTS / "ff-A.png"))
    ctx.close()
    shutil.copy(NGINX / "proxy.conf", NGINX / "active.conf")
    subprocess.run(["docker", "exec", "ff-nginx", "nginx", "-s", "reload"], check=True, capture_output=True)

    # ---- B: session revoked while a page fires several requests at once
    ctx = browser.new_context()
    page = ctx.new_page()
    failed, console = instrument(page)
    login_ui(page, DIRECT, "reviewer")
    page.goto(DIRECT + "/cases/CASE-0001")
    page.wait_for_timeout(1500)
    admin = httpx.post(f"{DIRECT}/api/v1/auth/login", json={"username": "admin", "password": "admin-demo"}).json()["token"]
    users = {u["username"]: u["user_id"] for u in httpx.get(f"{DIRECT}/api/v1/users", headers={"Authorization": f"Bearer {admin}"}).json()}
    httpx.post(f"{DIRECT}/api/v1/users/{users['reviewer']}/reset-password", headers={"Authorization": f"Bearer {admin}"},
               json={"new_password": "reviewer-demo"})  # same password, new token version: every open session is now stale
    page.goto(DIRECT + "/command-center")  # a page that loads several things in parallel
    page.wait_for_timeout(3000)
    report("B: session revoked during a multi-request page", page, failed, console)
    print("ended on:", page.url.replace(DIRECT, ""))
    ctx.close()

    # ---- C: brief network loss during SPA navigation, then back online
    ctx = browser.new_context()
    page = ctx.new_page()
    failed, console = instrument(page)
    login_ui(page, DIRECT, "investigator")
    page.goto(DIRECT + "/cases/CASE-0001")
    page.wait_for_timeout(1500)
    ctx.set_offline(True)
    page.click("a:has-text('Evidence')")
    page.wait_for_timeout(1500)
    report("C1: offline while opening the Evidence tab", page, failed, console)
    page.screenshot(path=str(SHOTS / "ff-C1.png"))
    ctx.set_offline(False)
    page.wait_for_timeout(4000)
    report("C2: back online 4 s later (no user action)", page, failed, console)
    ctx.close()

    # ---- D: stale index.html after a redeploy (heuristic caching, no Cache-Control)
    index = DIST / "index.html"
    original_index = index.read_text()
    old_js = re.search(r"/assets/(index-[^\"]+\.js)", original_index).group(1)
    week_ago = time.time() - 7 * 86400
    os.utime(index, (week_ago, week_ago))   # live index.html was ~17 h old when inspected
    ctx = browser.new_context()
    page = ctx.new_page()
    failed, console = instrument(page)
    login_ui(page, DIRECT, "investigator")
    page.goto(DIRECT + "/cases")
    page.wait_for_timeout(1000)
    # "redeploy": new bundle name, old one gone, new index.html
    new_js = "index-REDEPLOYED.js"
    (DIST / "assets" / old_js).rename(DIST / "assets" / new_js)
    index.write_text(original_index.replace(old_js, new_js))
    page.goto(DIRECT + "/cases")        # ordinary navigation, as a user typing the address or following a bookmark
    page.wait_for_timeout(2500)
    body = page.inner_text("body").strip()
    report("D: navigation after a redeploy", page, failed, console)
    print("page body length:", len(body), "| blank page:", len(body) == 0)
    page.screenshot(path=str(SHOTS / "ff-D.png"))
    ctx.close()
    (DIST / "assets" / new_js).rename(DIST / "assets" / old_js)
    index.write_text(original_index)

    browser.close()
