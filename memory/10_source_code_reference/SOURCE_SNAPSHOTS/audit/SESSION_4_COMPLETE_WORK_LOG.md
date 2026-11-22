# DRISTI-NET: Session 4 Complete Work Log

**Period:** 2026-11-01 to 2026-11-04
**Branch:** `audit/session-4-security-fixes` (local only, not pushed, not merged)
**Starting point:** `main` @ `135edeb`. **End point:** `db899e8`.
**Size of change:** 14 commits, 138 files (25 added, 1 deleted, 112 modified), +3054 / −1892 lines.
**Release status at the end:** **ENGINEERING PREVIEW**, unchanged. The live demo has **not** been updated (see section 9).

This file records what was done in this session, why each thing was done, how it was verified, the mistakes made
along the way, and what remains. It was written from the git history, the defect register and the recorded test runs.

---

## 1. What was asked

| # | Request | How it was handled |
|---|---|---|
| 1 | Two long "master takeover" prompts: audit DRISTI-NET from scratch, fix verified defects, test through a real browser, verify backup and restore, document honestly, never claim unverified results. | Session 4, first pass. Continued from the earlier sessions' handoff (`CONTINUATION_STATE.md`) instead of starting over. |
| 2 | "recheck and verify and redo all" | Second pass: re-ran everything from scratch, brought in independent reviewer agents, ran the full live stack. |
| 3 | "recheck and retry and redo all again and solve all errors and also reread all codes and correct and test and debug it" | Third pass: first Python static analysis, scripts audit, full pipeline reread. |
| 4 | "continue" | Fourth pass: fixed the three items earlier passes had only recorded. |
| 5 | "make a file of everything you did" | This document. |

Project rules followed throughout (`CLAUDE.md`, `docs/context.md`):
- STRICT handling of `auth.py`, `models.py`, `pipeline.py`, `scanner.py`, `resolution.py`, graph bounds and masking: smallest change, plus a success test and a failure test.
- Neutral language: no guilt, threat or certification wording.
- Every status claim backed by a test.
- No credentials, real data or `storage/` committed.

---

## 2. How the work was done (method and safety)

- **Isolation first.** The live demo (systemd `dristinet-api`, uvicorn on `0.0.0.0:8000`, nginx on :80) and its database
  `storage/drishti.db` were never written to.
  - The only live-demo contact was read-only: a request for the public `README.md` to confirm the path-traversal bug,
    health checks, and read-only opens of the database file (`mode=ro`, or the SQLite backup API onto a copy).
  - The database checksum was compared before and after every script run that could have touched it.
- **Disposable test environments:**
  - isolated SQLite instances on ports 8001, 8002 and 8005, each with its own temporary directory;
  - containers `dristi-verify-{pg,neo4j,minio}` (PostgreSQL 16, Neo4j 5, S3-compatible MinIO) bound to 127.0.0.1,
    with random credentials and no volumes;
  - the host's real ClamAV 1.4 on 127.0.0.1:3310.
- **Failing test first.** Each code fix has a regression test that was run against the old code and failed, then run
  against the new code and passed. The old code was restored temporarily with `git stash` for the check. Exceptions
  (pure config or script fixes) are marked in the defect register.
- **Independent review.** Six reviewer agents were started across two rounds, each read-only and without access to
  earlier conclusions. Every reported finding was reproduced by the primary agent before being fixed.
  - Round 1 (second pass): backend security, frontend↔backend contract, infrastructure and documentation claims. All three reported.
  - Round 2 (third pass): backend pipeline, full frontend reread, tests and scripts. All three stopped at the account's
    agent limit before reporting. Their probe scripts were read, then run in isolated stores, and every lead was reproduced.
  - No human reviewer has reviewed this work.
- **No outward actions.** Nothing was pushed, published, deployed, restarted or rotated. Those need the owner (section 9).

---

## 3. Timeline (commits)

