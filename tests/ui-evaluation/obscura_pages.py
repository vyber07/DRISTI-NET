"""Drive the Obscura browser over CDP (Playwright connect_over_cdp): sign in, visit pages, screenshot, report errors."""
import sys, time
from playwright.sync_api import sync_playwright
BASE, OUT, CDP = sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "http://127.0.0.1:9333"
PAGES = [("login", "/login", "#officer-id"), ("home", "/command-center", "#waiting"),
         ("cases", "/cases", "[data-testid=case-table]"), ("overview", "/cases/CASE-0001", "[data-testid=overview-evidence-chart]"),
         ("evidence", "/cases/CASE-0001/evidence", "[data-testid=evidence-table]"), ("review", "/cases/CASE-0001/review", "[data-testid=review-queue]"),
         ("graph-list", "/cases/CASE-0001/graph?view=list", "[data-testid=graph-relationships-table]"),
         ("timeline", "/cases/CASE-0001/timeline", "h2:has-text('Timeline')"), ("reports", "/cases/CASE-0001/reports", "text=Download HTML")]
with sync_playwright() as p:
    br = p.chromium.connect_over_cdp(CDP)
    ctx = br.contexts[0] if br.contexts else br.new_context()
    pg = ctx.new_page()
    pg.set_viewport_size({"width": 1440, "height": 900})
    errs = []
    pg.on("pageerror", lambda e: errs.append(("pageerror", str(e)[:160])))
    pg.on("response", lambda r: errs.append((r.status, r.url.replace(BASE, ""))) if r.status >= 400 else None)
    results = []
    for name, path, sel in PAGES:
        t0 = time.time()
        try:
            if name == "home":
                pg.goto(BASE + "/login"); pg.wait_for_selector("#officer-id", timeout=20000)
                pg.screenshot(path=f"{OUT}/login.png")
                pg.fill("#officer-id", "investigator"); pg.fill("#password", "investigator-demo"); pg.click("button[type=submit]")
                pg.wait_for_url("**/command-center", timeout=20000)
            else:
                pg.goto(BASE + path)
            pg.wait_for_selector(sel, timeout=20000)
            pg.wait_for_timeout(800)
            pg.screenshot(path=f"{OUT}/{name}.png")
            results.append((name, "OK", round(time.time() - t0, 1)))
        except Exception as e:
            try: pg.screenshot(path=f"{OUT}/{name}-FAILED.png")
            except Exception: pass
            results.append((name, f"FAIL: {str(e).splitlines()[0][:140]}", round(time.time() - t0, 1)))
    br.close()
for r in results: print(f"{r[0]:11s} {r[1]}  ({r[2]}s)")
print("errors:", errs or "none")
