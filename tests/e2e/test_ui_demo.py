"""End-to-end UI walk-through of the demo script against a running server (http://localhost:8000).

Run:  python3 -m pytest tests/e2e -q      (needs `playwright install chromium`)
Screenshots land in reports/screenshots/.
"""
import os
from pathlib import Path

import pytest

pw = pytest.importorskip("playwright.sync_api")
BASE = os.environ.get("DRISHTI_UI", "http://localhost:8000")
SHOTS = Path(__file__).resolve().parents[2] / "reports" / "screenshots"
SHOTS.mkdir(parents=True, exist_ok=True)


@pytest.fixture(scope="module")
def page():
    with pw.sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1400, "height": 900})
        page = ctx.new_page()
        yield page
        browser.close()


def login(page, user):
    page.goto(f"{BASE}/login")
    page.fill("input[placeholder=username]", user)
    page.fill("input[placeholder=password]", f"{user}-demo")
    page.click("button:has-text('Sign in')")
    page.wait_for_url(f"{BASE}/")


def test_denial_for_unassigned_user(page):
    login(page, "unassigned")
    page.click("text=Test: request CASE-0001 directly")
    page.wait_for_selector("text=HTTP 403")
    page.screenshot(path=str(SHOTS / "01-denied.png"))
    page.goto(f"{BASE}/cases/CASE-0001/graph")
    page.wait_for_selector("text=HTTP 403")


def test_evidence_and_scan_gate(page):
    login(page, "officer")
    page.click("a:has-text('CASE-0001')")
    page.click("a.case-nav-item:has-text('Evidence')")
    page.wait_for_selector("text=Evidence manifest")
    page.set_input_files("input[type=file]", str(Path("data/synthetic/documents/eicar_test.txt").resolve()))
    page.click("button:has-text('Upload')")
    page.wait_for_selector("text=File is in quarantine")
    assert page.locator("td >> text=INFECTED").count() >= 1
    page.screenshot(path=str(SHOTS / "02-evidence-quarantine.png"))
    page.click("tr:has-text('calls.csv')")
    page.click("button:has-text('Verify hash')")
    page.wait_for_selector("text=Hash matches manifest")


def test_review_queue(page):
    login(page, "reviewer")
    page.goto(f"{BASE}/cases/CASE-0001/review")
    page.wait_for_selector("text=Identity-match candidates")
    page.click("tr:has-text('Arjun Malhotara')")
    page.wait_for_selector("text=Why these may be the same entity")
    page.screenshot(path=str(SHOTS / "03-review-candidate.png"))
    page.fill("textarea", "same phone and organisation; spelling variation")
    page.click("button:has-text('Accept')")
    page.wait_for_selector(".pill:has-text('APPROVE')")
    # reject the ambiguous pair with three conflicts
    page.click("tr:has-text('Rahul Verma') >> nth=-1")
    page.wait_for_selector("text=Counter-evidence")
    page.fill("textarea", "different dob, address, district")
    page.click("button:has-text('Reject')")
    page.wait_for_selector(".pill:has-text('REJECT')")
    page.click("tr:has-text('Tanvi Bhatt')")
    page.fill("textarea", "shared household phone only")
    page.click("button:has-text('Defer')")
    page.wait_for_selector(".pill:has-text('DEFER')")


# The graph renders to a WebGL <canvas> via Sigma.js (no per-node/edge DOM elements to select), so these
# helpers compute real on-screen pixel coordinates from the Sigma/Graphology instances the component
# exposes on `window` for exactly this purpose (see GraphView.tsx) and issue a genuine mouse click —
# the same class of interaction a person performs, not a synthetic DOM event.

