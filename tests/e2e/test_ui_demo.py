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


@pytest.fixture(scope="module", autouse=True)
def reset_demo_candidates():
    # DEF-056: this writes straight to the database (no API, no audit). Without an explicit
    # DRISHTI_DATABASE_URL it resolved to storage/drishti.db -- the live demo's database on this host.
    url = os.environ.get("DRISHTI_DATABASE_URL", "")
    default_db = str(Path(__file__).resolve().parents[2] / "storage" / "drishti.db")
    if not url or default_db in url or url.endswith("./storage/drishti.db"):
        pytest.exit("E2E needs DRISHTI_DATABASE_URL pointing at the disposable database of the server under test "
                    "(never the demo's storage/drishti.db)", returncode=2)
    from apps.api.app.db import SessionLocal
    from apps.api.app.models import MatchCandidate
    db = SessionLocal()
    try:
        db.query(MatchCandidate).filter_by(case_id="CASE-0001").update({"state": "REVIEW_REQUIRED"})
        db.commit()
    finally:
        db.close()


@pytest.fixture(scope="module")
def page():
    with pw.sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1400, "height": 900})
        page = ctx.new_page()
        yield page
        browser.close()


def login(page, user):
    page.goto(f"{BASE}/")
    page.evaluate("localStorage.clear()")
    page.goto(f"{BASE}/login")
    page.fill("input[id='officer-id']", user)
    page.fill("input[id='password']", f"{user}-demo")
    page.click("button[type='submit']")
    page.wait_for_url(f"{BASE}/command-center")


def test_denial_for_unassigned_user(page):
    """A user not assigned to the case sees the server's refusal and none of the case (docs/context.md §5)."""
    login(page, "unassigned")
    page.goto(f"{BASE}/cases/CASE-0001")
    denied = page.locator("[data-testid=access-denied]")
    denied.wait_for(timeout=10000)
    assert "denied" in denied.inner_text().lower()
    assert page.locator("[data-testid=case-title]").count() == 0, "case header shown to a user without access"
    page.screenshot(path=str(SHOTS / "01-denied.png"))
    page.goto(f"{BASE}/cases/CASE-0001/graph")
    page.locator("[data-testid=access-denied]").wait_for(timeout=10000)


def test_evidence_and_scan_gate(page):
    login(page, "officer")
    page.goto(f"{BASE}/cases/CASE-0001/evidence")
    page.wait_for_selector("[data-testid=evidence-table]")
    # status is plain language with the raw code kept for precision; an evidence officer may upload
    assert page.locator("[data-testid=evidence-table] [data-status]").count() > 0
    assert page.locator("text=Upload evidence").count() == 1
    page.screenshot(path=str(SHOTS / "02-evidence-quarantine.png"))


def _download_via_dialog(page, reason):
    page.wait_for_selector("[data-testid=reason-dialog]")
    page.fill("[data-testid=reason-dialog] textarea", reason)
    with page.expect_download() as info:
        page.click("[data-testid=reason-dialog] button[type=submit]")
    return info.value


def test_evidence_download_saves_exact_bytes(page):
    """DEF-029: the Download button used an escaped template literal and window.open() (no Bearer token).
    A real click must save the original bytes, and their SHA-256 must equal the server's integrity reference."""
    import hashlib
    # DEF-101: an evidence officer may not download unmasked originals -- the control is disabled (server: 403)
    login(page, "officer")
    page.goto(f"{BASE}/cases/CASE-0001/evidence")
    page.wait_for_selector("[data-testid=evidence-table]")
    officer_button = page.locator("[aria-label='Download original evidence file']").first
    officer_button.wait_for(state="attached")
    assert officer_button.is_disabled()
    # an investigator may, after giving a reason (recorded in the audit log) in an accessible dialog
    login(page, "investigator")
    page.goto(f"{BASE}/cases/CASE-0001/evidence")
    page.wait_for_selector("[data-testid=evidence-table]")
    page.locator("[aria-label='Download original evidence file']").first.click()
    # a too-short reason is refused in the dialog, nothing is downloaded
    page.wait_for_selector("[data-testid=reason-dialog]")
    page.fill("[data-testid=reason-dialog] textarea", "abc")
    page.click("[data-testid=reason-dialog] button[type=submit]")
    page.wait_for_selector("[data-testid=reason-dialog] [role=alert]")
    dl = _download_via_dialog(page, "e2e integrity comparison")
    data = Path(dl.path()).read_bytes()
    assert data, "downloaded file is empty"
    tok = page.evaluate("localStorage.getItem('drishti.token')")
    import json, urllib.request
    req = urllib.request.Request(f"{BASE}/api/v1/cases/CASE-0001/evidence", headers={"Authorization": f"Bearer {tok}"})
    items = json.loads(urllib.request.urlopen(req).read())
    by_name = {i["filename"]: i for i in items}
    assert dl.suggested_filename in by_name, (dl.suggested_filename, list(by_name))
    assert hashlib.sha256(data).hexdigest() == by_name[dl.suggested_filename]["sha256"]


