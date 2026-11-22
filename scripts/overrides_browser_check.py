"""Browser check of the permission-overrides UI against the ISOLATED instance on 127.0.0.1:8013 (throwaway SQLite).

Prints PASS/FAIL lines and saves screenshots. Never touches the live stack.
"""
import datetime
import os
import sys

import httpx
from playwright.sync_api import sync_playwright

BASE = os.environ.get("DRISTI_E2E_WEB", "http://127.0.0.1:8013")
if any(m in BASE for m in ("nip.io", "65.0.102.181")):
    sys.exit("refusing to run against the live demo host; point DRISTI_E2E_WEB at an isolated instance")
API = BASE + "/api/v1"
SHOTS = os.environ.get("DRISTI_E2E_SHOTS", "/tmp")
results = []


def check(name, ok, info=""):
    ok = bool(ok)
    results.append(ok)
    print(("PASS " if ok else "FAIL ") + name + (f"  [{info}]" if info else ""))


def token(u, p):
    r = httpx.post(f"{API}/auth/login", json={"username": u, "password": p})
    r.raise_for_status()
    return {"Authorization": f"Bearer {r.json()['token']}"}


def iso(hours):
    return (datetime.datetime.utcnow() + datetime.timedelta(hours=hours)).isoformat() + "Z"


admin = token("admin", "admin-demo")
httpx.post(f"{API}/users", headers=admin, json={"username": "admin2", "display_name": "Second Admin", "role": "ADMIN",
                                                "jurisdiction": "Demo District A", "password": "admin2-pass-1234"})
admin2 = token("admin2", "admin2-pass-1234")
users = {u["username"]: u["user_id"] for u in httpx.get(f"{API}/users", headers=admin).json()}

deny = httpx.post(f"{API}/permission-overrides", headers=admin, json={
    "effect": "DENY", "action": "listAnchors", "subject_type": "USER", "subject": users["investigator"], "case_id": "CASE-0001",
    "reason": "browser check: restrict anchors view", "expires_at": iso(2)}).json()
allow = httpx.post(f"{API}/permission-overrides", headers=admin, json={
    "effect": "ALLOW", "action": "createCase", "subject_type": "USER", "subject": users["analyst"],
    "reason": "browser check: analyst opens a case during cover", "expires_at": iso(2)}).json()


def login(page, user, pw):
    page.goto(BASE + "/login")
    page.fill("#officer-id", user)
    page.fill("#password", pw)
    page.click("button[type=submit]")
    page.wait_for_url(lambda url: "/login" not in url, timeout=15000)


