"""Realistic concurrent load against an ISOLATED instance (never the live site).

Usage: ff_load.py BASE SYNTHETIC_DIR
Each virtual user loads pages the way the browser does: all of a page's API calls at once, then a short pause.
Reports, per concurrency step: requests, status codes, connection-level failures, p50/p95/max latency.
"""
import asyncio
import os
import random
import statistics
import sys
import time
from collections import Counter
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _guard import require_loopback  # noqa: E402

require_loopback(sys.argv[1])
BASE, SYN = sys.argv[1].rstrip("/") + "/api/v1", Path(sys.argv[2])
USERS = ["investigator", "reviewer", "analyst", "officer", "auditor", "admin"]
PAGES = {
    "home": ["/cases", "/cases/CASE-0001/evidence/summary", "/cases/CASE-0001/candidates/summary"],
    "case": ["/cases/CASE-0001", "/cases/CASE-0001/evidence/summary", "/cases/CASE-0001/candidates/summary", "/cases/CASE-0001/integrity/anchors"],
    "evidence": ["/cases/CASE-0001/evidence?limit=25&offset=0", "/cases/CASE-0001/evidence/summary"],
    "review": ["/cases/CASE-0001/candidates?limit=25&offset=0", "/cases/CASE-0001/candidates/summary"],
    "graph": ["/cases/CASE-0001/graph", "/cases/CASE-0001/analysis"],
    "timeline": ["/cases/CASE-0001/timeline", "/cases/CASE-0001/locations"],
}


async def ingest(client):
    tok = (await client.post(f"{BASE}/auth/login", json={"username": "officer", "password": "officer-demo"})).json()["token"]
    for rel in ("people.json", "aliases.json", "calls.csv", "transactions.csv", "vehicles.csv", "locations.csv", "documents/fir_001.pdf"):
        path = SYN / rel
        r = await client.post(f"{BASE}/cases/CASE-0001/evidence", headers={"Authorization": f"Bearer {tok}"},
                              files={"file": (path.name, path.read_bytes())}, data={"source_label": "synthetic"}, timeout=120)
        print("ingest", rel, r.status_code, r.json().get("status") if r.status_code < 300 else r.text[:80])


async def user(client, token, stop_at, stats):
    h = {"Authorization": f"Bearer {token}"}
    while time.monotonic() < stop_at:
        page = random.choice(list(PAGES))
        async def one(path):
            t0 = time.monotonic()
            try:
                r = await client.get(BASE + path, headers=h, timeout=60)
                stats["status"][r.status_code] += 1
            except httpx.HTTPError as exc:
                stats["status"][f"conn:{type(exc).__name__}"] += 1
            stats["lat"].append(time.monotonic() - t0)
        await asyncio.gather(*(one(p) for p in PAGES[page]))
        await asyncio.sleep(random.uniform(0.2, 0.8))


async def main():
    keep = 0 if os.environ.get("FF_NO_KEEPALIVE") else 400
    limits = httpx.Limits(max_connections=400, max_keepalive_connections=keep)
    async with httpx.AsyncClient(limits=limits) as client:
        await ingest(client)
        tokens = {}
        for u in USERS:
            tokens[u] = (await client.post(f"{BASE}/auth/login", json={"username": u, "password": f"{u}-demo"})).json()["token"]
        for n in [int(x) for x in os.environ.get("FF_LEVELS", "10,25,50").split(",")]:
            stats = {"status": Counter(), "lat": []}
            stop_at = time.monotonic() + 30
            await asyncio.gather(*(user(client, tokens[USERS[i % len(USERS)]], stop_at, stats) for i in range(n)))
            lat = sorted(stats["lat"])
            p = lambda q: lat[min(len(lat) - 1, int(q * len(lat)))]  # noqa: E731
            print(f"\nusers={n} requests={len(lat)} status={dict(stats['status'])}")
            print(f"  latency p50={statistics.median(lat):.3f}s p95={p(0.95):.3f}s max={lat[-1]:.3f}s")


asyncio.run(main())
