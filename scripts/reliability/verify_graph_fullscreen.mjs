// Browser verification of the graph full-screen mode (P1.5, docs/GRAPH_FULLSCREEN.md), over raw CDP (Node 22+).
// Needs the same isolated setup as verify_graph_ui.mjs: server on 127.0.0.1:8003 serving an E2E build
// (VITE_E2E_HOOKS=1) on a throwaway `seed --ingest` store with CASE-BIG. Never point it at the live demo.
// Usage: node verify_graph_fullscreen.mjs <chrome> <outdir>   (<chrome>: a real Chromium binary)
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import path from "node:path";

const [chrome, outDir] = process.argv.slice(2);
const BASE = "http://127.0.0.1:8003";
const PORT = 9338;
const proc = spawn(chrome, ["--headless=new", "--no-sandbox", `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${mkdtempSync(path.join(outDir, "chrome-"))}`, "--window-size=1400,900", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (targets.length) break; } catch {} await sleep(200); }
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pending = new Map(); const logs = []; let graphRequests = 0;
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
ws.addEventListener("message", (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  if (msg.method === "Runtime.exceptionThrown") logs.push("EXCEPTION " + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
  if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") logs.push("ERROR " + msg.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 300));
  if (msg.method === "Network.requestWillBeSent" && /\/api\/v1\/cases\/[^/]+\/graph/.test(msg.params.request.url)) graphRequests++;
});
const ev = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result?.result?.value; };
const waitFor = async (expr, ms = 10000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await ev(expr)) return true; } catch {} await sleep(120); } return false; };
const shot = async (name) => { const r = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(path.join(outDir, name), Buffer.from(r.result.data, "base64")); };
const go = async (url) => { await send("Page.navigate", { url }); await sleep(800); };
const results = [];
const check = (name, ok, extra = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
// Real input events (a user gesture, which the Fullscreen API requires).
const click = async (selector) => {
  const c = await ev(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.scrollIntoView({ block: "center", inline: "center" });
    const r = el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
  for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x: c[0], y: c[1], button: "left", clickCount: 1 });
};
const key = async (k, code, vk) => {
  const text = k === "Enter" ? "\r" : k.length === 1 ? k : undefined;  // a real Enter keypress carries "\r", which activates buttons
  for (const type of ["keyDown", "keyUp"]) await send("Input.dispatchKeyEvent", { type, key: k, code, windowsVirtualKeyCode: vk, text: type === "keyDown" ? text : undefined });
};
const STATE = `(() => { const s = window.__sigma, st = window.__graphStore.getState(); const cam = s.getCamera().getState(); const r = s.getContainer().getBoundingClientRect();
  let shown = 0; s.getGraph().forEachNode((n) => { const d = s.getNodeDisplayData(n); if (d && !d.hidden) shown++; });
  return { ratio: +cam.ratio.toFixed(4), x: +cam.x.toFixed(4), y: +cam.y.toFixed(4), selected: st.selectedNodeId, search: st.searchTerm, minConf: st.minConfidence,
    nodes: st.nodes.length, shown, w: Math.round(r.width), h: Math.round(r.height), sameSigma: window.__sigma === window.__sigmaBefore,
    mode: document.querySelector('[data-testid=graph-workspace]').dataset.fullscreen, fsEl: document.fullscreenElement?.dataset?.testid || null }; })()`;
// Visible controls must not overlap each other and must be inside the viewport.
const CONTROLS = `(() => { const ws = document.querySelector('[data-testid=graph-workspace]');
  const els = [...ws.querySelectorAll('[data-testid=graph-fullscreen-toggle], [data-testid=graph-view-switch], button[aria-label="Zoom in"], button[aria-label="Toggle Filter Panel"], input[placeholder="Find an entity..."], button[aria-controls=graph-detail]')]
    .filter((e) => e.offsetParent !== null);
  const groups = els.map((e) => e.closest('.pointer-events-auto, [data-testid=graph-view-switch]') || e);
  const uniq = [...new Set(groups)]; const rs = uniq.map((e) => e.getBoundingClientRect());
  let overlaps = 0; for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const a = rs[i], b = rs[j];
    if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1 && !uniq[i].contains(uniq[j]) && !uniq[j].contains(uniq[i])) overlaps++; }
  const inView = rs.every((r) => r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1);
  const t = document.querySelector('[data-testid=graph-fullscreen-toggle]').getBoundingClientRect();
  return { controls: uniq.length, overlaps, inView, toggleVisible: t.width > 0 && t.height > 0 }; })()`;

