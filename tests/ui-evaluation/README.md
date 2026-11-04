# UI evaluation scripts (frontend redesign, 2026-11-04)

Run these against a **disposable** server, never the live demo. `SHOOT_SET=after` selects the redesigned route list.

| Script | What it measures | Example |
|---|---|---|
| `capture_routes.py` | A screenshot of every route, per role and viewport (1440/900/390 px), plus console errors, failed requests, redirects and horizontal overflow | `SHOOT_SET=after python capture_routes.py http://127.0.0.1:8002 out/ after` |
| `axe_scan.py` | axe-core WCAG 2.x A/AA rules on the login page and 13 signed-in pages | `AXE_JS=/path/axe.min.js python axe_scan.py http://127.0.0.1:8002 out.json after` |
| `task_comparison.py` | The same 7 officer tasks on the old UI (8001) and the new one (8002): was each task completed, and in how many clicks? | `python task_comparison.py out.json` |

`axe.min.js` comes from `npm pack axe-core@4.10.2`; it is not a project dependency.

The task comparison expects two servers on the same seeded synthetic database: 8001 serving the previous build and 8002 the redesign.
Build either one with `npx vite build --outDir <dir>` and start it with `DRISHTI_WEB_DIST=<dir>`. Never use `make build-web`, which overwrites the
live demo's `apps/web/dist`.

These are engineering measurements, not user research.