| Commit | When (UTC) | Pass | Summary |
|---|---|---|---|
| `ebd5faa` | 11-01 07:54 | 1 | Path traversal (P0), cross-case authorization gaps, evidence download/listing, dependency fixes, restore drill script |
| `be266a9` | 11-01 07:56 | 1 | Release archive record |
| `a276b9f` | 11-01 08:45 | 2 | Independent-review fixes: scanner gate, cross-case leaks, masking, outages, fabricated UI evidence, 10 restored tests, Compose fixes |
| `706934f` | 11-03 14:49 | 2 | Neo4j projection that disagrees with authoritative rows is never served |
| `2718933` | 11-03 14:51 | 2 | Release archive and restore drill record |
| `917c779` | 11-03 15:37 | 3 | Static analysis, internal-detail leaks, frontend truthfulness, ops guards |
| `6283645` | 11-03 18:51 | 3 | Performance numbers, schema export, evaluation script |
| `2b437b3` | 11-03 19:14 | 3 | Pipeline: Merkle (RFC 6962), audit signature, PostgreSQL time zone, cross-case person merge, reviewer decisions, provenance |
| `17263fa` | 11-03 19:17 | 3 | HITL filters, empty-graph copy |
| `8e8502c` | 11-03 19:18 | 3 | Defect register DEF-073..097, decisions, handoff |
| `494b35e` | 11-03 19:19 | 3 | Release archive record |
| `8a48dd2` | 11-03 23:46 | 4 | Job leases, candidate refresh, pinned NER model |
| `d295962` | 11-03 23:49 | 4 | Fourth-pass records |
| `db899e8` | 11-03 23:51 | 4 | Release archive record |

---

## 4. Everything that was found and fixed (DEF-028 … DEF-100)

Severity: P0 = critical, P1 = major, P2 = important, P3 = minor. Full evidence for each is in
`audit/BUG_AND_DEFECT_REGISTER.md`.

### 4.1 Security and access control

| ID | Sev | What was wrong | Why it mattered | What was done |
|---|---|---|---|---|
| DEF-028 | **P0** | The web-app fallback route served any file on the server via an encoded `..` path. Confirmed on the live demo's port 8000. | `.env` (the key that signs logins and audit records), the database and stored evidence were all readable without logging in. | Requested path must resolve inside the web build directory, including symlinks. The systemd unit in the repo now binds 127.0.0.1. |
| DEF-031 | P1 | Claiming a review task, and the case statistics, checked role but not case assignment. | Any reviewer could act on and read other cases. | Case authorization added; denials audited. |
| DEF-032 | P1 | Claiming a review task always returned HTTP 500, after saving. | The HITL "claim" action never worked. | Fixed the wrong function call. |
| DEF-033 / 033b | P1 | Entity card, graph and locations returned another case's date of birth and address. | Cross-case personal data exposure. The first fix was incomplete; the second pass found the remaining paths. | Membership check, plus one per-case attribute helper used everywhere. |
| DEF-038 | P2 | Review candidates exposed raw phone numbers in `block_key`. | Bypassed masking for analysts. | Masked. |
| DEF-039 | P2 | The court PDF printed phone and account numbers unmasked. | Bypassed masking in an export. | Report and PDF share one masking function. |
| DEF-041 | P2 | Text typed into PDF fields was parsed as markup (could break the PDF or embed server images). | Injection into an export. | All interpolated text escaped. |
| DEF-046 | P3 | One "reveal" call could unmask a whole file. | Defeated per-line, audited unmasking. | Window limited to 0–10 lines. |
| DEF-048 | P3 | Case list ignored jurisdiction. | Listed cases that the case page itself denies. | Same rule as case authorization. |
| DEF-049 | P2 | Role-based denials were not audited. | Constitution §6.1 requires denial auditing. | `require_roles` writes `ACCESS_DENIED`. |
| DEF-050 | P3 | Review reasons returned unmasked. | Phone numbers typed into reasons leaked. | Masked. |
| DEF-057 | P2 | Any secret was accepted, even `x`. | Weak signing key for logins and audit. | Minimum 32 characters on every deployment. |
| DEF-074 | P2 | Unauthenticated `/health` showed the storage path; `/ready` echoed database errors; job errors carried server tracebacks. | Internal details leaked. | Generic outputs; tracebacks go to the server log. |

### 4.2 Evidence integrity and the malware gate