await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
// Headless Chromium full-screens to its emulated *screen* (800x600 by default); give it a real one.
await send("Emulation.setDeviceMetricsOverride", { width: 0, height: 0, deviceScaleFactor: 0, mobile: false, screenWidth: 1920, screenHeight: 1080 });
const login = async (u) => {
  await go(`${BASE}/login`);
  await ev(`(async () => { const r = await fetch('/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: '${u}', password: '${u}-demo' }) });
    const j = await r.json(); localStorage.setItem('drishti.token', j.token); localStorage.setItem('drishti.user', JSON.stringify(j.user)); return true })()`);
};
const openGraph = async (cid) => {
  await go(`${BASE}/cases/${cid}/graph`);
  return waitFor(`!!window.__graphStore && !window.__graphStore.getState().isLoading && !!window.__sigma && window.__sigma.getGraph().order > 0`, 15000);
};

// ------------------------------------------------------------------ desktop, native full screen
await login("investigator");
check("CASE-0001 graph loads", await openGraph("CASE-0001"));
await sleep(1200);
// investigation context: zoom in, search, select a phone node
await click('button[aria-label="Zoom in"]'); await sleep(400); await click('button[aria-label="Zoom in"]'); await sleep(600);
const phone = await ev(`window.__graphStore.getState().nodes.find((n) => n.sourceKind === 'PHONE').id`);
await ev(`window.__graphStore.getState().selectNode(${JSON.stringify(phone)}); true`);
await ev(`window.__graphStore.getState().setMinConfidence(0.5); window.__sigmaBefore = window.__sigma; true`);
await sleep(900);
const before = await ev(STATE); const reqBefore = graphRequests;

await click('[data-testid=graph-fullscreen-toggle]');
const entered = await waitFor(`document.fullscreenElement === document.querySelector('[data-testid=graph-workspace]')`);
await sleep(700);
const inFs = await ev(STATE);
check("button enters browser full screen on the graph workspace", entered && inFs.mode === "native" && inFs.fsEl === "graph-workspace", JSON.stringify({ mode: inFs.mode, fsEl: inFs.fsEl }));
const cover = await ev(`(() => { const r = document.querySelector('[data-testid=graph-workspace]').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), innerWidth, innerHeight, screen.width, screen.height]; })()`);
// Headless Chromium sizes its full-screen window independently of the emulated screen, so assert what the page controls:
// the workspace fills the full-screen viewport exactly, and the canvas fills the rest of it.
check("workspace fills the full-screen viewport", cover[0] === cover[2] && cover[1] === cover[3] && inFs.w >= cover[2] - 400 && inFs.h > 0,
  `workspace ${cover[0]}x${cover[1]}, viewport ${cover[2]}x${cover[3]}; canvas ${before.w}x${before.h} -> ${inFs.w}x${inFs.h}`);
check("zoom, pan, selection and filters are kept (no reload, same engine)",
  inFs.ratio === before.ratio && inFs.x === before.x && inFs.y === before.y && inFs.selected === phone && inFs.minConf === 0.5 && inFs.sameSigma && graphRequests === reqBefore,
  JSON.stringify({ before: { r: before.ratio, x: before.x, y: before.y }, after: { r: inFs.ratio, x: inFs.x, y: inFs.y }, graphRequests: graphRequests - reqBefore }));
