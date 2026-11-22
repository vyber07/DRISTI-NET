// Browser walkthrough of organisational user ID allocation (docs/USER_ID_ALLOCATION.md), over raw CDP (no Playwright
// package needed; Node 22+ for the global WebSocket). Run it ONLY against an isolated server on a freshly seeded
// throwaway store at 127.0.0.1:8003 (it changes demo users). Use a real Chromium binary, e.g. the Playwright cache
// ~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome (on this host ~/.local/bin/google-chrome wraps Obscura,
// which blocks loopback). Usage: node verify_org_user_ids_ui.mjs <chrome> <outdir>
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import path from "node:path";

const [chrome, outDir] = process.argv.slice(2);
const BASE = "http://127.0.0.1:8003";
const profile = mkdtempSync(path.join(outDir, "chrome-"));
const proc = spawn(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", "--remote-debugging-port=9333",
  `--user-data-dir=${profile}`, "--window-size=1400,1000", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };

let targets;
for (let i = 0; i < 50; i++) {
  try { targets = await (await fetch("http://127.0.0.1:9333/json")).json(); if (targets.length) break; } catch {}
  await sleep(200);
}
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pending = new Map(); const consoleErrors = [];
ws.addEventListener("message", (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  if (msg.method === "Runtime.exceptionThrown") consoleErrors.push(msg.params.exceptionDetails.text);
  if (msg.method === "Page.javascriptDialogOpening") send("Page.handleJavaScriptDialog", { accept: true });
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
  return r.result?.result?.value;
};
const waitFor = async (expr, ms = 8000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await evaluate(expr)) return true; await sleep(150); }
  return false;
};
const shot = async (name) => {
  const r = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(path.join(outDir, name), Buffer.from(r.result.data, "base64"));
};
const go = async (url) => { await send("Page.navigate", { url }); await sleep(600); };

// Helpers evaluated in the page: set a React-controlled input, click a button by text.
const PAGE_HELPERS = `
window.__setVal = (el, v) => { const d = Object.getOwnPropertyDescriptor(el.__proto__, 'value') || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'); d.set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
window.__row = (username) => [...document.querySelectorAll('tbody tr')].find(tr => [...tr.cells].some(td => td.textContent.trim() === username));
window.__btn = (root, text) => [...root.querySelectorAll('button')].find(b => b.textContent.trim().startsWith(text));
true`;

await send("Page.enable"); await send("Runtime.enable");

// Sign in through the real login form.
await go(`${BASE}/login`);
await waitFor(`!!document.querySelector('input[type=password]')`);
await evaluate(PAGE_HELPERS);
await evaluate(`(() => { const u = document.querySelector('input:not([type=password])'); const p = document.querySelector('input[type=password]');
  __setVal(u, 'admin'); __setVal(p, 'admin-demo'); (document.querySelector('form button[type=submit]') || __btn(document, 'Sign')).click(); return true })()`);
check("admin signs in through the login form", await waitFor(`!!localStorage.getItem('drishti.token')`));

await go(`${BASE}/admin/users`);
await evaluate(PAGE_HELPERS);
check("users table has a User ID column", await waitFor(`[...document.querySelectorAll('thead th')].some(th => th.textContent.trim() === 'User ID')`));
check("seeded IDs shown (admin = DDA-1006)", await waitFor(`!!__row('admin') && __row('admin').cells[0].textContent.trim() === 'DDA-1006'`));
await shot("01-users-table.png");

// Change analyst's ID through the dialog.
await evaluate(`__btn(__row('analyst'), 'User ID').click(); true`);
check("dialog opens with current ID and seeded history", await waitFor(`(() => { const d = document.querySelector('[data-testid=org-user-id-dialog]'); return !!d && d.textContent.includes('DDA-1004') && d.textContent.includes('demo seed') })()`));
await evaluate(`(() => { const d = document.querySelector('[data-testid=org-user-id-dialog]'); const [org, reason] = d.querySelectorAll('input:not([type=checkbox])');
  __setVal(org, 'dl-04217'); __setVal(reason, 'Service number issued by personnel'); return true })()`);
