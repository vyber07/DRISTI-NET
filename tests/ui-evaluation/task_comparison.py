"""Scripted task comparison: the same officer tasks on the old UI (8001) and the redesign (8002).
Counts deliberate clicks (not typing) and page loads from the task's start page; a task that cannot be completed in
the UI is recorded as such. Engineering measurement, not user research."""
import json, sys, time
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

def run(base, ui):
    out = {}
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1440, "height": 900})
        def login(u):
            pg.goto(base + "/login"); pg.fill("#officer-id", u); pg.fill("#password", f"{u}-demo"); pg.click("button[type=submit]"); pg.wait_for_url("**/command-center")
            pg.wait_for_load_state("networkidle")
        def task(name, fn):
            clicks = {"n": 0}
            def click(sel, **kw):
                pg.click(sel, **kw); clicks["n"] += 1; pg.wait_for_timeout(250)
            t0 = time.time()
            try:
                ok, note = fn(click)
            except PWTimeout as e:
                ok, note = False, f"not reachable in the UI ({str(e).splitlines()[0][:90]})"
            out[name] = {"completed": ok, "clicks": clicks["n"] if ok else None, "seconds": round(time.time() - t0, 1), "note": note}
        login("investigator")

        def t_case2_evidence(click):
            pg.goto(base + "/command-center"); pg.wait_for_load_state("networkidle")
            if ui == "old":
                click("div:has(> div > div > span:text('CASE-0002')) >> text=Open Workspace"); click("text=Evidence & Re")
            else:
                click("[data-testid=case-table] >> text=CASE-0002"); click("nav[aria-label='Case sections'] >> text=Evidence")
            pg.wait_for_selector("text=transactions_case2.csv", timeout=8000); return True, ""
        task("T1 open CASE-0002's evidence list from Home", t_case2_evidence)

        def t_open_candidate(click):
            pg.goto(base + "/command-center"); pg.wait_for_load_state("networkidle")
            if ui == "old":
                click("text=Review Queue"); click("text=Pooja Menon")
                pg.wait_for_selector("text=Why this is a candidate", timeout=8000)
            else:
                click("[data-testid=waiting-for-review] a:has-text('Review') >> nth=0"); click("[data-testid=review-queue] >> text=Pooja Menon")
                pg.wait_for_selector("text=Why this is a candidate", timeout=8000)
            return True, ""
        task("T2 open a pending candidate from Home", t_open_candidate)

        def t_verify(click):
            pg.goto(base + "/cases/CASE-0001"); pg.wait_for_load_state("networkidle")
            if ui == "old":
                click("text=Evidence & Re"); pg.wait_for_selector("text=Verify integrity", timeout=4000)
            else:
                click("nav[aria-label='Case sections'] >> text=Evidence"); click("[aria-label='Details of calls.csv']"); click("button:has-text('Verify integrity')")
                pg.wait_for_selector("text=still matches the recorded SHA-256", timeout=8000)
            return True, ""
        task("T3 re-check the integrity of calls.csv from the case overview", t_verify)

        def t_claim_source(click):
            pg.goto(base + "/cases/CASE-0001"); pg.wait_for_load_state("networkidle")
            if ui == "old":
                click("text=Evidence & Re"); pg.wait_for_selector("text=Extracted claims", timeout=4000)
            else:
                click("nav[aria-label='Case sections'] >> text=Evidence"); click("[aria-label='Details of fir_001.pdf']")
                click("[data-testid=evidence-claims] li button:has-text('Source') >> nth=0")
                pg.wait_for_selector("[data-testid=provenance-viewer] [data-hit=true]", timeout=8000)
            return True, ""
        task("T4 from an evidence file, open the exact line a claim was read from", t_claim_source)

        def t_reports_from_review(click):
            if ui == "old":
                pg.goto(base + "/cases/CASE-0001/hitl"); pg.wait_for_load_state("networkidle"); click("text=Pooja Menon")
                click("button:has-text('Back to Queue')"); click("text=Case Overview"); click("text=Export Reports")
            else:
                pg.goto(base + "/cases/CASE-0001/review"); pg.wait_for_load_state("networkidle"); click("[data-testid=review-queue] >> text=Pooja Menon")
                click("nav[aria-label='Case sections'] >> text=Reports")
            pg.wait_for_selector("text=Download HTML", timeout=8000); return True, "counted from the candidate page (first click opens it)"
        task("T5 go from a candidate to the case's reports", t_reports_from_review)

        def t_uploader(click):
            pg.goto(base + "/cases/CASE-0001"); pg.wait_for_load_state("networkidle")
            click("text=Evidence & Re" if ui == "old" else "nav[aria-label='Case sections'] >> text=Evidence")
            pg.wait_for_timeout(500)
            body = pg.inner_text("body")
            return ("Evidence Officer Ravi" in body), ("uploader shown by name" if "Evidence Officer Ravi" in body else "uploader shown only as a USR- id")
        task("T6 see who uploaded the evidence (by name)", t_uploader)

        def t_reverse(click):
            if ui == "old":
                pg.goto(base + "/cases/CASE-0001/hitl"); pg.wait_for_load_state("networkidle")
                pg.wait_for_selector("text=Reverse", timeout=4000)
            else:
                pg.goto(base + "/cases/CASE-0001/review"); pg.wait_for_load_state("networkidle")
                click("[role=tab]:has-text('Decided')"); click("[data-testid=review-queue] tbody a >> nth=0")
                pg.wait_for_selector("button:has-text('Reverse decision')", timeout=8000)
            return True, "reaching the reverse control (not executing it)"
        task("T7 reach the control to reverse a recorded decision", t_reverse)
        b.close()
    return out

res = {"old": run("http://127.0.0.1:8001", "old"), "new": run("http://127.0.0.1:8002", "new")}
json.dump(res, open(sys.argv[1], "w"), indent=1)
for k in res["old"]:
    o, n = res["old"][k], res["new"][k]
    print(f"{k}\n   old: {'done in ' + str(o['clicks']) + ' clicks' if o['completed'] else 'NOT POSSIBLE'} {o['note']}\n   new: {'done in ' + str(n['clicks']) + ' clicks' if n['completed'] else 'NOT POSSIBLE'} {n['note']}")
