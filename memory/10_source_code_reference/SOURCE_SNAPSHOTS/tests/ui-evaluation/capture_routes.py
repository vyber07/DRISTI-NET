"""Capture every route per role and viewport; record console errors and failed requests. Usage: shoot.py <base> <outdir> <label>"""
import json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE, OUT, LABEL = sys.argv[1], Path(sys.argv[2]), sys.argv[3]
OUT.mkdir(parents=True, exist_ok=True)
C = "CASE-0001"
import os as _os
if _os.environ.get("SHOOT_SET") == "after":
    ROUTES = ["/command-center", "/cases", f"/cases/{C}", f"/cases/{C}/evidence", f"/cases/{C}/review", f"/cases/{C}/graph", f"/cases/{C}/timeline",
              f"/cases/{C}/locations", f"/cases/{C}/analysis", f"/cases/{C}/decisions", f"/cases/{C}/reports", f"/cases/{C}/audit",
              "/audit", "/profile", "/settings", f"/cases/{C}/notes", f"/cases/{C}/hitl", f"/cases/{C}/map", f"/cases/{C}/reviews", f"/cases/{C}/report", f"/cases/{C}/overview", "/home", "/no-such-page"]
else:
    ROUTES = ["/command-center", "/cases", f"/cases/{C}", f"/cases/{C}/graph", f"/cases/{C}/evidence", f"/cases/{C}/timeline",
          f"/cases/{C}/map", f"/cases/{C}/analysis", f"/cases/{C}/hitl", f"/cases/{C}/reviews", f"/cases/{C}/audit",
          f"/cases/{C}/reports", "/audit", "/profile", "/settings", f"/cases/{C}/notes", "/home", "/review", "/reports", "/evidence"]
_rv = f"/cases/{C}/review" if _os.environ.get("SHOOT_SET") == "after" else f"/cases/{C}/hitl"
ROLES = {"investigator": ROUTES, "reviewer": [_rv, "/command-center"], "auditor": ["/audit", "/command-center", f"/cases/{C}"],
         "admin": ["/audit", "/settings", "/cases"], "unassigned": [f"/cases/{C}", "/cases"],
         "officer": [f"/cases/{C}/evidence", f"/cases/{C}/reports"], "analyst": [_rv, f"/cases/{C}/reports"]}
VIEWPORTS = {"desktop": (1440, 900), "tablet": (900, 1100), "phone": (390, 844)}
log = []
with sync_playwright() as p:
    b = p.chromium.launch()
    for vp, (w, h) in VIEWPORTS.items():
        for role, routes in ROLES.items():
            if vp != "desktop" and role != "investigator":
                continue
            ctx = b.new_context(viewport={"width": w, "height": h}); pg = ctx.new_page()
            errs = []
            pg.on("console", lambda m: errs.append(("console", m.type, m.text[:300])) if m.type in ("error", "warning") else None)
            pg.on("pageerror", lambda e: errs.append(("pageerror", str(e)[:300])))
            pg.on("response", lambda r: errs.append(("http", r.status, r.url.replace(BASE, ""))) if r.status >= 400 else None)
            pg.goto(f"{BASE}/login"); pg.fill("#officer-id", role); pg.fill("#password", f"{role}-demo"); pg.click("button[type=submit]")
            pg.wait_for_url("**/command-center", timeout=15000)
            for r in (routes if vp == "desktop" else ROUTES[:12]):
                errs.clear()
                pg.goto(BASE + r); pg.wait_for_load_state("networkidle"); pg.wait_for_timeout(1200)
                name = f"{vp}_{role}_{r.strip('/').replace('/', '_') or 'root'}.png"
                pg.screenshot(path=str(OUT / name), full_page=False)
                sw = pg.evaluate("document.documentElement.scrollWidth")
                log.append({"label": LABEL, "vp": vp, "role": role, "route": r, "final_url": pg.url.replace(BASE, ""), "shot": name,
                            "h_overflow": sw > w, "errors": list(errs), "h1": pg.locator("h1").all_inner_texts()[:2]})
            ctx.close()
    b.close()
(OUT / "capture_log.json").write_text(json.dumps(log, indent=1))
print(len(log), "captures;", sum(1 for x in log if x["errors"]), "with errors;", sum(1 for x in log if x["h_overflow"]), "with horizontal overflow")