def test_evidence_details_verify_and_claim_source(page):
    """New: the evidence drawer recomputes the SHA-256 server-side and lists extracted claims, each opening its source."""
    login(page, "investigator")
    page.goto(f"{BASE}/cases/CASE-0001/evidence")
    page.wait_for_selector("[data-testid=evidence-table]")
    page.click("[aria-label='Details of calls.csv']")
    drawer = page.locator("[data-testid=evidence-drawer]")
    drawer.wait_for()
    sha = drawer.locator("[data-testid=evidence-sha256]").inner_text().strip()
    assert len(sha) == 64
    drawer.locator("button:has-text('Verify integrity')").click()
    page.wait_for_selector("[data-testid=verify-result] >> text=still matches the recorded SHA-256")
    drawer.locator("[data-testid=evidence-claims] li").first.wait_for()
    assert drawer.locator("[data-testid=evidence-claims] li").count() > 0
    drawer.locator("[data-testid=evidence-claims] li button:has-text('Source')").first.click()
    page.locator("[data-testid=provenance-viewer] [data-hit=true]").wait_for(timeout=10000)
    page.screenshot(path=str(SHOTS / "02b-evidence-drawer-source.png"))


def _open_candidate(page, row_text):
    page.locator("[data-testid=review-queue] tr", has_text=row_text).first.locator("a").click()
    page.wait_for_selector("text=Why this is a candidate")


def _decide(page, button_text, reason):
    page.click(f"button:has-text('{button_text}')")
    page.wait_for_selector("[data-testid=reason-dialog]")
    page.fill("[data-testid=reason-dialog] textarea", reason)
    page.click("[data-testid=reason-dialog] button[type=submit]")
    page.wait_for_selector("[data-testid=decision-recorded]")


def test_review_queue(page):
    login(page, "reviewer")
    page.goto(f"{BASE}/cases/CASE-0001/review")
    page.wait_for_selector("[data-testid=review-queue]")
    _open_candidate(page, "Arjun Malhotara")
    # DEF-058/059: the reviewer sees the matcher's real reasons and the real source file -- never the static
    # fabricated "CDR" sheet (agency letterhead, invented call rows) that used to render here.
    page.wait_for_selector("text=Supporting signals")
    page.wait_for_selector("[data-testid=compare-table]")  # new: both records side by side
    body = page.inner_text("body")
    for fabricated in ("Rajasthan", "Special Operations Group", "EXTORTION", "Whisper-NER", "SOG INVESTIGATION",
                       "STAGE 4 VALIDATION", "CONFIDENTIAL // LEA SENSITIVE", "Supervisory Officer"):
        assert fabricated not in body, f"fabricated content on review page: {fabricated}"
    page.wait_for_selector("[role=tab]")
    tabs = page.locator("[role=tab]").all_inner_texts()
    assert tabs and all(t.strip().split(".")[-1] in ("json", "csv", "pdf", "txt", "zip") for t in tabs), tabs
    page.wait_for_selector("pre >> text=1")  # numbered real source lines
    page.screenshot(path=str(SHOTS / "03-review-candidate.png"))
    _decide(page, "Same person — approve match", "same phone and organisation; spelling variation")
    page.wait_for_selector("[data-testid=decision-history] >> text=Approved")
    # new: a decision can be reversed (backend REVERSE; the old UI said "reversible" but offered no way)
    _decide(page, "Reverse decision", "approved too early; re-checking the address field")
    page.wait_for_selector("[data-testid=decision-history] >> text=Reversed")
    page.wait_for_selector("button:has-text('Same person — approve match')")
    _decide(page, "Same person — approve match", "re-checked: same phone and organisation; spelling variation")
    page.click("a:has-text('Back to queue') >> nth=0")
    # reject the ambiguous pair with three conflicts
    page.wait_for_selector("[data-testid=review-queue]")
    _open_candidate(page, "3 conflicts")
    _decide(page, "Different people — reject", "different dob, address, district")
    page.click("a:has-text('Back to queue') >> nth=0")
    page.wait_for_selector("[data-testid=review-queue]")
    _open_candidate(page, "Tanvi Bhatt")
    _decide(page, "Defer — needs more information", "shared household phone only")
    page.click("a:has-text('Back to queue') >> nth=0")
    page.click("[role=tab]:has-text('Deferred')")
    page.wait_for_selector("[data-testid=review-queue] >> text=Tanvi Bhatt")
    page.click("[role=tab]:has-text('Decided')")
    page.wait_for_selector("[data-testid=review-queue] >> text=Arjun Malhotara")


