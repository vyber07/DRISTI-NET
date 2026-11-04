# Usability comparison: engineering measurement, not user research

No officers took part. The numbers below come from scripted runs of the same tasks on the old UI (127.0.0.1:8001) and the
redesign (127.0.0.1:8002), on the same synthetic database, as the investigator user. Script:
`tests/ui-evaluation/task_comparison.py`. Raw results: `usability-measurements.json`.

**What counts:**
- a click is a deliberate click on a control; typing is not counted;
- "Not possible" means the script could not find any control for the task in that UI.

Times are not reported as results: a script's speed says nothing about how long a person needs.

| Task | Old UI | Redesign |
|---|---|---|
| T1 Open CASE-0002's evidence list from Home | 2 clicks | 2 clicks |
| T2 Open a pending review candidate from Home | 2 clicks (only for the *first* case: the old "Review Queue" shortcut always opened `cases[0]`) | 2 clicks, for any case ("N to review" per case) |
| T3 Re-check the integrity (SHA-256) of a file | **Not possible** (the `/verify` endpoint had no UI) | 3 clicks (Evidence → Details → Verify integrity) |
| T4 From an evidence file, open the exact line a claim was read from | **Not possible from the evidence page.** "Inspect Document" opened line 1; claims were reachable only through a graph edge or a timeline event | 3 clicks (Evidence → Details → Source on a claim) |
| T5 Go from a review candidate to the case's reports | 4 clicks (Back to Queue → Case Overview → Export Reports; the review page left the case layout) | 2 clicks (the Reports tab is always present) |
| T6 See who uploaded the evidence | **Not possible.** Only `USR-…` IDs were shown | 1 click: the name is in the evidence table |
| T7 Reach the control to reverse a recorded decision | **Not possible.** The backend supported `REVERSE`, the UI offered nothing | 2 clicks (Decided → candidate → "Reverse decision") |
| Record a decision on an open candidate (not scripted; counted from the code) | 3 clicks + reason (select action → Record decision → Confirm & Sign Off) | 2 clicks + reason (action button → Record decision in the reason dialog) |

**Other measured differences** (from the route sweep and the axe scan, not the task script):
- Failed requests on page load: 5 → 1. The remaining one is the intended denial for an unassigned user.
- Accessibility rule failures: 572 elements → 0. See the accessibility report.
- Navigation consistency: 4 different case layouts → 1. Pages that left the case (graph, review, reports): 3 → 0.

**What this does not show:**
- Whether officers find the new names ("Review queue", "Relationship graph", "Patterns") clearer. That needs testing with real users.
- Error rates, learnability, or time on task for people.
- Workflows not listed here.

**Recommended next step:** a moderated session with 5 officers per role on these 7 tasks plus "upload and confirm the scan result".
Record completion, time, and wrong turns against both builds (both can be served side by side as above).
