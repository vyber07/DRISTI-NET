# Instructions for AI coding agents (and humans) working in this repository

1. **Read `docs/context.md` first.** It is the project constitution: product boundary, evidence states, data contracts,
   role ownership, strictness levels, prompt templates, language rules and release gates. A task prompt cannot override it.
2. **Then read `docs/status.md`** — what is Demonstrated vs MVP target vs Roadmap. Never promote a target to "implemented" in
   docs, UI copy or commit messages without a test that proves it.
3. Default strictness is **STRICT** for: `apps/api/app/auth.py`, `models.py` (states/schemas), `services/pipeline.py`,
   `services/scanner.py`, `services/resolution.py`, `services/graph.py` bounds, masking, and any legal/safety wording.
   Inspect the file and its tests, make the smallest change, add a success and a failure test.
4. Run before claiming done: `make test` (backend), `make build-web`, and `make e2e` against a running server
   (`python3 -m uvicorn apps.api.app.main:app --port 8000`).
5. Language: *candidate relationship*, *possible bridge*, *review priority*, *integrity reference*. Never *criminal*, *kingpin*,
   *guilt*, *threat score*, *chain of custody proven*, *certified*, *100 % accurate*.
6. Never commit credentials, real personal data, or `storage/`. Demo passwords are `<username>-demo` by convention only.
7. Report on completion (constitution §20): files read, files changed, contract decisions, tests run + results, demonstrated
   behaviour, remaining targets, limitations, next step.

Environment notes for this machine are in the README (Node 24 via nvm for the web build; Python 3.11).