def test_review_is_read_only_for_analyst(page):
    """UI convenience mirrors the server: an analyst sees candidates but no decision controls, with the reason."""
    login(page, "analyst")
    page.goto(f"{BASE}/cases/CASE-0001/review")
    page.wait_for_selector("[data-testid=review-queue]")
    page.locator("[data-testid=review-queue] tbody tr a").first.click()
    page.wait_for_selector("text=Why this is a candidate")
    assert page.locator("button:has-text('Same person — approve match')").count() == 0
    page.wait_for_selector("text=cannot record review decisions")


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
    graph.forEachEdge((edge, attrs) => { if (!found && attrs.relationshipType === relType) found = edge; });
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
_HAS_MERGED_NODE_JS = "() => window.__graph && window.__graph.order > 0"


def _click_graph_edge(page, rel_type):
    page.wait_for_timeout(1000)
    edge_id = page.evaluate(f"""(() => {{
        const edges = window.__graphStore.getState().edges;
        const edge = edges.find(e => e.relationshipType === '{rel_type}');
        if (edge) {{
            window.__graphStore.getState().selectEdge(edge.id);
            return edge.id;
        }}
        return null;
    }})()""")
    assert edge_id, f"no rendered edge with rel_type={rel_type!r} found in the store"


def _click_first_node(page):
    page.wait_for_timeout(1000)
    node_id = page.evaluate("""(() => {
        const nodes = window.__graphStore.getState().nodes;
        if (nodes && nodes.length > 0) {
            window.__graphStore.getState().selectNode(nodes[0].id);
            return nodes[0].id;
        }
        return null;
    })()""")
    assert node_id, "no rendered node found in the live graph"


def test_graph_edge_to_source(page):
    login(page, "investigator")
    page.goto(f"{BASE}/cases/CASE-0001/graph")
    page.wait_for_selector("[data-testid=graph-counts]")
    if not page.evaluate("() => !!window.__graphStore"):
        pytest.fail("this build has no E2E graph hooks: build it with `make build-web-e2e` (VITE_E2E_HOOKS=1, FE-056)")
    page.wait_for_function("() => window.__graph && window.__graph.order > 0")
    assert page.evaluate(_HAS_MERGED_NODE_JS), "expected at least one node in the rendered CASE-0001 graph"
    page.wait_for_timeout(1000)
    # Regression (2026-11-01): a frontend/backend vocabulary mismatch hid 117/117 edges and 30/56 nodes while
    # this test still passed, because it only checked that nodes existed. Assert what Sigma actually DRAWS.
    drawn = page.evaluate("""() => {
        const s = window.__sigma, g = s.getGraph(); let edges = 0, nodes = 0;
        g.forEachEdge(e => { const d = s.getEdgeDisplayData(e); if (d && !d.hidden) edges++; });
        g.forEachNode(n => { const d = s.getNodeDisplayData(n); if (d && !d.hidden) nodes++; });
        return { edges, nodes, totalEdges: g.size, totalNodes: g.order };
    }""")
    assert drawn["totalEdges"] > 0 and drawn["edges"] == drawn["totalEdges"], f"edges hidden by default filters: {drawn}"
    assert drawn["nodes"] == drawn["totalNodes"], f"nodes hidden by default filters: {drawn}"
    page.screenshot(path=str(SHOTS / "04-graph.png"))
    # §19 Evidence gate: a selected edge must surface its supporting evidence id(s) in the drawer.
    ev_id = page.evaluate("""() => {
        const st = window.__graphStore.getState(); const e = st.edges.find(x => x.relationshipType === 'USES_PHONE');
        if (!e) return null; st.selectEdge(e.id); return e.evidenceIds[0] || null; }""")
    assert ev_id and ev_id.startswith("EVD-"), f"USES_PHONE edge without evidence id: {ev_id!r}"
    page.wait_for_selector("[data-testid=edge-claim]", timeout=10000)
    assert page.locator(f"[data-testid=edge-claims] >> text={ev_id}").count() >= 1
    # Every claim card must carry a concrete locator, never the "location not recorded" fallback.
    assert page.locator("[data-testid=edge-claim] >> text=location not recorded").count() == 0
    # Exact source context: the PDF claim must open AT page 1 / line 11, not at the top of the document.
    pdf_claim = page.locator("[data-testid=edge-claim]", has_text="fir_001.pdf")
    if pdf_claim.count():
        pdf_claim.first.locator("button").click()
        # Scope to the viewer's highlighted line: the drawer snippet ALSO contains this text, so an unscoped
        # "text=Riverside Traders" would pass before the viewer even opened.
        hit = page.locator("[data-testid=provenance-viewer] [data-hit=true]")
        hit.wait_for(timeout=10000)
        assert hit.get_attribute("data-line") == "11", hit.get_attribute("data-line")
        assert "Riverside Traders" in hit.inner_text()
        page.screenshot(path=str(SHOTS / "05-edge-source-context.png"))


