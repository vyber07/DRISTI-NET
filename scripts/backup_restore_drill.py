"""Backup → restore → verify drill for the single-host deployment (SQLite + local object storage).

    python scripts/backup_restore_drill.py --db <path/to/drishti.db> --storage <storage root> --work <empty dir>

Reads the source; never writes to it. What it does:
  1. Backup: SQLite online-backup API (consistent while the API is running) + copy of the object tree
     (quarantine/, accepted/, derived/ ...), then a SHA-256 manifest of every backed-up file.
  2. Verifies the manifest, then restores the backup into a fresh directory.
  3. Fingerprints source and restore in separate subprocesses (the app reads its config at import time):
     row count per table, SHA-256 of every evidence object against its manifest value, HMAC of every audit
     event, and a graph snapshot hash per case rebuilt from the authoritative rows (Neo4j not involved).
  4. Exits 0 only if the two fingerprints agree and nothing failed. Writes report.json into --work.

Not covered (see operations/RESTORE_TEST_REPORT.md): PostgreSQL/MinIO (Compose stack is blocked, BLK-04/05),
off-host copies, encryption of the backup at rest, and key escrow. The JWT/audit signing key is NOT inside the
backup: without the same DRISHTI_SECRET_KEY / DRISHTI_AUDIT_KEYS the restored audit trail cannot be verified, which
step 3 demonstrates with --wrong-key-check.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sqlite3
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DB_SIDE_FILES = {"drishti.db", "drishti.db-wal", "drishti.db-shm"}


def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def backup(db: Path, storage: Path, dest: Path) -> dict:
    dest.mkdir(parents=True)
    src = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    out = sqlite3.connect(dest / "drishti.db")
    src.backup(out)
    out.close(); src.close()
    objects = dest / "storage"
    for p in sorted(storage.rglob("*")):
        rel = p.relative_to(storage)
        if p.is_file() and not (len(rel.parts) == 1 and (rel.name in DB_SIDE_FILES or rel.suffix in (".db", ".db-wal", ".db-shm"))):
            target = objects / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(p, target)
    manifest = {str(p.relative_to(dest)): sha256_file(p) for p in sorted(dest.rglob("*")) if p.is_file()}
    (dest / "MANIFEST.sha256.json").write_text(json.dumps(manifest, indent=1))
    return manifest


def verify_manifest(dest: Path) -> list[str]:
    manifest = json.loads((dest / "MANIFEST.sha256.json").read_text())
    bad = [rel for rel, h in manifest.items() if not (dest / rel).is_file() or sha256_file(dest / rel) != h]
    extra = [str(p.relative_to(dest)) for p in dest.rglob("*") if p.is_file() and p.name != "MANIFEST.sha256.json" and str(p.relative_to(dest)) not in manifest]
    return bad + [f"unexpected:{e}" for e in extra]


def restore(backup_dir: Path, target: Path) -> tuple[Path, Path]:
    storage = target / "storage"
    shutil.copytree(backup_dir / "storage", storage) if (backup_dir / "storage").exists() else storage.mkdir(parents=True)
    shutil.copy2(backup_dir / "drishti.db", storage / "drishti.db")
    return storage / "drishti.db", storage


FINGERPRINT = r'''
import json, sys
from datetime import datetime, timezone
from sqlalchemy import inspect, text
from apps.api.app.db import SessionLocal, engine
from apps.api.app.models import AuditEvent, Case, Evidence
from apps.api.app.services import storage
from apps.api.app.services.audit import verify_audit_event
from apps.api.app.services import graph as g

ref = datetime(2026, 1, 1)  # naive, matching graph.aggregate()
db = SessionLocal()
out = {"tables": {}, "evidence": {}, "audit": {"total": 0, "bad": []}, "graphs": {}}
with engine.connect() as c:
    for t in sorted(inspect(engine).get_table_names()):
        out["tables"][t] = c.execute(text(f'select count(*) from "{t}"')).scalar()
for ev in db.query(Evidence).order_by(Evidence.evidence_id):
    if not storage.exists(ev.storage_path):
        out["evidence"][ev.evidence_id] = "MISSING"
        continue
    ok, actual = storage.verify_hash(ev.storage_path, ev.sha256)
    out["evidence"][ev.evidence_id] = "MATCH" if ok else f"MISMATCH:{actual}"
for a in db.query(AuditEvent):
    out["audit"]["total"] += 1
    if not verify_audit_event(a):
        out["audit"]["bad"].append(a.audit_id)
for case in db.query(Case).order_by(Case.case_id):
    G = g.build_projection(db, case.case_id)
    nodes, edges, _ = g.aggregate(G, reference=ref)
    if nodes or edges:
        out["graphs"][case.case_id] = {"nodes": len(nodes), "edges": len(edges), "snapshot": g.snapshot_hash(nodes, edges)}
print("FINGERPRINT=" + json.dumps(out, sort_keys=True))
'''


def fingerprint(db: Path, storage: Path, env_extra: dict | None = None) -> dict:
    env = {**os.environ, "DRISHTI_DATABASE_URL": f"sqlite:///{db}", "DRISHTI_STORAGE_ROOT": str(storage),
           "DRISHTI_SCANNER_MODE": "unavailable", "DRISHTI_NEO4J_URI": "", "DRISHTI_S3_ENDPOINT_URL": "", **(env_extra or {})}
    r = subprocess.run([sys.executable, "-c", FINGERPRINT], cwd=REPO, env=env, capture_output=True, text=True, timeout=900)
    line = next((l for l in r.stdout.splitlines() if l.startswith("FINGERPRINT=")), None)
    if r.returncode != 0 or line is None:
        raise RuntimeError(f"fingerprint failed (exit {r.returncode}): {r.stderr[-2000:]}")
    return json.loads(line.split("=", 1)[1])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True, type=Path)
    ap.add_argument("--storage", required=True, type=Path)
    ap.add_argument("--work", required=True, type=Path)
    ap.add_argument("--wrong-key-check", action="store_true", help="also show the audit trail fails to verify under a different key")
    a = ap.parse_args()
    db, storage, work = a.db.resolve(), a.storage.resolve(), a.work.resolve()
    if work.exists() and any(work.iterdir()):
        print(f"--work {work} must be empty or absent", file=sys.stderr)
        return 2
    if work == storage or storage in work.parents:
        print("--work must not be inside the source storage root", file=sys.stderr)
        return 2

    report: dict = {"source": {"db": str(db), "storage": str(storage)}, "steps": {}}
    manifest = backup(db, storage, work / "backup")
    report["steps"]["backup"] = {"files": len(manifest), "bytes": sum((work / "backup" / k).stat().st_size for k in manifest)}
    bad = verify_manifest(work / "backup")
    report["steps"]["manifest_verify"] = {"ok": not bad, "problems": bad}
    rdb, rstorage = restore(work / "backup", work / "restore")
    report["steps"]["restore"] = {"db": str(rdb), "storage": str(rstorage)}

    src_fp = fingerprint(db, storage)
    dst_fp = fingerprint(rdb, rstorage)
    problems = []
    if src_fp["tables"] != dst_fp["tables"]:
        problems.append({"tables_differ": {t: (src_fp["tables"].get(t), dst_fp["tables"].get(t)) for t in set(src_fp["tables"]) | set(dst_fp["tables"]) if src_fp["tables"].get(t) != dst_fp["tables"].get(t)}})
    not_match = {k: v for k, v in dst_fp["evidence"].items() if v != "MATCH"}
    if not_match:
        problems.append({"evidence_not_matching_after_restore": not_match})
    if dst_fp["audit"]["bad"]:
        problems.append({"audit_hmac_failures": dst_fp["audit"]["bad"][:20], "count": len(dst_fp["audit"]["bad"])})
    if src_fp["graphs"] != dst_fp["graphs"]:
        problems.append({"graph_rebuild_differs": True})
    report["verification"] = {
        "tables": dst_fp["tables"], "evidence_total": len(dst_fp["evidence"]),
        "evidence_match": sum(1 for v in dst_fp["evidence"].values() if v == "MATCH"),
        "audit_events": dst_fp["audit"]["total"], "audit_hmac_ok": dst_fp["audit"]["total"] - len(dst_fp["audit"]["bad"]),
        "graphs": dst_fp["graphs"], "source_evidence_not_matching": {k: v for k, v in src_fp["evidence"].items() if v != "MATCH"},
    }
    if a.wrong_key_check:
        wrong = fingerprint(rdb, rstorage, {"DRISHTI_SECRET_KEY": "x" * 64, "DRISHTI_AUDIT_KEYS": ""})
        report["wrong_key_check"] = {"audit_events": wrong["audit"]["total"], "hmac_failures": len(wrong["audit"]["bad"])}
    report["problems"] = problems
    report["result"] = "PASS" if not problems and not bad else "FAIL"
    (work / "report.json").write_text(json.dumps(report, indent=1, sort_keys=True))
    print(json.dumps({k: report[k] for k in ("result", "problems")} | {"verification": report["verification"]} | ({"wrong_key_check": report["wrong_key_check"]} if a.wrong_key_check else {}), indent=1))
    return 0 if report["result"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
