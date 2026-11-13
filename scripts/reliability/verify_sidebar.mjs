// Sidebar navigation verification (P2.2), over raw CDP (Node 22+). Run only against an isolated server on a throwaway
// seeded store at 127.0.0.1:8003. Usage: node verify_sidebar.mjs <chrome> <outdir> [axe.min.js]
// Checks, per role: the items shown match the role's capabilities, grouped; no duplicate links; every link opens a real
// page (one h1, not "not found", not "access denied"); exactly one link marked current, also on nested routes; collapse
// works, is remembered across reloads, and collapsed links are named for keyboard users; on a phone the drawer is a
// real dialog (focus moves in and stays in, Esc and the close button close it and focus returns to the menu button,
// following a link closes it); axe on the open drawer.
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import path from "node:path";

const [chrome, outDir, axePath] = process.argv.slice(2);
const AXE = axePath ? readFileSync(axePath, "utf8") : null;
const BASE = "http://127.0.0.1:8003";
const PORT = 9340;
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
const shot = async (name) => { const r = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(path.join(outDir, name), Buffer.from(r.result.data, "base64")); };
const key = async (k, code, vk, shift = false) => { for (const type of ["keyDown", "keyUp"]) await send("Input.dispatchKeyEvent", { type, key: k, code, windowsVirtualKeyCode: vk, modifiers: shift ? 8 : 0 }); };
const clickSel = async (sel) => {
  const c = await ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
  if (!c) return false;
  for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x: c[0], y: c[1], button: "left", clickCount: 1 });
  return true;
};
const results = [];
const check = (name, ok, extra = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
await send("Page.enable"); await send("Runtime.enable");

const login = async (u) => {
  await send("Page.navigate", { url: `${BASE}/login` }); await sleep(600);
  await ev(`(async () => { localStorage.removeItem('drishti.token'); const r = await fetch('/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: '${u}', password: '${u}-demo' }) });
    const j = await r.json(); localStorage.setItem('drishti.token', j.token); localStorage.setItem('drishti.user', JSON.stringify(j.user)); return true })()`);
};
const go = async (p) => { await send("Page.navigate", { url: BASE + p }); await sleep(1200); };
// the desktop sidebar's main nav (the <aside> that is displayed)
const NAV = `[...document.querySelectorAll('nav[aria-label="Main"]')].find((n) => n.offsetParent !== null)`;
const NAV_STATE = `(() => { const nav = ${NAV}; if (!nav) return null;
  const links = [...nav.querySelectorAll('a')];
  const groups = [...nav.querySelectorAll('[data-nav-group]')].map((g) => g.getAttribute('data-nav-group'));
  return { labels: links.map((a) => (a.textContent || a.getAttribute('aria-label') || '').trim()), hrefs: links.map((a) => a.getAttribute('href')),
    current: links.filter((a) => a.getAttribute('aria-current') === 'page').map((a) => a.getAttribute('href')), groups }; })()`;
const PAGE_OK = `(() => ({ h1: document.querySelectorAll('h1').length, notFound: !!document.querySelector('[data-testid=not-found]'),
  denied: !!document.querySelector('[data-testid=access-denied]') || /cannot (view|manage)|not permitted/i.test(document.querySelector('main')?.innerText || '') }))()`;

const EXPECT = {
  investigator: { items: ["Home", "Cases", "Requests"], groups: ["workspace"] },
  officer: { items: ["Home", "Cases", "Requests"], groups: ["workspace"] },
  reviewer: { items: ["Home", "Cases", "Requests"], groups: ["workspace"] },
  analyst: { items: ["Home", "Cases", "Requests"], groups: ["workspace"] },
  auditor: { items: ["Home", "Cases", "Requests", "Audit log", "Case assignments", "Permission overrides"], groups: ["workspace", "oversight", "administration"] },
  admin: { items: ["Home", "Cases", "Requests", "Audit log", "Users", "Case assignments", "Permission overrides"], groups: ["workspace", "oversight", "administration"] },
};

// ---------------------------------------------------------------- per role, desktop
for (const [role, exp] of Object.entries(EXPECT)) {
  await login(role);
  await go("/command-center");
  const st = await ev(NAV_STATE);
  check(`${role}: items match the role's capabilities`, !!st && JSON.stringify(st.labels) === JSON.stringify(exp.items), JSON.stringify(st?.labels));
  check(`${role}: grouped (${exp.groups.join(", ")})`, !!st && JSON.stringify(st.groups) === JSON.stringify(exp.groups), JSON.stringify(st?.groups));
  check(`${role}: no duplicate links`, !!st && new Set(st.hrefs).size === st.hrefs.length);
  let allOk = true; const bad = [];
  for (const href of st?.hrefs || []) {
    await go(href);
    const p = await ev(PAGE_OK); const cur = (await ev(NAV_STATE))?.current || [];
    if (!(p.h1 === 1 && !p.notFound && !p.denied && cur.length === 1 && cur[0] === href)) { allOk = false; bad.push(`${href}:${JSON.stringify(p)}:${cur}`); }
  }
  check(`${role}: every link opens a real page and is the one marked current`, allOk, bad.join(" | "));
}

// nested route keeps its section current
await login("investigator");
await go("/cases/CASE-0001/timeline");
check("nested route: Cases is current on a case tab", JSON.stringify((await ev(NAV_STATE))?.current) === JSON.stringify(["/cases"]));
await go("/requests/1");
const reqCur = (await ev(NAV_STATE))?.current;
check("nested route: Requests is current on a request", JSON.stringify(reqCur) === JSON.stringify(["/requests"]) || (await ev(`!!document.querySelector('[data-testid=not-found]')`)), JSON.stringify(reqCur));

// ---------------------------------------------------------------- collapse (desktop)
await login("admin"); await go("/admin/users");
await ev(`localStorage.removeItem('drishti.sidebarCollapsed'); true`); await go("/admin/users");
const widthOf = `(() => document.querySelector('nav[aria-label="Main"]')?.closest('aside')?.getBoundingClientRect().width)()`;
const w0 = await ev(widthOf);
await clickSel('button[aria-label="Collapse navigation"]'); await sleep(500);
const w1 = await ev(widthOf);
check("collapse narrows the sidebar to icons", w1 < 80 && w0 > 150, `${w0} -> ${w1}`);
// Contrast of every collapsed icon against the sidebar (a styling regression once left them dark-on-dark).
const contrast = await ev(`(() => {
  const lum = (c) => { const m = c.match(/\\d+(\\.\\d+)?/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
  const bg = lum(getComputedStyle(document.querySelector('#app-sidebar')).backgroundColor);
  return [...${NAV}.querySelectorAll('a svg')].map((s) => { const l = lum(getComputedStyle(s).color); const [a, b] = [Math.max(l, bg), Math.min(l, bg)]; return +((a + 0.05) / (b + 0.05)).toFixed(2); });
})()`);
check("collapsed icons are visible (contrast >= 3:1 against the sidebar)", Array.isArray(contrast) && contrast.length > 0 && contrast.every((c) => c >= 3), JSON.stringify(contrast));
check("collapsed links still have names", await ev(`[...${NAV}.querySelectorAll('a')].every((a) => (a.textContent || '').trim().length > 0 || a.getAttribute('aria-label'))`));
await ev(`${NAV}.querySelector('a').focus(); true`);
check("collapsed: focusing a link shows its name (tooltip, keyboard users)", await waitFor(`[...document.querySelectorAll('[role=tooltip]')].some((t) => /Home/.test(t.textContent))`, 2500));
await shot("collapsed.png");
await go("/admin/users");
check("collapsed state is remembered across a reload", (await ev(widthOf)) < 80);
check("collapse toggle reports its state", await ev(`(() => { const b = document.querySelector('button[aria-label="Expand navigation"]'); return !!b && b.getAttribute('aria-expanded') === 'false'; })()`));
await clickSel('button[aria-label="Expand navigation"]'); await sleep(500);
check("expand restores the full sidebar", (await ev(widthOf)) > 150);
await go("/admin/users");
check("expanded state is remembered too", (await ev(widthOf)) > 150);
await shot("expanded.png");

// ---------------------------------------------------------------- phone drawer
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await go("/command-center");
const MENU = 'button[aria-label="Open navigation"]';
check("phone: menu button reports closed", await ev(`document.querySelector('${MENU}')?.getAttribute('aria-expanded') === 'false'`));
await clickSel(MENU);
console.log("   focus after clicking the menu button:", await ev(`(document.activeElement?.tagName || '') + ' ' + (document.activeElement?.getAttribute('aria-label') || '')`));
const DRAWER = `document.querySelector('[role=dialog][aria-label=Navigation], [role=dialog][data-nav-drawer]')`;
check("phone: menu opens the drawer and reports it", await waitFor(`!!${DRAWER} && document.querySelector('${MENU}')?.getAttribute('aria-expanded') === 'true'`));
check("phone: focus moves into the drawer", await waitFor(`!!${DRAWER} && ${DRAWER}.contains(document.activeElement)`, 2000));
let trapped = true;
for (let i = 0; i < 14; i++) { await key("Tab", "Tab", 9); await sleep(60); if (!(await ev(`${DRAWER}?.contains(document.activeElement)`))) { trapped = false; break; } }
check("phone: Tab stays inside the drawer", trapped);
if (AXE) {
  await ev(AXE + "; true");
  const ax = await ev(`axe.run(${DRAWER}, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then((r) => r.violations.map((v) => v.id + ':' + v.nodes.length))`);
  check("phone: open drawer has no axe violations", Array.isArray(ax) && ax.length === 0, JSON.stringify(ax));
}
await shot("drawer.png");
await key("Escape", "Escape", 27);
check("phone: Esc closes the drawer", await waitFor(`!${DRAWER}`, 2000));
const backOk = await waitFor(`document.activeElement === document.querySelector('${MENU}')`, 2000);
check("phone: focus returns to the menu button", backOk, backOk ? "" : await ev(`(document.activeElement?.tagName || '') + ' ' + (document.activeElement?.getAttribute('aria-label') || document.activeElement?.id || '')`));
await clickSel(MENU); await waitFor(`!!${DRAWER}`);
await clickSel('[role=dialog] button[aria-label="Close navigation"]');
check("phone: the close button closes the drawer", await waitFor(`!${DRAWER}`, 2000));
await clickSel(MENU); await waitFor(`!!${DRAWER}`);
const reqLink = await ev(`(() => { const a = [...${DRAWER}.querySelectorAll('a')].find((a) => a.getAttribute('href') === '/requests'); if (!a) return false; a.setAttribute('data-probe', 'req'); return true; })()`);
if (reqLink) await clickSel('[data-probe=req]');
check("phone: following a link navigates and closes the drawer", reqLink && await waitFor(`location.pathname === '/requests' && !${DRAWER}`, 4000));
check("no page exceptions", logs.length === 0, logs.join(" | "));

ws.close(); proc.kill();
const failed = results.filter((r) => !r).length;
console.log(`${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