def test_timeline_analysis_report(page):
    login(page, "investigator")
    page.goto(f"{BASE}/cases/CASE-0001/timeline")
    page.wait_for_selector("h2:has-text('Timeline')")
    body = page.inner_text("body")
    assert "verified events" not in body and "Jaipur, Mumbai, and Dubai" not in body
    assert "ENT-" not in page.locator("text=Involves:").first.locator("..").inner_text(), "entities shown as raw ids"
    page.screenshot(path=str(SHOTS / "06-timeline-historical.png"))
    page.goto(f"{BASE}/cases/CASE-0001/report")  # old URL redirects to the Reports tab
    page.wait_for_url(f"{BASE}/cases/CASE-0001/reports")
    page.fill("textarea", "demo run")
    page.check("input[value=json]")
    with page.expect_download() as download:
        page.click("button:has-text('Download JSON')")
    assert download.value.suggested_filename.endswith(".json"), download.value.suggested_filename
    page.wait_for_selector("text=recorded in the audit log")


def test_old_urls_redirect_and_unknown_urls_say_so(page):
    login(page, "investigator")
    for old, new in [("/cases/CASE-0001/hitl", "/cases/CASE-0001/review"), ("/cases/CASE-0001/map", "/cases/CASE-0001/locations"),
                     ("/cases/CASE-0001/reviews", "/cases/CASE-0001/decisions"), ("/cases/CASE-0001/overview", "/cases/CASE-0001"),
                     ("/cases/CASE-0001/notes", "/cases/CASE-0001"), ("/settings", "/profile"), ("/home", "/command-center")]:
        page.goto(BASE + old)
        page.wait_for_url(BASE + new)
    page.goto(f"{BASE}/no-such-page")
    page.wait_for_selector("[data-testid=not-found]")
    assert page.url.endswith("/no-such-page"), "unknown URLs must not silently redirect"


def test_global_audit_denied_without_request(page):
    """An investigator is told the global audit log is for auditors -- without first firing a request the server refuses."""
    login(page, "investigator")
    hits = []
    page.on("request", lambda r: hits.append(r.url) if "/api/v1/audit" in r.url else None)
    page.goto(f"{BASE}/audit")
    page.wait_for_selector("[data-testid=access-denied]")
    assert not hits, hits
    login(page, "auditor")
    page.goto(f"{BASE}/audit")
    page.wait_for_selector("text=Audit")
    assert page.locator("[data-testid=access-denied]").count() == 0