# sigma.getNodeDisplayData() returns coordinates in normalized "framed graph" space (~0..1); it must be
# converted with framedGraphToViewport() to get real on-screen pixels, then offset by the container's
# position on the page (confirmed empirically: displayData ~{0.57, 0.28} -> framedGraphToViewport ~
# {514, 431} inside a 930x560 container -- the un-converted value is not a usable pixel coordinate).
_FIND_EDGE_JS = """(relType) => {
    const graph = window.__graph, sigma = window.__sigma;
    if (!graph || !sigma) return null;
    let found = null;
    graph.forEachEdge((edge, attrs) => { if (!found && attrs.raw && attrs.raw.rel_type === relType) found = edge; });
    if (!found) return null;
    const s = sigma.getNodeDisplayData(graph.source(found));
    const t = sigma.getNodeDisplayData(graph.target(found));
    const mid = sigma.framedGraphToViewport({ x: (s.x + t.x) / 2, y: (s.y + t.y) / 2 });
    const rect = sigma.getContainer().getBoundingClientRect();
    return { x: rect.left + mid.x, y: rect.top + mid.y };
}"""
_FIND_FIRST_NODE_JS = """() => {
    const graph = window.__graph, sigma = window.__sigma;
    if (!graph || !sigma || graph.order === 0) return null;
    const first = graph.nodes()[0];
    const d = sigma.getNodeDisplayData(first);
    const p = sigma.framedGraphToViewport({ x: d.x, y: d.y });
    const rect = sigma.getContainer().getBoundingClientRect();
    return { x: rect.left + p.x, y: rect.top + p.y, nodeId: first };
}"""
_HAS_MERGED_NODE_JS = "() => window.__graph && window.__graph.someNode((_, a) => a.raw && a.raw.merged_from && a.raw.merged_from.length > 0)"


def _click_graph_edge(page, rel_type):
    coords = page.evaluate(_FIND_EDGE_JS, rel_type)
    assert coords, f"no rendered edge with rel_type={rel_type!r} found in the live graph"
    page.mouse.click(coords["x"], coords["y"])


def _click_first_node(page):
    coords = page.evaluate(_FIND_FIRST_NODE_JS)
    assert coords, "no rendered node found in the live graph"
    page.mouse.click(coords["x"], coords["y"])


def test_graph_edge_to_source(page):
    login(page, "investigator")
    page.goto(f"{BASE}/cases/CASE-0001/graph")
    page.wait_for_function("() => window.__graph && window.__graph.order > 0")
    assert page.evaluate(_HAS_MERGED_NODE_JS), "expected at least one merged entity in the rendered CASE-0001 graph"
    page.screenshot(path=str(SHOTS / "04-graph.png"))
    _click_graph_edge(page, "CALLED")
    page.wait_for_selector("text=Candidate relationship")
    page.click("text=open source context")
    page.wait_for_selector("text=hash verified")
    page.screenshot(path=str(SHOTS / "05-evidence-drawer.png"))
    # Sigma tracks click/double-click timing on the whole stage, not per-target; without a real pause here
    # this click can land inside the window left by the previous canvas click above and get promoted to a
    # double-click (which re-centers the graph) instead of a plain select -- confirmed by reproducing both
    # ways against a live server, not assumed.
    page.wait_for_timeout(500)
    _click_first_node(page)
    page.wait_for_selector("text=entity_id")


def test_timeline_analysis_report(page):
    page.goto(f"{BASE}/cases/CASE-0001/timeline")
    page.click("text=show 2019 (historical)")
    page.wait_for_selector(".pill.hist")
    page.screenshot(path=str(SHOTS / "06-timeline-historical.png"))
    page.goto(f"{BASE}/cases/CASE-0001/analysis")
    page.wait_for_selector("text=Bridge candidates")
    page.wait_for_selector("text=communication_burst")
    page.screenshot(path=str(SHOTS / "07-analysis.png"))
    page.goto(f"{BASE}/cases/CASE-0001/report")
    page.fill("textarea", "demo run")
    page.click("button:has-text('Export JSON')")
    page.wait_for_selector("text=does not determine guilt")
    page.screenshot(path=str(SHOTS / "08-report.png"))
    page.goto(f"{BASE}/cases/CASE-0001/audit")
    page.wait_for_selector("td:has-text('REVIEW_DECISION')")
    page.screenshot(path=str(SHOTS / "09-audit.png"))
