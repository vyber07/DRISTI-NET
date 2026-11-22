"""Run axe-core (WCAG 2.0/2.1/2.2 A+AA rules) on each route. Usage: a11y.py <base> <out.json> <routes-set>"""
import json, os, sys
from playwright.sync_api import sync_playwright
BASE, OUT, SET = sys.argv[1], sys.argv[2], sys.argv[3]
AXE = open(os.environ["AXE_JS"]).read()  # path to axe.min.js from `npm pack axe-core@4.10.2`
C = "CASE-0001"
if SET == "after":
    routes = ["/command-center", "/cases", f"/cases/{C}", f"/cases/{C}/evidence", f"/cases/{C}/review", f"/cases/{C}/graph",
              f"/cases/{C}/timeline", f"/cases/{C}/locations", f"/cases/{C}/analysis", f"/cases/{C}/decisions", f"/cases/{C}/reports",
              f"/cases/{C}/audit", "/profile"]
else:
    routes = ["/command-center", "/cases", f"/cases/{C}", f"/cases/{C}/evidence", f"/cases/{C}/hitl", f"/cases/{C}/graph",
              f"/cases/{C}/timeline", f"/cases/{C}/map", f"/cases/{C}/analysis", f"/cases/{C}/reviews", f"/cases/{C}/reports",
              f"/cases/{C}/audit", "/profile"]
res = {}
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1440, "height": 900})
    pg.goto(BASE + "/login")
    # the login page itself
    pg.add_script_tag(content=AXE)
    r = pg.evaluate("async () => (await axe.run(document, {runOnly: {type:'tag', values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}})).violations.map(v => ({id:v.id, impact:v.impact, nodes:v.nodes.length, help:v.help}))")
    res["/login"] = r
    pg.fill("#officer-id", "investigator"); pg.fill("#password", "investigator-demo"); pg.click("button[type=submit]"); pg.wait_for_url("**/command-center")
    for route in routes:
        pg.goto(BASE + route); pg.wait_for_load_state("networkidle"); pg.wait_for_timeout(800)
        pg.add_script_tag(content=AXE)
        res[route] = pg.evaluate("async () => (await axe.run(document, {runOnly: {type:'tag', values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}})).violations.map(v => ({id:v.id, impact:v.impact, nodes:v.nodes.length, help:v.help}))")
    b.close()
json.dump(res, open(OUT, "w"), indent=1)
tot = sum(v["nodes"] for vs in res.values() for v in vs)
rules = {}
for vs in res.values():
    for v in vs: rules[v["id"]] = rules.get(v["id"], 0) + v["nodes"]
print(f"{SET}: {sum(len(v) for v in res.values())} rule violations, {tot} elements; by rule:", dict(sorted(rules.items(), key=lambda x: -x[1])))