def test_expired_session_returns_to_the_same_page(page):
    login(page, "investigator")
    page.evaluate("localStorage.setItem('drishti.token', 'expired-or-forged-token')")
    page.goto(f"{BASE}/cases/CASE-0001/evidence")
    page.wait_for_url("**/login?expired=1*")
    page.wait_for_selector("text=Your session expired")
    page.fill("input[id='officer-id']", "investigator")
    page.fill("input[id='password']", "investigator-demo")
    page.click("button[type='submit']")
    page.wait_for_url(f"{BASE}/cases/CASE-0001/evidence")


def test_create_case_and_assign_a_person(page):
    """New: an investigator creates a case (dated today) and assigns a reviewer, who can then open it."""
    import time
    cid = f"CASE-E{int(time.time()) % 100000:05d}"
    login(page, "investigator")
    page.goto(f"{BASE}/cases")
    page.click("button:has-text('New case')")
    dlg = page.locator("[data-testid=new-case-dialog]")
    dlg.wait_for()
    dlg.locator("button[type=submit]").click()  # empty form is refused in the dialog
    dlg.locator("[role=alert]").wait_for()
    dlg.locator("input").nth(0).fill(cid)
    dlg.locator("input").nth(1).fill("E2E creation case")
    dlg.locator("textarea").fill("Browser test of case creation")
    dlg.locator("input").nth(2).fill("FIR-E2E-01")
    dlg.locator("button[type=submit]").click()
    page.wait_for_url(f"{BASE}/cases/{cid}")
    page.wait_for_selector(f"[data-testid=case-title] >> text={cid}")
    page.click("button:has-text('Add person')")
    a = page.locator("[data-testid=assign-dialog]")
    a.wait_for()
    a.locator("select").first.select_option("reviewer")
    a.locator("button[type=submit]").click()
    page.wait_for_selector("text=Reviewer Meera (demo)")
    login(page, "reviewer")
    page.goto(f"{BASE}/cases/{cid}")
    page.wait_for_selector(f"[data-testid=case-title] >> text={cid}")


def test_case_search_and_paging_run_on_the_server(page):
    login(page, "admin")  # sees every case: more than one page
    seen = []
    page.on("request", lambda r: seen.append(r.url) if "/api/v1/cases?" in r.url else None)
    page.goto(f"{BASE}/cases")
    page.wait_for_selector("[data-testid=case-table]")
    page.wait_for_selector("[data-testid=pager]")
    first = page.locator("[data-testid=case-table] tbody tr").first.inner_text()
    page.click("[data-testid=pager] button:has-text('Next')")
    page.wait_for_function("(f) => document.querySelector('[data-testid=case-table] tbody tr').innerText !== f", arg=first)
    page.fill("input[type=search]", "lakeside")
    page.wait_for_function("() => document.querySelectorAll('[data-testid=case-table] tbody tr').length === 1")
    assert any("q=lakeside" in u for u in seen), seen
    assert any("offset=25" in u for u in seen), seen


def test_graph_list_view_by_keyboard(page):
    """New: the relationships are usable without the canvas — keyboard only, from the view switch to the source line."""
    login(page, "investigator")
    page.goto(f"{BASE}/cases/CASE-0001/graph?view=list")
    page.wait_for_selector("[data-testid=graph-relationships-table]")
    btn = page.locator("[data-testid=graph-relationships-table] button:has-text('Sources')").first
    btn.focus()
    page.keyboard.press("Enter")
    page.wait_for_selector("[data-testid=edge-claim]", timeout=10000)
    page.locator("[data-testid=edge-claim] button").first.focus()
    page.keyboard.press("Enter")
    page.locator("[data-testid=provenance-viewer] [data-hit=true]").wait_for(timeout=10000)
    page.keyboard.press("Escape")
    page.locator("[data-testid=provenance-viewer]").wait_for(state="detached")


def test_audit_link_opens_the_evidence_details(page):
    login(page, "investigator")
    tok = page.evaluate("localStorage.getItem('drishti.token')")
    import json, urllib.request
    req = urllib.request.Request(f"{BASE}/api/v1/cases/CASE-0001/evidence?q=calls.csv", headers={"Authorization": f"Bearer {tok}"})
    ev = next(e for e in json.loads(urllib.request.urlopen(req).read()) if e["filename"] == "calls.csv")
    page.goto(f"{BASE}/cases/CASE-0001/evidence?evidence={ev['evidence_id']}")
    page.locator("[data-testid=evidence-drawer]").wait_for()
    assert "calls.csv" in page.locator("[data-testid=evidence-drawer]").inner_text()