| ID | Sev | What was wrong | Why it mattered | What was done |
|---|---|---|---|---|
| DEF-036 | **P1** | The scanner treated any reply containing "OK" as clean, so `Win.Trojan.OKbot FOUND` became CLEAN. | An infected file could pass the malware gate and be processed. | Strict parsing of `stream: OK` and `… FOUND`; anything else is SCAN_FAILED. |
| DEF-037 | P2 | An unreadable scanner reply crashed the scan. | Evidence stuck permanently. | Fail closed as SCAN_FAILED (retryable). |
| DEF-040 | P2 | Merkle anchors included files that never passed the scan. | Integrity reference built over unverified data. | Allowlist of post-gate states. |
| DEF-042 | P2 | A deleted evidence object caused a server error, and `verify` didn't flag it. | Silent failure. | INTEGRITY_MISMATCH, audited, 409 (DEC-011). |
| DEF-085 | **P1** | The Merkle tree had no leaf/node separation and duplicated the last leaf: `[a,b,c]` and `[a,b,c,c]` had the same root. The code claimed RFC 6962 but wasn't. | The integrity reference was ambiguous. | RFC 6962 for new anchors; old anchors still verify through a stored `merkle_scheme` (migration `5bcde1234570`, DEC-013). |
| DEF-088 | **P1** | On a PostgreSQL server set to a non-UTC zone (e.g. Asia/Kolkata), every stored time shifted 5 h 30 m and **every audit signature failed**. | The audit trail was unverifiable on such servers. | Each database session pinned to UTC. Tested with the database zone set to Asia/Kolkata. |
| DEF-091 | P1 | Audit signatures joined fields with `|`, so text could move between fields without detection. | Tamper evidence could be bypassed. | JSON-based signature (`hmac-sha256-json`); old signatures still verify. |

### 4.3 Identity, human review and analytics

| ID | Sev | What was wrong | Why it mattered | What was done |
|---|---|---|---|---|
| DEF-090 | **P1** | Different people sharing a source ID (e.g. `P-001`) in two cases were merged into one entity, shown with the first case's name. | An automatic merge of people, which the constitution forbids (§2.2), plus cross-case name exposure. | Person IDs scoped to the case (DEC-014). |
| DEF-092 | **P1** | A reviewer's decision on conflicting records was reversed by the next unrelated upload. | Automation overwrote a human decision. | Reviewed claims are never re-flagged. |
| DEF-093 | P1 | A blank phone or account created one shared fake entity across rows and cases. | Invented relationships and a fake top hub. | No edge; the gap is recorded as missing data. |
| DEF-099 | P2 | Match suggestions never updated with later evidence. | Reviewers saw stale signals. | Undecided ones refresh; decided ones keep their snapshot and list newer evidence. |
| DEF-089 | P2 | Bridge analysis checked only the first 12 displayed members of each community. | Real bridges reported touching no community. | Full community sets used. |
| DEF-071 | P2 | Neo4j traversals skipped the high-degree node cap. | Unbounded neighbour lists. | Centered traversals bounded the same way on every backend (DEC-012). |
| DEF-072 | P2 | A Neo4j copy holding other data returned an empty graph. | Wrong results from a shared or stale projection. | Projection is checked against authoritative rows; otherwise flagged stale. |
| DEF-043 | P1 | Neo4j down meant the graph returned a server error. | The documented fallback didn't work. | Falls back to the authoritative data with `projection_stale: true`. |

### 4.4 Processing reliability and provenance

| ID | Sev | What was wrong | What was done |
|---|---|---|---|
| DEF-044 | P2 | Object store down meant an upload server error; no S3 timeouts. | 503 with no record created; 5 s / 30 s timeouts. |
| DEF-045 | P3 | Duplicate-upload audit row never saved. | Committed. |
| DEF-047 | P3 | Opening a corrupt PDF's source returned a server error. | Controlled 422. |
| DEF-083 / 084 | P1 | A storage error during scan, or a matching failure, left evidence stuck forever. | Recorded as failed and retryable. |
| DEF-098 | P1 | A crash in the middle of a job left it "running" forever. | 15-minute job lease; takeover is audited. |
| DEF-087 | P2 | Time filters: ISO dates ignored, and the timeline compared dates as text. | Parsed strictly, or rejected with 422. |
| DEF-094 / 095 / 096 | P2–P3 | "Open source" went to the wrong line (CSV blank lines, NER pages, repeated owner sentences). | Exact line numbers; NER run per page; one claim per sentence. |

