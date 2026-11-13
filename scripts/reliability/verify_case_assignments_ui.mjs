// Browser walkthrough of administrator case assignment (docs/CASE_ASSIGNMENT.md), over raw CDP (no Playwright
// package needed; Node 22+ for the global WebSocket). Run it ONLY against an isolated server on a freshly seeded
// throwaway store at 127.0.0.1:8003 (it changes CASE-0001/CASE-0002 teams). Use a real Chromium binary, e.g.
// ~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome. Usage: node verify_case_assignments_ui.mjs <chrome> <outdir>
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import path from "node:path";

const [chrome, outDir] = process.argv.slice(2);
const BASE = "http://127.0.0.1:8003";
const PORT = 9334;
const profile = mkdtempSync(path.join(outDir, "chrome-"));
const proc = spawn(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`, "--window-size=1400,1000", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };

let targets;
for (let i = 0; i < 50; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (targets.length) break; } catch {}
  await sleep(200);
}
const pageTarget = targets.find((t) => t.type === "page");
const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pending = new Map(); const exceptions = [];
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
ws.addEventListener("message", (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  if (msg.method === "Runtime.exceptionThrown") exceptions.push(msg.params.exceptionDetails.text);
  if (msg.method === "Page.javascriptDialogOpening") send("Page.handleJavaScriptDialog", { accept: true });
});
const evaluate = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
  return r.result?.result?.value;
};
const waitFor = async (expr, ms = 8000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) { try { if (await evaluate(expr)) return true; } catch {} await sleep(150); }
  return false;
};
const shot = async (name) => {
  const r = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(path.join(outDir, name), Buffer.from(r.result.data, "base64"));
};
const HELPERS = `
window.__setVal = (el, v) => { const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
window.__btn = (root, text) => [...root.querySelectorAll('button')].find(b => b.textContent.trim().startsWith(text));
window.__byLabel = (root, text) => { const l = [...root.querySelectorAll('label')].find(l => l.textContent.trim().startsWith(text)); return l && root.querySelector('#' + CSS.escape(l.htmlFor)); };
window.__optionByText = (sel, text) => [...sel.options].find(o => o.textContent.includes(text))?.value;
true`;
const go = async (url) => { await send("Page.navigate", { url }); await sleep(700); await waitFor("document.readyState === 'complete'"); await evaluate(HELPERS); };
const login = async (username, password) => {
  await go(`${BASE}/login`);
  await evaluate("localStorage.clear(); true");
  await go(`${BASE}/login`);
  await waitFor("!!document.querySelector('input[type=password]')");
  await evaluate(`(() => { __setVal(document.querySelector('input:not([type=password])'), ${JSON.stringify(username)});
    __setVal(document.querySelector('input[type=password]'), ${JSON.stringify(password)});
    document.querySelector('form button[type=submit]').click(); return true })()`);
  return waitFor("!!localStorage.getItem('drishti.token')");
};
const dlg = "document.querySelector('[data-testid=case-team-dialog]')";

await send("Page.enable"); await send("Runtime.enable");

// ---------------------------------------------------------------- administrator
check("admin signs in", await login("admin", "admin-demo"));
await go(`${BASE}/admin/case-assignments`);
check("nav shows Case assignments", await waitFor(`[...document.querySelectorAll('nav a, aside a')].some(a => a.textContent.includes('Case assignments'))`));
check("cases listed with primary investigator", await waitFor(`[...document.querySelectorAll('tbody tr')].some(tr => tr.textContent.includes('CASE-0001') && tr.textContent.includes('Investigator Asha (demo) (DDA-1001)'))`));
await shot("01-case-list.png");

await go(`${BASE}/admin/case-assignments?case=CASE-0001`);
check("team dialog opens from ?case= with members and access", await waitFor(`!!${dlg} && ${dlg}.textContent.includes('Primary') && ${dlg}.textContent.includes('Has access') && !!${dlg}.querySelector('[data-testid=member-analyst]')`));

// add 'unassigned' (Priya) with a reason
await evaluate(`(() => { const d = ${dlg}; __setVal(__byLabel(d, 'Reason'), 'Extra investigator for the call records');
  const sel = __byLabel(d, 'Add a person'); __setVal(sel, __optionByText(sel, 'Investigator Priya')); return true })()`);
await sleep(200);
await evaluate(`__btn(${dlg}, 'Add').click(); true`);
check("add person succeeds and appears", await waitFor(`${dlg}.textContent.includes('Person added.') && !!${dlg}.querySelector('[data-testid=member-unassigned]')`));

// remove analyst
await evaluate(`__setVal(__byLabel(${dlg}, 'Reason'), 'Analysis finished for this case'); true`);
await sleep(200);
// P2.1: Cancel in the confirmation dialog must leave the member on the case
await evaluate(`__btn(${dlg}.querySelector('[data-testid=member-analyst]'), 'Remove').click(); true`);
await waitFor(`!!document.querySelector('[data-testid=confirm-dialog]')`);
await evaluate(`__btn(document.querySelector('[data-testid=confirm-dialog]'), 'Cancel').click(); true`);
await sleep(400);
check("cancelling the confirmation keeps the member", await evaluate(`!document.querySelector('[data-testid=confirm-dialog]') && !!${dlg}.querySelector('[data-testid=member-analyst]')`));
await evaluate(`__btn(${dlg}.querySelector('[data-testid=member-analyst]'), 'Remove').click(); true`);
// P2.1: confirmation is our own dialog now (was window.confirm)
await waitFor(`!!document.querySelector('[data-testid=confirm-dialog-confirm]')`);
await evaluate(`document.querySelector('[data-testid=confirm-dialog-confirm]').click(); true`);
check("remove succeeds and member disappears", await waitFor(`${dlg}.textContent.includes('was removed from CASE-0001') && !${dlg}.querySelector('[data-testid=member-analyst]')`));

// the primary investigator has no Remove button
check("primary investigator has no Remove control", await evaluate(`!__btn(${dlg}.querySelector('[data-testid=member-investigator]'), 'Remove')`));

// hand over to Priya, keeping Asha
await evaluate(`(() => { const d = ${dlg}; __setVal(__byLabel(d, 'Reason'), 'Asha transferred to another unit');
  const sel = __byLabel(d, 'Hand over'); __setVal(sel, __optionByText(sel, 'Investigator Priya')); return true })()`);
await sleep(200);
await evaluate(`__btn(${dlg}, 'Hand over').click(); true`);
// P2.1: confirmation is our own dialog now (was window.confirm)
await waitFor(`!!document.querySelector('[data-testid=confirm-dialog-confirm]')`);
await evaluate(`document.querySelector('[data-testid=confirm-dialog-confirm]').click(); true`);
check("handover makes Priya primary, Asha stays supporting", await waitFor(`${dlg}.textContent.includes('Case handed over.') &&
  ${dlg}.querySelector('[data-testid=member-unassigned]').textContent.includes('Primary') &&
  ${dlg}.querySelector('[data-testid=member-investigator]').textContent.includes('Supporting')`));
check("history lists the changes with reasons", await waitFor(`(() => { const t = ${dlg}.querySelector('[data-testid=assignment-history]')?.textContent || '';
  return t.includes('made primary investigator') && t.includes('removed from the case') && t.includes('Analysis finished for this case') && t.includes('added to the case') })()`));
await shot("02-team-dialog.png");

// a refused action shows the server's reason: empty reason is blocked in the UI, so try a stale handover via the API
const stale = await evaluate(`(async () => { const h = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('drishti.token') };
  const users = await (await fetch('/api/v1/users', { headers: h })).json(); const asha = users.find(u => u.username === 'investigator');
  const r = await fetch('/api/v1/cases/CASE-0001/primary', { method: 'POST', headers: h, body: JSON.stringify({ user_id: asha.user_id,
    expected_primary_id: asha.user_id, reason: 'stale attempt', previous: 'KEEP' }) });   // Asha is no longer primary
  return r.status + ' ' + (await r.json()).code })()`);
check("stale handover refused by the server (409 PRIMARY_CHANGED)", stale === "409 PRIMARY_CHANGED", String(stale));

// ---------------------------------------------------------------- removed analyst loses access
check("analyst signs in", await login("analyst", "analyst-demo"));
await go(`${BASE}/cases/CASE-0001`);
check("removed analyst is refused CASE-0001", await waitFor(`/denied|not permitted|Access to this case/i.test(document.body.innerText) && !document.querySelector('[data-testid=case-title]')`));
check("analyst has no Case assignments nav", await evaluate(`![...document.querySelectorAll('nav a, aside a')].some(a => a.textContent.includes('Case assignments'))`));
await go(`${BASE}/admin/case-assignments`);
check("analyst gets the denied state on the admin page", await waitFor(`/cannot view case assignments/i.test(document.body.innerText)`));

// ---------------------------------------------------------------- auditor: read-only
check("auditor signs in", await login("auditor", "auditor-demo"));
await go(`${BASE}/admin/case-assignments?case=CASE-0001`);
check("auditor sees the team but no change controls", await waitFor(`!!${dlg} && !!${dlg}.querySelector('[data-testid=member-unassigned]') && !__btn(${dlg}, 'Hand over') && !__byLabel(${dlg}, 'Reason')`));

// ---------------------------------------------------------------- primary investigator adds via the case page (reason)
check("investigator signs in", await login("investigator", "investigator-demo"));
await go(`${BASE}/cases/CASE-0002`);
await waitFor(`!!__btn(document, 'Add person')`);
await evaluate(`__btn(document, 'Add person').click(); true`);
await waitFor(`!!document.querySelector('[data-testid=assign-dialog] select')`);
await sleep(300);
await evaluate(`(() => { const d = document.querySelector('[data-testid=assign-dialog]'); const sel = d.querySelector('select');
  __setVal(sel, 'analyst'); return true })()`);
await sleep(150);
await evaluate(`document.querySelector('[data-testid=assign-dialog] button[type=submit]').click(); true`);
await sleep(600);
check("assign without a reason is blocked (dialog stays open, browser validation on Reason)", await evaluate(`(() => { const d = document.querySelector('[data-testid=assign-dialog]');
  return !!d && !__byLabel(d, 'Reason').checkValidity() })()`));
await evaluate(`__setVal(__byLabel(document.querySelector('[data-testid=assign-dialog]'), 'Reason'), 'Needs the transaction analysis'); true`);
await sleep(150);
await evaluate(`document.querySelector('[data-testid=assign-dialog] button[type=submit]').click(); true`);
check("assign with a reason succeeds", await waitFor(`!document.querySelector('[data-testid=assign-dialog]') && document.body.innerText.includes('Analyst Karan (demo)')`));
check("case page labels the primary investigator", await evaluate(`document.body.innerText.includes('primary investigator')`));
await shot("03-case-overview.png");

check("no uncaught page exceptions", exceptions.length === 0, exceptions.join(" | "));
ws.close(); proc.kill();
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
