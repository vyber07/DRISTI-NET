// Account/profile page verification (P2.3), over raw CDP (Node 22+). Run only against an isolated server on a FRESHLY
// SEEDED throwaway store at 127.0.0.1:8003 (it changes the analyst's name and password).
// Usage: node verify_profile.mjs <chrome> <outdir> [axe.min.js]
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import path from "node:path";

const [chrome, outDir, axePath] = process.argv.slice(2);
const AXE = axePath ? readFileSync(axePath, "utf8") : null;
const BASE = "http://127.0.0.1:8003";
const PORT = 9342;
const proc = spawn(chrome, ["--headless=new", "--no-sandbox", `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${mkdtempSync(path.join(outDir, "chrome-"))}`, "--window-size=1440,900", "about:blank"], { stdio: "ignore" });
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
  if (msg.method === "Runtime.exceptionThrown") logs.push("EXCEPTION " + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text).slice(0, 200));
});
const ev = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); return r.result?.result?.value; };
const waitFor = async (expr, ms = 6000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await ev(expr)) return true; } catch {} await sleep(120); } return false; };
const shot = async (name) => { const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }); writeFileSync(path.join(outDir, name), Buffer.from(r.result.data, "base64")); };
const results = [];
const check = (name, ok, extra = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const HELP = `window.__setVal = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
  window.__btn = (root, t) => [...root.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t) || b.getAttribute('aria-label') === t);
  window.__inp = (label) => { const l = [...document.querySelectorAll('label')].find((l) => l.textContent.trim() === label); return l && document.getElementById(l.htmlFor); }; true`;
await send("Page.enable"); await send("Runtime.enable");
const go = async (p) => { await send("Page.navigate", { url: BASE + p }); await sleep(1500); await ev(HELP); };
const api = (method, p, body, tok) => ev(`fetch('/api/v1${p}', { method: '${method}', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (${tok ? JSON.stringify(tok) : "localStorage.getItem('drishti.token')"}) }, ${body ? `body: JSON.stringify(${JSON.stringify(body)})` : ""} }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }))`);

// sign in as the analyst through the API, plus a second "device" session we keep the token of
await send("Page.navigate", { url: `${BASE}/login` }); await sleep(600);
await ev(`(async () => { localStorage.clear(); const r = await fetch('/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'analyst', password: 'analyst-demo' }) });
  const j = await r.json(); localStorage.setItem('drishti.token', j.token); localStorage.setItem('drishti.user', JSON.stringify(j.user)); return true })()`);
await ev(`fetch('/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'analyst', password: 'wrong-password' }) }).then(() => true)`);
const otherDevice = await ev(`fetch('/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'analyst', password: 'analyst-demo' }) }).then((r) => r.json()).then((j) => j.token)`);

await go("/profile");
await waitFor(`/Internal reference/.test(document.body.innerText)`);
const facts = await ev(`(() => { const t = document.querySelector('main').innerText; return ['Username', 'User ID', 'Role', 'Jurisdiction', 'Office', 'Account status', 'Internal reference'].filter((k) => !t.includes(k)); })()`);
check("identity, organisation and status fields shown", facts.length === 0, JSON.stringify(facts));
check("office and user ID values shown", await ev(`(() => { const t = document.querySelector('main').innerText; return t.includes('OFF-DDA') && t.includes('DDA-1004') && t.includes('Active'); })()`));
await shot("01-profile.png");

// display name
await ev(`__btn(document, 'Edit display name').click(); true`); await sleep(200);
await ev(`(() => { const i = __inp('Display name'); __setVal(i, 'Analyst Karan Mehta'); return true })()`); await sleep(100);
await ev(`__btn(document.querySelector('main'), 'Save').click(); true`);
check("display name saved and shown in the top bar", await waitFor(`document.querySelector('[data-testid=current-user]')?.textContent === 'Analyst Karan Mehta' && document.querySelector('main').innerText.includes('Analyst Karan Mehta')`));

// protected fields cannot be changed directly
const forged = await api("PATCH", "/auth/me", { display_name: "Analyst Karan Mehta", role: "ADMIN", office_id: "OFF-X" });
check("direct API change of role/office is refused (422)", forged.status === 422, JSON.stringify(forged.status));

// password: wrong current, then success
await ev(`(() => { __setVal(__inp('Current password'), 'not-the-password'); __setVal(__inp('New password'), 'Analyst-new-pass-9'); __setVal(__inp('New password again'), 'Analyst-new-pass-9'); return true })()`);
await sleep(100); await ev(`__btn(document.querySelector('main'), 'Change password').click(); true`);
check("wrong current password: clear error, nothing changed", await waitFor(`[...document.querySelectorAll('[role=alert]')].some((e) => /current password is not correct/i.test(e.textContent))`));
await ev(`(() => { __setVal(__inp('Current password'), 'analyst-demo'); return true })()`); await sleep(100);
await ev(`__btn(document.querySelector('main'), 'Change password').click(); true`);
check("password changed; other session reported signed out", await waitFor(`[...document.querySelectorAll('[role=status]')].some((e) => /Password changed\\. 1 other session was signed out/.test(e.textContent))`));
const other = await api("GET", "/auth/me", null, otherDevice);
check("the other device's token stopped working", other.status === 401, String(other.status));
await go("/profile");
check("this session continues after a reload (new token stored)", await waitFor(`/Internal reference/.test(document.body.innerText)`) && !/\/login/.test(await ev("location.pathname")));

// sessions
check("sessions list marks this session", await waitFor(`/This session/.test(document.querySelector('[data-testid=my-sessions]')?.innerText || '')`));
const third = await ev(`fetch('/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'analyst', password: 'Analyst-new-pass-9' }) }).then((r) => r.json()).then((j) => j.token)`);
await go("/profile");
await waitFor(`!!__btn(document, 'Sign out other sessions')`);
await ev(`__btn(document, 'Sign out other sessions').click(); true`);
await waitFor(`!!document.querySelector('[data-testid=confirm-dialog-confirm]')`);
await ev(`document.querySelector('[data-testid=confirm-dialog-confirm]').click(); true`);
check("sign out other sessions (after confirmation) ends them", await waitFor(`/1 session signed out/.test(document.body.innerText)`) && (await api("GET", "/auth/me", null, third)).status === 401);

// activity
check("activity lists sign-in, failed sign-in, name and password changes", await waitFor(`(() => { const t = document.querySelector('[data-testid=my-activity]')?.innerText || '';
  return /Signed in/.test(t) && /Failed sign-in/.test(t) && /Updated display name/.test(t) && /Changed password/.test(t); })()`));

// accessibility and layout
for (const [w, h, mobile] of [[1440, 900, false], [390, 844, true]]) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile });
  await go("/profile"); await sleep(800);
  const overflow = await ev(`document.documentElement.scrollWidth > innerWidth + 1`);
  let ax = [];
  if (AXE) { await ev(AXE + "; true"); ax = await ev(`axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then((r) => r.violations.map((v) => v.id + ':' + v.nodes.length))`); }
  check(`@${w}: no horizontal overflow, no axe violations, one h1`, !overflow && ax.length === 0 && (await ev(`document.querySelectorAll('h1').length`)) === 1, JSON.stringify({ overflow, ax }));
  await shot(`02-profile-${w}.png`);
}
check("no page exceptions", logs.length === 0, logs.join(" | "));
ws.close(); proc.kill();
const failed = results.filter((r) => !r).length;
console.log(`${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