### 4.5 What users saw (frontend)

| ID | Sev | What was wrong | What was done |
|---|---|---|---|
| DEF-058 | **P0** | The review pane showed a fabricated Call Detail Record headed "Government of Rajasthan • Special Operations Group", with a fake threat transcript, under the real file's name and hash, for every candidate. | Fabricated viewer deleted; the real source lines are shown. A browser test checks the fake content can't return. |
| DEF-029 / 030 | P1 | Evidence page never loaded; Download never worked. | Loads from the route; authenticated download, checked against the SHA-256. |
| DEF-059 / 060 | P1 | Reviewers never saw why records were suggested as a match, and past decisions showed blank. | Signals, counter-evidence, conflicts and missing data shown; decisions mapped. |
| DEF-061 | P1 | After a 403 or a logout, the previous user's graph stayed on screen. | Stores cleared; full reload on logout. |
| DEF-062 / 063 / 066 / 077 | P2 | Fake "core connections (7)" toggle, dead filters, fake map lines, hard-coded dashboard 0, `CASE-0001` fallbacks. | Removed or replaced with real data. |
| DEF-064 / 068–070 | P2 | Fake reveal expiry, "Target Suspect" label, statutory claims, legal quick-fill text ("Corroborated under Sec 91 CrPC…"), hard-coded "Zero-Trust Active". | Accurate, neutral wording. |
| DEF-065 / 067 / 076 / 078 / 079 / 097 | P2 | Invalid claim decision value, review queue hidden by a 403, wrong upload/login messages, revealed value never shown, timeline in the wrong time zone, review filters that did nothing. | Fixed and checked in a real browser. |

### 4.6 Infrastructure, tests, scripts and documents

| ID | Sev | What was wrong | What was done |
|---|---|---|---|
| DEF-052 | P1 | Docker Compose migrations had no secret key, so nothing could start. | Key passed; tested with the exact Compose environment. |
| DEF-053 | P1 | Kafka setting had the wrong variable name. | Renamed. |
| DEF-054 | P1 | No `.dockerignore`, so `.env` and the demo DB would be copied into images. | Added. |
| DEF-055 / 056 / 075 | P1 | Test fixtures and `make` targets could wipe a real database or the live demo. | Refuse unless the target is a test database or the action is explicitly confirmed. |
| DEF-051 | P1 | 10 tests deleted in an earlier commit were still cited as proof. | Restored; all pass. |
| DEF-073 | P2 | A test that asserted nothing. | Real assertions. |
| DEF-080 | P1 | Performance script timed duplicate detection, not processing: 20,000-row CSV reported as 0.35 s, really 17.8 s. | Each sample is a real pipeline run; report regenerated. |
| DEF-081 | P1 | OpenAPI export opened the live demo's database. | Uses a throwaway store. |
| DEF-082 | P2 | Evaluation script crashed. | Fixed; all planted scenarios HIT. |
| DEF-086 | P1 | Existing SQLite databases never received new columns. | Additive upgrade at startup, tested on a copy of the live DB. |
| DEF-100 | P1 | NER model unpinned; its weights came from an unmerged pull-request branch. A test also showed a loader bug would have silently disabled NER. | Pinned commit, offline mode, first real-model test. |
| DEF-034 / 035 | P2 | Hard-coded Besu signing key; unused `pdfjs-dist` carrying all npm advisories; Kafka library CVE. | Removed or upgraded. `npm audit` now reports 0. |
| — | — | Overclaiming documents: "PRODUCTION STAGING READY" security verdict, government "compliance" matrix, DR plan, 8 task-board phases. | Withdrawn or corrected; untested items labelled as targets. |

---

## 5. Decisions recorded (`PROJECT_DECISION_LOG.md`)

| ID | Decision | Reason |
|---|---|---|
| DEC-011 | A missing evidence object is INTEGRITY_MISMATCH (no new state); S3 "missing" means 404 only. | A missing object can't match its manifest; a credentials error must never look like data loss. |
| DEC-012 | Centered graph traversals run on the authoritative in-memory projection; Neo4j is used only when it agrees with it. | Same limits on every backend; Neo4j stays a rebuildable projection. |
| DEC-013 | New anchors use RFC 6962, with the scheme stored per anchor. | Old roots can't be recomputed under a new scheme. |
| DEC-014 | Source `person_id` values are scoped per case. | No automatic merging of people across cases. |