check("toggle is labelled for exit and pressed", await ev(`(() => { const b = document.querySelector('[data-testid=graph-fullscreen-toggle]'); return b.getAttribute('aria-pressed') === 'true' && b.getAttribute('aria-label') === 'Exit full screen'; })()`));
const ctlFs = await ev(CONTROLS);
check("controls visible, not overlapping, inside the screen (desktop full screen)", ctlFs.overlaps === 0 && ctlFs.inView && ctlFs.toggleVisible, JSON.stringify(ctlFs));
await shot("01-fullscreen-desktop.png");

// dialogs and tooltips must render inside the full-screen element
await waitFor(`[...document.querySelectorAll('#graph-detail button')].some((b) => b.textContent.includes('Reveal identity'))`, 6000);
const revealBtn = await ev(`(() => { const b = [...document.querySelectorAll('#graph-detail button')].find((b) => b.textContent.includes('Reveal identity')); if (!b) return false; b.setAttribute('data-probe', 'reveal'); return true; })()`);
if (revealBtn) {
  await click('[data-probe=reveal]');
  const dlgOk = await waitFor(`(() => { const d = document.querySelector('[role=dialog][data-state=open]'); const ws = document.querySelector('[data-testid=graph-workspace]');
    if (!d) return false; const r = d.getBoundingClientRect(); return ws.contains(d) && r.width > 0 && r.height > 0; })()`);
  const diag = dlgOk ? "" : JSON.stringify(await ev(`(() => { const ds = [...document.querySelectorAll('[role=dialog]')]; const ws = document.querySelector('[data-testid=graph-workspace]');
    return { dialogs: ds.length, inWorkspace: ds.map((d) => ws.contains(d)), states: ds.map((d) => d.dataset.state), fs: !!document.fullscreenElement }; })()`));
  check("reveal-reason dialog opens inside the full-screen element (visible)", dlgOk, diag);
  await shot("02-dialog-in-fullscreen.png");
  await key("Escape", "Escape", 27); await sleep(400);
  check("Esc closes the dialog first; the browser stays full screen", await ev(`!document.querySelector('[role=dialog][data-state=open]') && !!document.fullscreenElement`));
} else {
  check("reveal-reason dialog opens inside the full-screen element (visible)", false, "no Reveal identity button for the selected phone");
}
await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 5, y: 5 });
const zb = await ev(`(() => { const r = document.querySelector('button[aria-label="Zoom in"]').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: zb[0], y: zb[1] });
check("tooltips render inside the full-screen element", await waitFor(`(() => { const t = document.querySelector('[data-radix-popper-content-wrapper]'); return !!t && document.querySelector('[data-testid=graph-workspace]').contains(t); })()`, 4000));
await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 5, y: 5 });

// keyboard: F leaves full screen; state survives the round trip
await ev(`document.activeElement?.blur(); true`);
await key("f", "KeyF", 70);
const left = await waitFor(`!document.fullscreenElement && document.querySelector('[data-testid=graph-workspace]').dataset.fullscreen === 'off'`);
await sleep(700);
const after = await ev(STATE);
check("F leaves full screen", left);
check("after leaving: zoom, pan, selection, filters and size restored; no reload",
  after.ratio === before.ratio && after.x === before.x && after.y === before.y && after.selected === phone && after.minConf === 0.5 && after.sameSigma
  && Math.abs(after.w - before.w) <= 1 && Math.abs(after.h - before.h) <= 1 && graphRequests === reqBefore && after.shown === before.shown,
  JSON.stringify({ before, after, graphRequests: graphRequests - reqBefore }));
check("focus can reach the toggle and Enter activates it", await (async () => {
  await ev(`document.querySelector('[data-testid=graph-fullscreen-toggle]').focus(); true`);
  await key("Enter", "Enter", 13);
  const on = await waitFor(`!!document.fullscreenElement`);
  await key("Enter", "Enter", 13);
  const off = await waitFor(`!document.fullscreenElement`);
  return on && off && (await ev(`document.activeElement === document.querySelector('[data-testid=graph-fullscreen-toggle]')`));
})());
check("no page errors (desktop)", logs.length === 0, logs.join(" | "));

// ------------------------------------------------------------------ tablet and phone viewports (viewport resize keeps the camera)
for (const [name, w, h, mobile] of [["tablet", 820, 1180, true], ["phone", 390, 844, true]]) {
  logs.length = 0;
  const pre = await ev(STATE);
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 2, mobile });
  await sleep(900);
  const post = await ev(STATE);
  check(`${name}: resizing the window keeps the zoom`, post.ratio === pre.ratio && post.shown === pre.shown, JSON.stringify({ pre: pre.ratio, post: post.ratio }));
  await click('[data-testid=graph-fullscreen-toggle]');
  await waitFor(`document.querySelector('[data-testid=graph-workspace]').dataset.fullscreen !== 'off'`);
  await sleep(700);
  const c = await ev(CONTROLS);
  check(`${name}: full screen controls visible, not overlapping, inside the screen`, c.overlaps === 0 && c.inView && c.toggleVisible, JSON.stringify(c));
  await shot(`03-fullscreen-${name}.png`);
  await click('[data-testid=graph-fullscreen-toggle]');
  check(`${name}: exit button leaves full screen`, await waitFor(`document.querySelector('[data-testid=graph-workspace]').dataset.fullscreen === 'off'`));
  check(`${name}: no page errors`, logs.length === 0, logs.join(" | "));
}
await send("Emulation.clearDeviceMetricsOverride"); await sleep(500);

// ------------------------------------------------------------------ fallback where the Fullscreen API is unavailable
await send("Page.addScriptToEvaluateOnNewDocument", { source: `Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false }); Element.prototype.requestFullscreen = undefined;` });
logs.length = 0;
await openGraph("CASE-0001"); await sleep(800);
await ev(`window.__sigmaBefore = window.__sigma; true`);
const fb0 = await ev(STATE);
await click('[data-testid=graph-fullscreen-toggle]');
await waitFor(`document.querySelector('[data-testid=graph-workspace]').dataset.fullscreen === 'window'`);
await sleep(700);
const fb = await ev(`(() => { const r = document.querySelector('[data-testid=graph-workspace]').getBoundingClientRect(); return { covers: r.left <= 0 && r.top <= 0 && r.width >= innerWidth - 1 && r.height >= innerHeight - 1, bodyLocked: document.body.style.overflow === 'hidden' }; })()`);
check("fallback: covers the whole window and locks page scroll", fb.covers && fb.bodyLocked, JSON.stringify(fb));
const fbState = await ev(STATE);
check("fallback: same engine, zoom kept", fbState.sameSigma && fbState.ratio === fb0.ratio);
await shot("04-fallback.png");
await key("Escape", "Escape", 27);
check("fallback: Esc leaves and restores page scroll", await waitFor(`document.querySelector('[data-testid=graph-workspace]').dataset.fullscreen === 'off' && document.body.style.overflow !== 'hidden'`));
check("no page errors (fallback)", logs.length === 0, logs.join(" | "));

// ------------------------------------------------------------------ large graph
logs.length = 0;
await openGraph("CASE-BIG"); await sleep(1200);
await ev(`window.__sigmaBefore = window.__sigma; true`);
const big0 = await ev(STATE); const t0 = Date.now();
await click('[data-testid=graph-fullscreen-toggle]');
await waitFor(`document.querySelector('[data-testid=graph-workspace]').dataset.fullscreen === 'window'`); // API disabled in this page
const ms = Date.now() - t0; await sleep(700);
const big1 = await ev(STATE);
check("large graph: enters full screen quickly with every node still drawn", ms < 1500 && big1.shown === big0.shown && big1.nodes === 100 && big1.sameSigma, `${ms} ms, ${big1.shown}/${big1.nodes} shown`);
await shot("05-large-fullscreen.png");
await key("Escape", "Escape", 27); await sleep(500);
check("no page errors (large graph)", logs.length === 0, logs.join(" | "));

ws.close(); proc.kill();
const failed = results.filter((r) => !r).length;
console.log(`${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
