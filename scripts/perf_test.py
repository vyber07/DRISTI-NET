"""Performance testing under documented conditions (docs/status.md Role 6 backlog item: "performance
testing under documented conditions (currently untested at any scale beyond the demo dataset)").

Measures real wall-clock timings via the real HTTP layer (FastAPI TestClient -- in-process, no network
socket, so these numbers exclude real network/TLS overhead; documented explicitly, not left implicit)
against a fresh throwaway SQLite store on this host, at two scales:
  1. the golden dataset (~20 people, ~350 claims) -- today's actual production-equivalent size
  2. a synthetically generated larger CSV (configurable row count) -- to show how upload->extract time
     and graph-query time scale as data grows, not just a single anecdotal number

Run: python3 -m scripts.perf_test [large_csv_rows]   (default 20000)

Writes reports/performance.md with the measured numbers AND the exact host/software conditions they were
measured under (CPU, RAM, Python version, DB backend, scanner mode) -- per directive: "do not invent
numbers", conditions must be documented, not left implicit.
"""
from __future__ import annotations

import csv
import io
import multiprocessing
import os
import platform
import statistics
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]


def median_of(fn, n=3) -> tuple[float, list[float]]:
    times = []
    for _ in range(n):
        t0 = time.monotonic()
        fn()
        times.append(round(time.monotonic() - t0, 4))
    return statistics.median(times), times


