// Browser verification of graph loading and rendering (P1.4, docs/GRAPH_LOADING.md), over raw CDP (Node 22+).
// Needs: an isolated server on 127.0.0.1:8003 serving an E2E build (VITE_E2E_HOOKS=1, exposes window.__sigma and
// window.__graphStore) on a throwaway store seeded with `seed --ingest`, plus CASE-BIG (scripts in docs/GRAPH_LOADING.md).
// Never point it at the live demo. Usage: node verify_graph_ui.mjs <chrome> <outdir>
//   <chrome>: a real Chromium, e.g. ~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import path from "node:path";

const [chrome, outDir] = process.argv.slice(2);
const BASE = "http://127.0.0.1:8003";
const PORT = 9337;
const proc = spawn(chrome, ["--headless=new", "--no-sandbox", `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${mkdtempSync(path.join(outDir, "chrome-"))}`, "--window-size=1400,900", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (targets.length) break; } catch {} await sleep(200); }
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pending = new Map(); const logs = [];
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
ws.addEventListener("message", (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  if (msg.method === "Runtime.exceptionThrown") logs.push("EXCEPTION " + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
  if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") logs.push("ERROR " + msg.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 300));
  if (msg.method === "Network.responseReceived" && msg.params.response.status >= 500) logs.push(`HTTP ${msg.params.response.status} ${msg.params.response.url}`);
  if (msg.method === "Network.loadingFailed" && !/ERR_ABORTED/.test(msg.params.errorText)) logs.push(`NETFAIL ${msg.params.errorText}`);
});
const ev = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); return r.result?.result?.value; };
const waitFor = async (expr, ms = 15000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await ev(expr)) return true; } catch {} await sleep(150); } return false; };
const shot = async (name) => { const r = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(path.join(outDir, name), Buffer.from(r.result.data, "base64")); };
const go = async (url) => { await send("Page.navigate", { url }); await sleep(800); };
const results = [];
const check = (name, ok, extra = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");

const login = async (u) => {
  await go(`${BASE}/login`);
  await ev(`(async () => { const r = await fetch('/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: '${u}', password: '${u}-demo' }) });
    const j = await r.json(); localStorage.setItem('drishti.token', j.token); localStorage.setItem('drishti.user', JSON.stringify(j.user)); return true })()`);
};
const MEASURE = `(() => {
  const s = window.__sigma, st = window.__graphStore.getState(); const g = s.getGraph();
  let shownN = 0, shownE = 0; const pts = [];
  g.forEachNode((n) => { const d = s.getNodeDisplayData(n); if (d && !d.hidden) { shownN++; const v = s.framedGraphToViewport({ x: d.x, y: d.y }); pts.push([v.x, v.y, s.scaleSize ? s.scaleSize(d.size) : d.size]); } });
  g.forEachEdge((e) => { const d = s.getEdgeDisplayData(e); if (d && !d.hidden) shownE++; });
  let ov = 0; for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) if (Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) < pts[i][2] + pts[j][2]) ov++;
  const r = s.getContainer().getBoundingClientRect();
  const inside = pts.every(([x, y]) => x >= 0 && y >= 0 && x <= r.width && y <= r.height);
  return { storeNodes: st.nodes.length, storeEdges: st.edges.length, shownNodes: shownN, shownEdges: shownE, overlapPairs: ov, inside,
    radius: pts.length ? +pts[0][2].toFixed(1) : null, banner: document.querySelector('[data-testid=graph-bounds]')?.textContent || null, error: st.error };
})()`;
const api = (cid) => ev(`fetch('/api/v1/cases/${cid}/graph', { headers: { Authorization: 'Bearer ' + localStorage.getItem('drishti.token') } }).then(r => r.json()).then(j => ({ nodes: j.nodes.length, edges: j.edges.length, truncated: j.truncated, total: j.total_nodes }))`);

await login("investigator");
for (const cid of ["CASE-0001", "CASE-0002", "CASE-BIG"]) {
  logs.length = 0;
  await go(`${BASE}/cases/${cid}/graph`);
  const loaded = await waitFor(`!!window.__graphStore && !window.__graphStore.getState().isLoading && !!window.__sigma && window.__sigma.getGraph().order > 0`);
  await sleep(1500);
  const a = await api(cid); const m = loaded ? await ev(MEASURE) : null;
  check(`${cid}: every node and relationship from the API is drawn`, !!m && m.shownNodes === a.nodes && m.shownEdges === a.edges && m.storeNodes === a.nodes,
    JSON.stringify({ api: a, ui: m && { nodes: m.shownNodes, edges: m.shownEdges } }));
  check(`${cid}: no overlapping nodes, all inside the canvas`, !!m && m.overlapPairs === 0 && m.inside, JSON.stringify(m && { overlapPairs: m.overlapPairs, inside: m.inside, radius: m.radius }));
  check(`${cid}: truncation banner shown exactly when the server truncated`, !!m && (!!m.banner === !!a.truncated) && (!a.truncated || m.banner.includes(`of ${a.total}`)), m && m.banner);
  check(`${cid}: no page errors`, logs.length === 0, logs.join(" | "));
  await shot(`${cid}.png`);
}

logs.length = 0;
await ev(`history.pushState({}, '', '/cases/CASE-0002/graph'); dispatchEvent(new PopStateEvent('popstate')); true`);
await waitFor(`window.__graphStore.getState().caseId === 'CASE-0002' && !window.__graphStore.getState().isLoading`);
await sleep(1500);
const sw = await ev(MEASURE);
check("switching case in the app replaces the graph (no leftovers)", sw.storeNodes === 3 && sw.shownNodes === 3 && sw.shownEdges === 3, JSON.stringify(sw));

await go(`${BASE}/cases/CASE-0001/graph?view=list`);
await waitFor(`!window.__graphStore.getState().isLoading`);
check("list view lists the relationships", (await ev(`document.querySelectorAll('main li, main tr').length`)) > 100);

await go(`${BASE}/cases/CASE-0003/graph`);
check("a case the user may not open shows the access-denied page", await waitFor(`/do not have access/i.test(document.querySelector('main')?.innerText || '')`));

await login("admin");
await go(`${BASE}/cases/CASE-0003/graph`);
check("an empty case shows the empty state and no time slider", await waitFor(`!!document.querySelector('[data-testid=graph-empty]') && !document.querySelector('[data-testid=temporal-slider-none]')`));
await shot("empty.png");

ws.close(); proc.kill();
const failed = results.filter((r) => !r).length;
console.log(`${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
