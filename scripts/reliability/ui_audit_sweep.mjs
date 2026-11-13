// UI/UX audit sweep (P2.1): every route, as the role that uses it, at desktop (1440x900) and phone (390x844) width.
// Per route: axe-core WCAG 2.x A/AA violations, number of <h1>, horizontal page overflow, visible text under 12px,
// console errors / exceptions / HTTP 5xx, and a screenshot. Writes <outdir>/audit.json and prints a summary.
// Run only against an isolated server on a throwaway store (127.0.0.1:8003), never the live demo.
// Usage: node ui_audit_sweep.mjs <chrome> <axe.min.js> <outdir>     (axe.min.js: `npm pack axe-core@4.10.2`)
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync } from "node:fs";
import path from "node:path";

const [chrome, axePath, outDir] = process.argv.slice(2);
const AXE = readFileSync(axePath, "utf8");
const BASE = "http://127.0.0.1:8003";
const PORT = 9339;
mkdirSync(path.join(outDir, "shots"), { recursive: true });
const proc = spawn(chrome, ["--headless=new", "--no-sandbox", `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${mkdtempSync(path.join(outDir, "chrome-"))}`, "--window-size=1440,900", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (targets.length) break; } catch {} await sleep(200); }
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pending = new Map(); let logs = [];
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
ws.addEventListener("message", (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  if (msg.method === "Runtime.exceptionThrown") logs.push("EXCEPTION " + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text).slice(0, 200));
  if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") logs.push("ERROR " + msg.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 200));
  if (msg.method === "Network.responseReceived" && msg.params.response.status >= 500) logs.push(`HTTP ${msg.params.response.status} ${msg.params.response.url}`);
});
const ev = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); return r.result?.result?.value; };
const shot = async (name) => { const r = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(path.join(outDir, "shots", name), Buffer.from(r.result.data, "base64")); };
await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");

const login = async (u) => {
  await send("Page.navigate", { url: `${BASE}/login` }); await sleep(700);
  return ev(`(async () => { localStorage.clear(); const r = await fetch('/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: '${u}', password: '${u}-demo' }) });
    const j = await r.json(); localStorage.setItem('drishti.token', j.token); localStorage.setItem('drishti.user', JSON.stringify(j.user)); return j.token })()`);
};
const MEASURE = `(async () => {
  const visible = (el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && r.width > 0 && r.height > 0 && !el.closest('.sr-only'); };
  let small = 0; const samples = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    if (!visible(el) || el.closest('canvas, svg')) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 12) { small++; if (samples.length < 4) samples.push(fs + 'px:' + el.textContent.trim().slice(0, 30)); }
  }
  const ax = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
  return { h1: document.querySelectorAll('h1').length, overflowX: document.documentElement.scrollWidth > innerWidth + 1,
    scrollW: document.documentElement.scrollWidth, small, samples,
    axe: ax.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, target: v.nodes.slice(0, 2).map((n) => n.target.join(' ')) })) };
})()`;

const result = {};
const visit = async (role, route, width, height, mobile) => {
  logs = [];
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
  await send("Page.navigate", { url: BASE + route });
  await sleep(2600);
  await ev(AXE + "; true");
  const m = await ev(MEASURE);
  const key = `${role} ${route} @${width}`;
  result[key] = { ...m, logs: [...logs] };
  await shot(`${role}${route.replace(/[/:?=]/g, "_")}_${width}.png`);
  const ax = m.axe.reduce((a, v) => a + v.nodes, 0);
  console.log(`${key.padEnd(58)} h1=${m.h1} overflow=${m.overflowX ? "YES(" + m.scrollW + ")" : "no"} small=${m.small} axe=${ax}${m.axe.length ? " [" + m.axe.map((v) => v.id + ":" + v.nodes).join(",") + "]" : ""}${logs.length ? " LOGS=" + logs.length : ""}`);
};

const C = "CASE-0001";
// a request of the investigator's own, for the detail route
const tok = await login("investigator");
const reqId = await ev(`(async () => { const h = { 'Content-Type': 'application/json', Authorization: 'Bearer ${tok}' };
  const l = await (await fetch('/api/v1/user-requests?limit=1', { headers: h })).json(); const items = l.items || l;
  if (items.length) return items[0].request_id;
  const r = await fetch('/api/v1/user-requests', { method: 'POST', headers: h, body: JSON.stringify({ category: 'SUPPORT', title: 'Audit sweep request', justification: 'Created by the UI audit sweep on a throwaway store.', details: {}, submit: true }) });
  return (await r.json()).request_id; })()`);
const plan = {
  investigator: ["/command-center", "/cases", `/cases/${C}`, `/cases/${C}/evidence`, `/cases/${C}/review`, `/cases/${C}/graph`, `/cases/${C}/timeline`,
    `/cases/${C}/locations`, `/cases/${C}/analysis`, `/cases/${C}/decisions`, `/cases/${C}/reports`, `/cases/${C}/audit`, "/profile", "/requests", `/requests/${reqId}`, "/nope"],
  admin: ["/admin/users", "/admin/overrides", "/admin/case-assignments", "/audit"],
};
for (const [width, height, mobile] of [[1440, 900, false], [390, 844, true]]) {
  await send("Emulation.clearDeviceMetricsOverride");
  await send("Page.navigate", { url: `${BASE}/login` }); await sleep(600); await ev("localStorage.clear(); true");
  await visit("anon", "/login", width, height, mobile);
  for (const [role, routes] of Object.entries(plan)) {
    await login(role);
    for (const r of routes) await visit(role, r, width, height, mobile);
  }
}
writeFileSync(path.join(outDir, "audit.json"), JSON.stringify(result, null, 1));
const all = Object.values(result);
const byRule = {};
for (const r of all) for (const v of r.axe) byRule[v.id] = (byRule[v.id] || 0) + v.nodes;
console.log("\nTOTAL pages", all.length, "| axe elements", all.reduce((a, r) => a + r.axe.reduce((b, v) => b + v.nodes, 0), 0),
  "| pages without exactly one h1", all.filter((r) => r.h1 !== 1).length, "| pages with horizontal overflow", all.filter((r) => r.overflowX).length,
  "| small-text elements", all.reduce((a, r) => a + r.small, 0), "| pages with errors", all.filter((r) => r.logs.length).length);
console.log("axe by rule:", JSON.stringify(Object.fromEntries(Object.entries(byRule).sort((a, b) => b[1] - a[1]))));
ws.close(); proc.kill();