def main() -> None:
    large_rows = int(sys.argv[1]) if len(sys.argv) > 1 else 20000

    tmp = tempfile.mkdtemp(prefix="drishti-perf-")
    os.environ["DRISHTI_STORAGE_ROOT"] = tmp
    os.environ["DRISHTI_DATABASE_URL"] = f"sqlite:///{Path(tmp) / 'perf.db'}"
    os.environ["DRISHTI_SCANNER_MODE"] = "testgate"

    from fastapi.testclient import TestClient

    from apps.api.app.config import SYNTHETIC_DIR
    from apps.api.app.main import app
    from apps.api.app.seed import seed

    seed()
    client = TestClient(app)
    r = client.post("/api/v1/auth/login", json={"username": "officer", "password": "officer-demo"})
    officer = {"Authorization": f"Bearer {r.json()['token']}"}
    r = client.post("/api/v1/auth/login", json={"username": "investigator", "password": "investigator-demo"})
    investigator = {"Authorization": f"Bearer {r.json()['token']}"}

    rows: list[tuple[str, str, float, str]] = []  # (operation, condition, seconds, detail)

    def measure(op: str, condition: str, fn, n=3, detail="") -> None:
        med, samples = median_of(fn, n)
        rows.append((op, condition, med, detail or f"{n} samples: {samples}"))
        print(f"{op} [{condition}]: median {med}s over {samples}")

    # DEF-080: re-uploading identical bytes to the same case is detected as a duplicate (uix_evidence_case_sha) and
    # returns the existing record without scanning/extracting -- so samples 2 and 3 used to time only the duplicate
    # check (e.g. 20000-row CSV: [19.5 s, 0.05 s, 0.35 s] reported as "median 0.35 s"). Every sample now goes to a
    # fresh case, and each response must be a newly created evidence record that reached a processed state.
    admin_tok = client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin-demo"}).json()["token"]
    admin = {"Authorization": f"Bearer {admin_tok}"}
    seen_ids: set[str] = set()
    case_counter = [0]

    def fresh_case() -> str:
        case_counter[0] += 1
        cid = f"PERF-{case_counter[0]:04d}"
        r = client.post("/api/v1/cases", headers=admin, json={"case_id": cid, "title": "perf sample", "jurisdiction": "Demo District A",
                                                              "purpose": "performance measurement", "authority_reference": "PERF"})
        assert r.status_code == 201, r.text
        for u in ("officer", "investigator"):
            assert client.post(f"/api/v1/cases/{cid}/assign", headers=admin, json={"username": u}).status_code == 200
        return cid

    def timed_upload(case_id: str, name: str, data: bytes, label: str):
        r = client.post(f"/api/v1/cases/{case_id}/evidence", headers=officer, files={"file": (name, data)}, data={"source_label": label})
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["evidence_id"] not in seen_ids, "duplicate upload: the sample did not run the pipeline"
        seen_ids.add(body["evidence_id"])
        assert body["status"] in ("HITL", "GRAPH_PROJECTED", "EXTRACTED", "ENTITY_CANDIDATES"), body["status"]

    def upload_golden_file(rel: str):
        p = SYNTHETIC_DIR / rel
        data = p.read_bytes()
        cid = fresh_case()  # case creation is outside the timed call below
        return lambda: timed_upload(cid, p.name, data, "perf")

    def measure_fresh(op: str, condition: str, make_call, n=3) -> None:
        samples = []
        for _ in range(n):
            call = make_call()  # set-up (new case) is not timed
            t0 = time.monotonic()
            call()
            samples.append(round(time.monotonic() - t0, 4))
        med = statistics.median(samples)
        rows.append((op, condition, med, f"{n} samples: {samples}"))
        print(f"{op} [{condition}]: median {med}s over {samples}")

    for rel in ("calls.csv", "transactions.csv", "people.json", "documents/fir_001.pdf"):
        measure_fresh(f"upload_scan_extract_resolve[{rel}]", "golden dataset file, each sample a fresh case (no duplicate short-cut)", lambda rel=rel: upload_golden_file(rel))

    # graph/analysis on one case holding the full golden dataset
    golden_case = fresh_case()
    for rel in ("people.json", "aliases.json", "calls.csv", "transactions.csv", "vehicles.csv", "locations.csv", "documents/fir_001.pdf"):
        p = SYNTHETIC_DIR / rel
        timed_upload(golden_case, p.name, p.read_bytes(), "perf-setup")
    measure("graph_query[max_nodes=50]", "case holding the full golden dataset", lambda: client.get(f"/api/v1/cases/{golden_case}/graph?max_nodes=50", headers=investigator))
    measure("analysis_query", "case holding the full golden dataset", lambda: client.get(f"/api/v1/cases/{golden_case}/analysis", headers=investigator))

    # ---- scale 2: a synthetically larger CSV, to show scaling behaviour, not just one data point
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["caller", "callee", "start_time", "duration_sec", "cell_id"])
    for i in range(large_rows):
        w.writerow([f"+9190000{i % 500:05d}", f"+9190000{(i + 1) % 500:05d}", "2025-07-01T10:00:00", str(10 + i % 300), "TWR-PERF-01"])
    large_csv = buf.getvalue().encode()

    large_cases: list[str] = []

    def upload_large_csv():
        cid = fresh_case()
        large_cases.append(cid)
        return lambda: timed_upload(cid, "perf_calls.csv", large_csv, "perf-scale")

    measure_fresh(f"upload_scan_extract_resolve[synthetic_calls_{large_rows}_rows]", f"{large_rows}-row CSV, each sample a fresh case", upload_large_csv, n=3)
    measure("graph_query[max_nodes=150]_after_large_upload", f"case holding one {large_rows}-row CSV", lambda: client.get(f"/api/v1/cases/{large_cases[0]}/graph?max_nodes=150", headers=investigator))

    conditions = [
        f"Host: {platform.platform()}, {multiprocessing.cpu_count()} vCPU",
        f"Python: {platform.python_version()}",
        "DB backend: SQLite (throwaway file, zero-install default) -- NOT the real Postgres path; see docs/adr/001",
        "Scanner: DRISHTI_SCANNER_MODE=testgate (documented safe substitute, not real ClamAV -- see scripts/evaluate.py's docstring for why)",
        "Transport: FastAPI TestClient (in-process ASGI calls) -- excludes real network/TLS round-trip time",
        "Each measured operation: median of 3 samples, printed alongside the median so the spread is visible",
    ]

    lines = [
        "# Performance testing",
        "",
        f"Computed {datetime.now(timezone.utc).isoformat(timespec='seconds')} by `scripts/perf_test.py`.",
        "",
        "## Conditions (docs/context.md: never invent numbers without documenting how they were measured)",
        "",
        *[f"- {c}" for c in conditions],
        "",
        "## Results",
        "",
        "| operation | condition | median seconds | detail |",
        "|---|---|---|---|",
    ]
    for op, condition, med, detail in rows:
        lines.append(f"| {op} | {condition} | {med} | {detail} |")
    lines += [
        "",
        "## Known limitations of this measurement",
        "",
        ("- Not measured against a real Postgres/Neo4j/MinIO/Redis stack, only the zero-install SQLite "
        "default -- the real-stack numbers (`TASK_BOARD.md` Phases 2/3/6/7 verified those paths *work*, "
        "not their latency) would need a separate run with `DRISHTI_DATABASE_URL`/`DRISHTI_NEO4J_URI` set."),
        ("- Not measured against real ClamAV (`testgate` is a fixed-cost stand-in, not proportional to file "
        "size the way a real virus scan is) -- see `TASK_BOARD.md` Phase 13's note on this sandbox's "
        "ClamAV daemon for why a real-scanner run wasn't done here."),
        "- Single-process, single-request-at-a-time -- no concurrent-load / throughput test was run.",
        ("- The large-CSV scale point uses synthetic filler data generated by this script, not a second "
        "planted golden dataset -- it characterizes ingestion-time scaling, not extraction correctness "
        "(that's `scripts/evaluate.py`'s job)."),
        ("- The 3 large-CSV samples are cumulative, not independent: each upload adds its rows to the same "
        "CASE-0002 (nothing resets the store between samples), so by the 3rd sample the case holds ~3x "
        "the entities/edges of the 1st. The `graph_query[max_nodes=150]_after_large_upload` row is "
        "therefore query time against that grown state, not a fixed dataset -- a real regression check "
        "would isolate one store per sample; this script trades that isolation for a simpler, faster run."),
    ]
    (REPO_ROOT / "reports" / "performance.md").write_text("\n".join(lines) + "\n")
    print("Wrote reports/performance.md")


if __name__ == "__main__":
    main()
