"""Browser check of the user request module (ADR-018) against a DISPOSABLE local instance with seeded demo users.

Usage: verify_user_requests_ui.py BASE [SCREENSHOT_DIR]
Walks: raise -> duplicate refused -> admin notified -> claim -> approve -> complete -> requester notified and gains
access; another user gets "not found"; the auditor sees it read-only; a stale admin view gets a version-conflict message.
"""
import re
import sys
import uuid
from pathlib import Path

import httpx
from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _guard import require_loopback  # noqa: E402

BASE = sys.argv[1].rstrip("/")
require_loopback(BASE)
SHOTS = Path(sys.argv[2]) if len(sys.argv) > 2 else None
results = []


def check(name, ok, detail=""):
    results.append(ok)
    print(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f"\n       {detail}" if detail else ""))


def login(page, user, password=None):
    page.goto(BASE + "/login")
    page.fill("#officer-id", user)
    page.fill("#password", password or f"{user}-demo")
    page.click("button[type=submit]")
    page.wait_for_url(lambda u: "/login" not in u, timeout=15000)


def shot(page, name):
    if SHOTS:
        page.screenshot(path=str(SHOTS / f"ur-{name}.png"), full_page=True)


# A second administrator (for the conflict check), created through the API.
api = httpx.Client(base_url=BASE + "/api/v1", timeout=30)
admin_tok = api.post("/auth/login", json={"username": "admin", "password": "admin-demo"}).json()["token"]
H = {"Authorization": f"Bearer {admin_tok}"}
admin2 = f"admin{uuid.uuid4().hex[:6]}"
api.post("/users", headers=H, json={"username": admin2, "display_name": "Second Admin (check)", "role": "ADMIN",
                                    "jurisdiction": "Demo District A", "password": "Second-admin-pass-1"}).raise_for_status()