await sleep(200);
await evaluate(`__btn(document.querySelector('[data-testid=org-user-id-dialog]'), 'Change user ID').click(); true`);
check("change succeeds and old ID shown retired", await waitFor(`(() => { const t = document.querySelector('[data-testid=org-user-id-dialog]').textContent; return t.includes('User ID is now DL-04217') && t.includes('DDA-1004 was retired') })()`));
check("history lists DL-04217 active and DDA-1004 retired", await waitFor(`(() => { const t = document.querySelector('[data-testid=org-user-id-dialog]').textContent; return t.includes('DL-04217active') && t.includes('DDA-1004retired') })()`));
await shot("02-dialog-after-change.png");
await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
check("table refreshed with new ID", await waitFor(`__row('analyst').cells[0].textContent.trim() === 'DL-04217'`));

// Try to reuse the retired ID on another account.
await waitFor(`!document.querySelector('[data-testid=org-user-id-dialog]')`);
await evaluate(`__btn(__row('reviewer'), 'User ID').click(); true`);
await waitFor(`!!document.querySelector('[data-testid=org-user-id-dialog]')`);
await sleep(300);
await evaluate(`(() => { const d = document.querySelector('[data-testid=org-user-id-dialog]'); const [org, reason] = d.querySelectorAll('input:not([type=checkbox])');
  __setVal(org, 'DDA-1004'); __setVal(reason, 'Attempting to reuse a retired ID'); return true })()`);
await sleep(200);
await evaluate(`__btn(document.querySelector('[data-testid=org-user-id-dialog]'), 'Change user ID').click(); true`);
check("reuse of retired ID refused with a clear message", await waitFor(`document.querySelector('[data-testid=org-user-id-dialog] [role=alert]')?.textContent.includes('can never be reused')`));
await shot("03-reuse-refused.png");
await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
await waitFor(`!document.querySelector('[data-testid=org-user-id-dialog]')`);

// Own account: no form, explanation only.
await evaluate(`__btn(__row('admin'), 'User ID').click(); true`);
check("own account: form withheld, explanation shown", await waitFor(`(() => { const d = document.querySelector('[data-testid=org-user-id-dialog]'); return !!d && d.textContent.includes('Another administrator must change your own user ID') && !d.querySelector('form') })()`));
await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });

// Create a user with an ID.
await waitFor(`!document.querySelector('[data-testid=org-user-id-dialog]')`);
await evaluate(`__btn(document, 'Create user').click(); true`);
await waitFor(`!!document.querySelector('[data-testid=create-user-dialog]')`);
await sleep(300);
await evaluate(`(() => { const d = document.querySelector('[data-testid=create-user-dialog]'); const ins = [...d.querySelectorAll('input')];
  const byLabel = (t) => ins.find(i => d.querySelector('label[for="' + i.id + '"]')?.textContent.startsWith(t));
  __setVal(byLabel('Username'), 'uicheck'); __setVal(byLabel('User ID'), 'dl-55001'); __setVal(byLabel('Display name'), 'UI Check');
  __setVal(byLabel('Password'), 'ui-check-pass-1'); return true })()`);
await sleep(200);
await evaluate(`__btn(document.querySelector('[data-testid=create-user-dialog]'), 'Create user').click(); true`);
check("create with ID: new row shows DL-55001", await waitFor(`!!__row('uicheck') && __row('uicheck').cells[0].textContent.trim() === 'DL-55001'`));

// Profile page shows the organisational ID and the internal reference separately.
await go(`${BASE}/profile`);
check("profile shows User ID DDA-1006 and internal reference", await waitFor(`document.body.innerText.includes('DDA-1006') && document.body.innerText.includes('Internal reference') && /USR-[0-9a-f]{12}/.test(document.body.innerText)`));
await shot("04-profile.png");

check("no uncaught page exceptions", consoleErrors.length === 0, consoleErrors.join(" | "));
ws.close(); proc.kill();
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