---

## 6. Verification evidence (final state)

| Check | Result |
|---|---|
| Backend tests, SQLite (`make test`, clean environment) | 181 passed, 6 skipped (need live services) |
| Backend tests, live PostgreSQL 16 + Neo4j 5 + S3 + real ClamAV | 188 passed, 0 failed, 0 skipped |
| Browser E2E (Playwright, Chromium) on the live stack | 6/6, two consecutive runs |
| Browser sweep, 14 routes | 0 console errors, 0 failed requests |
| Golden journey (real ClamAV, real NER) | 8/8 files to review or graph |
| Dry runs | 5 runs × 29/29 steps |
| Evaluation (golden dataset) | all 6 planted scenarios HIT; identity decisions 3/3 |
| Negative tests: EICAR, bad tokens, oversized, cross-case, concurrent duplicates, tampering | all behave as required (details in `audit/TEST_RESULTS.md`) |
| Failure injection (DB, storage, Neo4j, scanner outages) | controlled failures, no false success |
| Backup → restore drill (SQLite) | 8/8 evidence hashes, 52/52 audit signatures, identical graph; all fail under a wrong key |
| Real NER model, offline | 21 candidates with page/line locators, all marked for review |
| Static analysis | ruff and bandit, first runs; findings fixed or explained |
| Dependency audit | npm 0 advisories; Python: only `paddlepaddle` (optional OCR) |
| Release archive (`d295962`) | unpacked and re-tested: 180 passed / 7 skipped, clean build, no secrets inside. SHA-256 `8f6f169c88ba7a4d87ce0102b3f63647835f48a441931f7ad02fde67b3caf186` |