with sync_playwright() as p:
    browser = p.chromium.launch()

    # 1. Requester raises a case-access request through the form.
    req_ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    page = req_ctx.new_page()
    login(page, "unassigned")
    page.click("nav >> text=Requests")
    page.wait_for_url("**/requests")
    page.click("button:has-text('New request')")
    dlg = page.locator("[data-testid=new-request-dialog]")
    dlg.locator("select").first.select_option("CASE_ACCESS")
    dlg.locator("input").first.fill("case-0001")
    dlg.locator("select").nth(1).select_option("investigation")
    dlg.get_by_label("Title").fill("Access to CASE-0001 for the fraud link")
    dlg.get_by_label("Why do you need this?").fill("The suspect in my case appears in CASE-0001 transactions.")
    dlg.locator("button:has-text('Submit request')").click()
    page.wait_for_url(re.compile(r".*/requests/\d+$"))
    request_url = page.url
    rid = int(request_url.rsplit("/", 1)[1])
    page.wait_for_selector("[data-testid=request-history] li >> nth=1")
    body = page.inner_text("body")
    check("requester submits through the form; status Pending; history shows it", "Pending" in body and "submitted it" in body, page.url)
    shot(page, "1-requester-detail")

    # 2. Duplicate is refused with a clear message.
    page.goto(BASE + "/requests")
    page.click("button:has-text('New request')")
    dlg = page.locator("[data-testid=new-request-dialog]")
    dlg.locator("select").first.select_option("CASE_ACCESS")
    dlg.locator("input").first.fill("CASE-0001")
    dlg.locator("select").nth(1).select_option("review")
    dlg.get_by_label("Title").fill("Access to CASE-0001 again")
    dlg.get_by_label("Why do you need this?").fill("Same need, asked a second time by mistake.")
    dlg.locator("button:has-text('Submit request')").click()
    page.wait_for_timeout(1000)
    msg = dlg.inner_text()
    check("duplicate request refused with the existing reference", "already have an open request" in msg and f"UR-{rid:06d}" in msg, msg[-160:])
    page.keyboard.press("Escape")
    shot(page, "2-list")

    # 3. Administrator: bell shows it, opens it, claims, approves, completes.
    adm_ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    adm = adm_ctx.new_page()
    login(adm, "admin")
    adm.wait_for_timeout(800)
    bell = adm.locator("[data-testid=notifications-bell]")
    check("administrator's bell shows unread notifications", "unread" in (bell.get_attribute("aria-label") or ""), bell.get_attribute("aria-label") or "")
    bell.click()
    adm.locator("[data-testid=notifications-list] button", has_text=f"UR-{rid:06d}").first.click()
    adm.wait_for_url(f"**/requests/{rid}")
    adm.click("[data-testid=action-claim]")
    adm.wait_for_selector("text=Under review")
    adm.click("[data-testid=action-approve]")
    adm.fill("[data-testid=reason-dialog] textarea", "Confirmed overlap with CASE-0001 by the case owner.")
    adm.click("[data-testid=reason-dialog] button:has-text('Approve')")
    adm.wait_for_selector("text=Decision reason")
    checks = adm.inner_text("body")
    check("review checks show the case and that it can be applied", "Can be applied" in checks and "Yes" in checks)
    adm.click("[data-testid=action-complete]")
    adm.wait_for_selector("text=Assigned to CASE-0001")
    hist = adm.inner_text("[data-testid=request-history]")
    check("approve + complete recorded with reviewer and reason in the history",
          all(t in hist for t in ("started reviewing", "approved it", "completed it", "Confirmed overlap")), hist[-300:])
    shot(adm, "3-admin-completed")

    # 4. Requester is notified and now has access.
    page.reload()
    page.wait_for_timeout(800)
    label = page.locator("[data-testid=notifications-bell]").get_attribute("aria-label") or ""
    page.goto(request_url)
    page.wait_for_selector("text=Completed")
    page.goto(BASE + "/cases/CASE-0001")
    page.wait_for_timeout(2500)
    case_text = page.inner_text("main")
    denied = "access to this case is denied" in case_text.lower() or "does not exist" in case_text.lower()
    check("requester notified, request completed, and CASE-0001 now opens",
          "unread" in label and not denied and "CASE-0001" in case_text, f"{label} | {case_text[:160]!r}")

    # 5. Another user gets 'not found'; the auditor sees it read-only.
    other = browser.new_context().new_page()
    login(other, "reviewer")
    other.goto(request_url)
    other.wait_for_timeout(1200)
    check("another user cannot see the request", "Request not found" in other.inner_text("body"))
    aud = browser.new_context().new_page()
    login(aud, "auditor")
    aud.goto(request_url)
    aud.wait_for_selector("[data-testid=request-history]")
    check("auditor sees it with no action buttons", aud.locator("[data-testid^=action-]").count() == 0)

    # 6. Stale view: admin's page loaded, a second admin claims first, then the admin acts.
    tok_u = api.post("/auth/login", json={"username": "unassigned", "password": "unassigned-demo"}).json()["token"]
    r2 = api.post("/user-requests", headers={"Authorization": f"Bearer {tok_u}"}, json={
        "category": "SUPPORT", "title": "Password reset email not arriving", "justification": "Tried three times this morning without success.",
        "submit": True}).json()
    adm.goto(f"{BASE}/requests/{r2['request_id']}")
    adm.wait_for_selector("[data-testid=action-claim]")
    tok_2 = api.post("/auth/login", json={"username": admin2, "password": "Second-admin-pass-1"}).json()["token"]
    api.post(f"/user-requests/{r2['request_id']}/claim", headers={"Authorization": f"Bearer {tok_2}"}, json={"version": r2["version"]}).raise_for_status()
    adm.click("[data-testid=action-claim]")
    adm.wait_for_timeout(1500)
    body = adm.inner_text("body")
    check("stale view: version conflict explained and the page reloaded",
          "Someone else changed this request" in body and "Second Admin" in body, body[:200])
    shot(adm, "4-conflict")
    browser.close()

print(f"\n{sum(results)}/{len(results)} passed")
