"""Keyboard, reflow and accessibility-tree audit (complements axe_scan.py). Usage: keyboard_audit.py <base> <out.json>

Per page, as the investigator:
  - keyboard: press Tab up to 120 times; every focused element must be visible on screen after scrolling and show a
    focus indicator (outline, box-shadow or border change vs. unfocused); the first stop must be the skip link;
    focus must not stay on one element (trap) while more stops remain.
  - reflow (WCAG 1.4.10): at 320 CSS px wide, the page must not scroll horizontally.
  - accessibility tree: count landmarks, headings and focusable controls without an accessible name.
Not a substitute for a screen-reader session with a person.
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

BASE, OUT = sys.argv[1], sys.argv[2]
AXE = open(os.environ["AXE_JS"]).read() if os.environ.get("AXE_JS") else None
C = "CASE-0001"
PAGES = ["/command-center", "/cases", f"/cases/{C}", f"/cases/{C}/evidence", f"/cases/{C}/review", f"/cases/{C}/graph?view=list",
         f"/cases/{C}/timeline", f"/cases/{C}/locations", f"/cases/{C}/analysis", f"/cases/{C}/decisions", f"/cases/{C}/reports",
         f"/cases/{C}/audit", "/profile"]

FOCUS_JS = """() => {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
  const visible = r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  const indicator = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none');
  const name = (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || el.getAttribute('placeholder') || '').trim().slice(0, 60);
  // key = position in the document (outerHTML prefixes are identical for e.g. the ten case tabs)
  return { tag: el.tagName.toLowerCase(), name, visible, indicator, key: Array.prototype.indexOf.call(document.querySelectorAll('*'), el) + ':' + el.tagName, html: el.outerHTML.slice(0, 120) };
}"""

TREE_JS = """() => {
  const q = s => Array.from(document.querySelectorAll(s));
  const named = el => !!((el.getAttribute('aria-label') || '').trim() || (el.getAttribute('aria-labelledby')) || (el.innerText || '').trim()
     || (el.getAttribute('title') || '').trim() || (el.labels && el.labels.length) || (el.getAttribute('placeholder') || '').trim()
     || (el.tagName === 'INPUT' && ['submit','button'].includes(el.type) && el.value));
  const focusables = q('a[href],button,input:not([type=hidden]),select,textarea,[tabindex]:not([tabindex="-1"])').filter(e => !e.disabled && e.offsetParent !== null);
  return {
    landmarks: { main: q('main').length, nav: q('nav').length, header: q('header').length },
    h1: q('h1').length, headings: q('h1,h2,h3').length,
    focusables: focusables.length, unnamed: focusables.filter(e => !named(e)).map(e => e.outerHTML.slice(0, 100)),
  };
}"""

res = {}
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1280, "height": 900})
    pg.goto(BASE + "/login"); pg.fill("#officer-id", "investigator"); pg.fill("#password", "investigator-demo")
    pg.click("button[type=submit]"); pg.wait_for_url("**/command-center")
    for path in PAGES:
        r = {}
        pg.set_viewport_size({"width": 1280, "height": 900})
        pg.goto(BASE + path); pg.wait_for_load_state("networkidle"); pg.wait_for_timeout(600)
        pg.evaluate("() => document.activeElement && document.activeElement.blur()")
        stops, no_indicator, invisible, repeats, first = [], [], [], 0, None
        last = None
        for i in range(120):
            pg.keyboard.press("Tab")
            pg.wait_for_timeout(40)  # let focus styles apply (composite controls such as date inputs settle late)
            f = pg.evaluate(FOCUS_JS)
            if not f:
                continue
            if i == 0:
                first = f["name"]
            if f["key"] == last:
                repeats += 1
                if repeats > 3:
                    break
            else:
                repeats = 0
            last = f["key"]
            stops.append(f["name"] or f["tag"])
            if not f["indicator"]:
                no_indicator.append(f["html"])
            if not f["visible"]:
                invisible.append(f["html"])
        r["keyboard"] = {"stops": len(stops), "first_stop": first, "no_focus_indicator": no_indicator[:5],
                         "focused_but_offscreen": invisible[:5], "trap_detected": repeats > 3}
        r["tree"] = pg.evaluate(TREE_JS)
        if AXE:
            pg.add_script_tag(content=AXE)
            r["axe"] = pg.evaluate("async () => (await axe.run(document, {runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}})).violations.map(v => v.id + ':' + v.nodes.length)")
        pg.set_viewport_size({"width": 320, "height": 800})
        pg.goto(BASE + path); pg.wait_for_load_state("networkidle"); pg.wait_for_timeout(500)
        r["reflow_320"] = {"page_scrolls_horizontally": pg.evaluate("document.documentElement.scrollWidth > 320 + 1")}
        res[path] = r
    # dialogs: new case, assign person (owner), graph list detail
    pg.set_viewport_size({"width": 1280, "height": 900})
    for name, path, opener in [("new-case-dialog", "/cases", "button:has-text('New case')"),
                               ("assign-dialog", f"/cases/{C}", "button:has-text('Add person')")]:
        pg.goto(BASE + path); pg.wait_for_load_state("networkidle")
        pg.click(opener); pg.wait_for_selector(f"[data-testid={name}]")
        focused_inside = pg.evaluate(f"() => !!document.activeElement.closest('[data-testid={name}]')")
        for _ in range(15):
            pg.keyboard.press("Tab")
        still_inside = pg.evaluate(f"() => !!document.activeElement.closest('[data-testid={name}]')")
        dialog_axe = None
        if AXE:
            pg.add_script_tag(content=AXE)
            dialog_axe = pg.evaluate(f"async () => (await axe.run(document.querySelector('[data-testid={name}]'), {{runOnly:{{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}}})).violations.map(v => v.id + ':' + v.nodes.length)")
        pg.keyboard.press("Escape")
        closed = pg.locator(f"[data-testid={name}]").count() == 0
        res[f"dialog:{name}"] = {"focus_moves_into_dialog": focused_inside, "focus_trapped_in_dialog": still_inside,
                                 "escape_closes": closed, "axe": dialog_axe}
    b.close()

json.dump(res, open(OUT, "w"), indent=1)
issues = 0
for k, v in res.items():
    if k.startswith("dialog:"):
        ok = v["focus_moves_into_dialog"] and v["focus_trapped_in_dialog"] and v["escape_closes"] and not v["axe"]
        issues += 0 if ok else 1
        print(f"{k:40s} {'OK' if ok else 'ISSUE'} {v}")
        continue
    kb, tr = v["keyboard"], v["tree"]
    flags = []
    if kb["first_stop"] != "Skip to content": flags.append(f"first stop={kb['first_stop']!r}")
    if kb["no_focus_indicator"]: flags.append(f"{len(kb['no_focus_indicator'])} stops without focus indicator")
    if kb["trap_detected"]: flags.append("keyboard trap")
    if tr["unnamed"]: flags.append(f"{len(tr['unnamed'])} unnamed controls")
    if tr["h1"] != 1: flags.append(f"h1 count {tr['h1']}")
    if not tr["landmarks"]["main"]: flags.append("no main")
    if v["reflow_320"]["page_scrolls_horizontally"]: flags.append("scrolls horizontally at 320px")
    if v.get("axe"): flags.append(f"axe {v['axe']}")
    issues += len(flags)
    print(f"{k:40s} tab stops {kb['stops']:3d}  {'OK' if not flags else '; '.join(flags)}")
print("TOTAL ISSUES:", issues)