with sync_playwright() as p:
    browser = p.chromium.launch()
    console_errors = []

    def new_page():
        ctx = browser.new_context(viewport={"width": 1400, "height": 900})
        pg = ctx.new_page()
        pg.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
        return pg

    # --- analyst before approval: no "New case" button
    pg = new_page()
    login(pg, "analyst", "analyst-demo")
    pg.goto(BASE + "/cases")
    pg.wait_for_selector("text=Every case you are assigned", timeout=15000)
    check("analyst: no 'New case' while the ALLOW is pending", pg.locator("button:has-text('New case')").count() == 0)
    pg.context.close()

    # --- admin: navigation, list, pending ALLOW cannot be approved by its creator
    pg = new_page()
    login(pg, "admin", "admin-demo")
    pg.wait_for_selector("a:has-text('Cases')", timeout=15000)  # sidebar rendered (avoids a race after redirect)
    check("admin: navigation shows Permission overrides", pg.locator("a:has-text('Permission overrides')").count() >= 1)
    pg.goto(BASE + "/admin/overrides")
    pg.wait_for_selector("text=Permission overrides", timeout=15000)
    pg.click("button[role=tab]:has-text('all')")
    pg.wait_for_selector("[data-testid=overrides-table]", timeout=15000)
    table = pg.inner_text("[data-testid=overrides-table]")
    check("admin: table lists the DENY and the pending ALLOW", "listAnchors" in table and "createCase" in table, table[:120].replace("\n", " "))
    row = pg.locator("tr", has_text="createCase")
    approve = row.locator("button:has-text('Approve')")
    check("admin: Approve is disabled for the creator", approve.count() == 1 and approve.is_disabled())
    pg.screenshot(path=f"{SHOTS}/overrides-admin.png", full_page=True)

    # create through the UI: open dialog, subject list excludes yourself
    pg.click("button:has-text('New override')")
    pg.wait_for_selector("[data-testid=create-override-dialog]")
    options = pg.locator("[data-testid=create-override-dialog] select").nth(3).inner_text()
    check("admin: create dialog does not offer yourself as subject", "admin (" not in options, options.replace("\n", ", ")[:120])
    dlg = pg.locator("[data-testid=create-override-dialog]")
    dlg.locator("select").nth(0).select_option("DENY")
    dlg.locator("select").nth(1).select_option("report")
    dlg.locator("select").nth(3).select_option(users["reviewer"])
    expires_local = (datetime.datetime.now() + datetime.timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M")
    dlg.locator("input[type=datetime-local]").nth(1).fill(expires_local)
    dlg.locator("textarea").fill("browser check: stop reviewer reports for one hour")
    dlg.locator("button[type=submit]").click()
    pg.wait_for_selector("[data-testid=create-override-dialog]", state="detached", timeout=10000)
    pg.click("button[role=tab]:has-text('active')")
    pg.wait_for_selector("[data-testid=overrides-table] >> text=report", timeout=10000)
    check("admin: DENY created through the UI is active", "report" in pg.inner_text("[data-testid=overrides-table]"))
    # history dialog
    pg.locator("tr", has_text="report").locator("button:has-text('History')").click()
    pg.wait_for_selector("text=created", timeout=10000)
    check("admin: history dialog shows the CREATED event", pg.locator("text=created").count() >= 1)
    pg.keyboard.press("Escape")
    pg.context.close()

    # --- second admin approves the ALLOW in the UI
    pg = new_page()
    login(pg, "admin2", "admin2-pass-1234")
    pg.goto(BASE + "/admin/overrides")
    pg.click("button[role=tab]:has-text('pending')")
    pg.wait_for_selector("[data-testid=overrides-table]", timeout=15000)
    pg.locator("tr", has_text="createCase").locator("button:has-text('Approve')").click()
    pg.locator("button[type=submit]:has-text('Approve')").click()
    pg.wait_for_timeout(800)
    pg.click("button[role=tab]:has-text('active')")
    pg.wait_for_selector("[data-testid=overrides-table] >> text=createCase", timeout=10000)
    check("admin2: approved ALLOW now listed as active", "approved by admin2" in pg.inner_text("[data-testid=overrides-table]"))
    pg.context.close()

    # --- analyst after approval: "New case" appears (effective permissions from the server)
    pg = new_page()
    login(pg, "analyst", "analyst-demo")
    pg.goto(BASE + "/cases")
    pg.wait_for_selector("button:has-text('New case')", timeout=15000)
    check("analyst: 'New case' appears once the ALLOW is active", pg.locator("button:has-text('New case')").count() == 1)
    pg.screenshot(path=f"{SHOTS}/overrides-analyst-cases.png")
    pg.context.close()

    # --- auditor: can review, cannot change
    pg = new_page()
    login(pg, "auditor", "auditor-demo")
    pg.goto(BASE + "/admin/overrides")
    pg.wait_for_selector("[data-testid=overrides-table]", timeout=15000)
    check("auditor: page loads without 'New override'", pg.locator("button:has-text('New override')").count() == 0)
    check("auditor: no Approve/Revoke buttons", pg.locator("[data-testid=overrides-table] button:has-text('Revoke'), [data-testid=overrides-table] button:has-text('Approve')").count() == 0)
    pg.context.close()

    # --- investigator: no navigation entry, direct URL shows the denied state
    pg = new_page()
    login(pg, "investigator", "investigator-demo")
    check("investigator: no navigation entry", pg.locator("a:has-text('Permission overrides')").count() == 0)
    pg.goto(BASE + "/admin/overrides")
    pg.wait_for_selector("text=cannot review permission overrides", timeout=15000)
    check("investigator: direct URL shows the denied state", True)
    pg.context.close()

    browser.close()

# backend agrees with what the UI showed
analyst = token("analyst", "analyst-demo")
check("API: analyst may now create a case", httpx.post(f"{API}/cases", headers=analyst, json={
    "case_id": "CASE-OVR-UI", "title": "Override check", "jurisdiction": "Demo District A", "purpose": "browser check",
    "authority_reference": "FIR-TEST-1"}).status_code in (200, 201))
reviewer = token("reviewer", "reviewer-demo")
check("API: reviewer report refused by the UI-created DENY",
      httpx.post(f"{API}/cases/CASE-0001/report", headers=reviewer, json={"format": "json"}).status_code == 403)
bad = [e for e in console_errors if "favicon" not in e]
check("no browser console errors", not bad, "; ".join(bad)[:200])
print(f"\n{sum(results)} passed, {len(results) - sum(results)} failed")
sys.exit(0 if all(results) else 1)