Measured performance (host: 2 vCPU, 7 GB RAM, SQLite, in-process client):
- golden files: 0.03–0.66 s each (the PDF's first sample is 10.7 s while the NER model loads);
- 20,000-row CSV ingest: **17.8 s** median;
- graph query on that case: 4.8 s.

---

## 7. Mistakes made during the session, and how each was handled

Recorded for honesty; none reached the live demo.

1. **The first DEF-033 fix was incomplete.** The second pass found the same leak in the graph and locations routes (DEF-033b).
2. **The web build directory is served by the live demo.** Rebuilding it changed the frontend the demo serves. It came
   from the same committed source each time, and the demo kept working.
3. **A test was written wrongly, then corrected** in several places:
   - masked values not accounted for;
   - an unrealistic crash simulation;
   - a test pair already at the confidence cap.
4. **A test's broad `except` hid a real bug** (NER loader `TypeError`). It was narrowed, which exposed and fixed the bug.
5. **A shell `sed` failed and broke a checksum check**, giving a false "demo DB changed" alarm. Investigated with file
   timestamps; the demo DB had not changed.
6. **Decision IDs DEC-009/010 collided with existing entries.** Renumbered to DEC-011/012.
7. **Commit messages twice carried a wrong test count.** Amended locally before any push.
8. **A command that included `make clean` (to prove its new guard) was blocked by the safety check, correctly.** The
   guard was verified with `make -n` instead.
9. **A reviewer agent left a PostgreSQL container holding a test port.** Identified by its creation time and name,
   stopped, and removed.

---

## 8. New files

- **Tests:**
  - `test_cross_case_and_exports.py`
  - `test_scanner_parsing.py`
  - `test_merkle_rfc6962.py`
  - `test_provenance_and_decisions.py`
  - `test_ner_real_model.py`
  - `test_workflow_restored.py`
- **Migration:** `5bcde1234570_ledger_anchor_merkle_scheme.py`
- **Scripts:** `scripts/backup_restore_drill.py`
- **Operations:** `operations/RESTORE_TEST_REPORT.md`, `.dockerignore`
- **Evidence:** `audit/browser/screenshots/*`
- **This log:** `audit/SESSION_4_COMPLETE_WORK_LOG.md`

Deleted: `apps/web/src/components/evidence/PdfDocumentViewer.tsx` (the fabricated record viewer).

---

## 9. What remains

### Needs the owner (not done because it is live, outward-facing or a policy choice)

1. **Restart the live demo on this branch.** It still runs code with DEF-028 and every later backend defect. The upgrade
   was rehearsed successfully on a copy of its database.
   ```
   sqlite3 storage/drishti.db ".backup /home/ubuntu/drishti-pre-restart.db"
   sudo cp infrastructure/dristinet-api.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl restart dristinet-api
   ```
   Also disable `dristinet-native.service` (a second service on port 8000).
2. Rotate `DRISHTI_SECRET_KEY` if port 8000 was ever reachable from the internet. Keep the old key in
   `DRISHTI_AUDIT_KEYS` so existing audit records still verify.
3. Merge and push the branch.
4. Policy decisions:
   - raw-file download for evidence officers and auditors;
   - names on identifier entities shared across cases;
   - the six-tier evidence model (UI removed until decided).
5. Replacement MinIO and Kafka images (pinned ones can't be downloaded) and an isolated host for Docker Compose.

### Engineering work still open

- NER accuracy on a meaningful evaluation set (the model missed a name in a probe).
- Separate core and optional Python dependencies.
- PostgreSQL + object-store backup/restore drill (blocked by Compose).
- Container scan and dynamic security testing.
- A human second reviewer.

### Release status

**ENGINEERING PREVIEW.** Staging needs a working Compose stack, a PostgreSQL/S3 restore drill and TLS. Production and
any government deployment need independent and organisational approval. None of these has been claimed.

---

## 10. Addendum: owner decisions carried out (2026-11-04)

You answered four questions; here is what was done for each.

| Your decision | What was done | Evidence |
|---|---|---|
| Restart the live demo **and rotate the key** | Backups to `/home/ubuntu/drishti-backups/pre-restart-20261104T005254Z` (DB integrity ok, counts identical; `.env`; unit files). New 64-hex key; old key kept as audit key `k1-2026`, new key current as `k2-2026`. Repo service file installed (binds 127.0.0.1), duplicate `dristinet-native` disabled, service restarted on the fixed code. | Traversal probe now returns the app page; old-key token → 401; new audit events `k2-2026:hmac-sha256-json` verify; 14-route browser sweep 0 errors |
| Merge into `main` locally | Fast-forward; nothing pushed (main is ahead of GitHub) | `git status` |
| Restrict raw downloads and require a reason | `POST /evidence/{id}/download`, investigator/reviewer/admin only, reason recorded in the audit log (DEF-101, DEC-015); UI disables it for other roles | test fails on the old code; E2E 6/6 |
| Work on NER accuracy, Docker Compose, dependency split | All three done (below) | below |

**Found while doing it:**
- **DEF-102.** Before rotating, the baseline check showed 33 of the live demo's 124 audit events verify only with the **public built-in key**. These are the 2026-11-01 ingest, run without `.env`. They are recorded as unverifiable, not re-signed. The seed CLI now refuses the default key.
- **DEF-103 – DEF-106.** The first real `docker compose up` exposed:
  - two health checks that could never pass;
  - a Kafka publish bug that meant asynchronous processing had never worked;
  - nginx keeping a dead API address after a redeploy;
  - version drift, including web3 breaking on a new `eth-typing`.

  All fixed and verified on the running stack.

**Results:**
- **Compose stack:** all 11 services healthy in an isolated project. Live test suite inside the stack: 191 passed / 1 skipped. Browser E2E through the stack's nginx: 6/6. Kafka → worker processing works.
- **Dependencies:** the core install is 302 MB against 3.0 GB (`requirements.txt` plus `-ml`, `-kafka`, `-ledger`, `-dev`). `constraints.txt` is the tested lock.
- **NER:** 200-entity synthetic set, pinned model 0.960 micro-F1. All 16 errors come from one template ("<city> police station" labelled as an organisation). This is synthetic, so it is not a real-world accuracy figure.

**Still open:**
- push to GitHub (your call);
- PostgreSQL + S3 backup/restore drill on the Compose stack;
- TLS;
- the two remaining policy questions (labels on identifiers shared across cases, the six-tier model);
- a human independent review.
