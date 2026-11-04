"""Independent before/after check for the SQLite+local -> Postgres+MinIO migration.

    python3 scripts/verify_pg_minio_migration.py <sqlite_db> <storage_root> <pg_url> <minio_endpoint> <minio_secret_key>

Reuses backup_restore_drill.py's fingerprint() unmodified -- the same function already used to
prove a backup restores cleanly (table row counts, every evidence object's SHA-256, every audit
event's HMAC under the real key registry, and a graph-projection snapshot hash per case rebuilt
from the authoritative rows) -- called once against the SQLite/local source and once against
Postgres/MinIO via its env_extra override, then diffed exactly the same way.

Run with the real DRISHTI_SECRET_KEY / DRISHTI_AUDIT_KEYS already exported in this shell (source
.env first) -- fingerprint() inherits them from this process's environment, same as any other use.

Audit HMAC check compares the *set* of failing audit_ids between source and target, not whether
that set is empty: this deployment's history already has pre-existing signature failures from
before key rotation was introduced correctly (legacy hmac-sha256 payloads signed under a since
-changed k1-2026 value), unrelated to this migration and not something a verbatim copy can or
should repair -- resigning old audit rows to force a match would defeat the point of an immutable
audit trail. What matters for migration correctness is that copying introduces no *new* failures.
Exits 0 and prints PASS only if every check agrees under that rule; exits 1 and prints FAIL with
the specific mismatches otherwise.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent
sys.path.insert(0, str(REPO))
from backup_restore_drill import fingerprint  # noqa: E402


def main() -> int:
    if len(sys.argv) != 6:
        print(f"usage: {sys.argv[0]} <sqlite_db> <storage_root> <pg_url> <minio_endpoint> <minio_secret_key>", file=sys.stderr)
        return 2
    sqlite_db, storage_root, pg_url, minio_endpoint, minio_secret_key = (Path(sys.argv[1]), Path(sys.argv[2]), *sys.argv[3:])

    src = fingerprint(sqlite_db, storage_root)
    dst = fingerprint(sqlite_db, storage_root, {
        "DRISHTI_DATABASE_URL": pg_url,
        "DRISHTI_S3_ENDPOINT_URL": minio_endpoint,
        "DRISHTI_S3_BUCKET": "drishti",
        "DRISHTI_S3_ACCESS_KEY": "drishti",
        "DRISHTI_S3_SECRET_KEY": minio_secret_key,
        "DRISHTI_SCANNER_MODE": "unavailable",
        "DRISHTI_NEO4J_URI": "",
    })

    problems = []
    if src["tables"] != dst["tables"]:
        problems.append({"tables_differ": {t: (src["tables"].get(t), dst["tables"].get(t))
                                            for t in set(src["tables"]) | set(dst["tables"]) if src["tables"].get(t) != dst["tables"].get(t)}})
    not_match = {k: v for k, v in dst["evidence"].items() if v != "MATCH"}
    if not_match:
        problems.append({"evidence_not_matching": not_match})
    new_bad = sorted(set(dst["audit"]["bad"]) - set(src["audit"]["bad"]))
    if new_bad:
        problems.append({"audit_hmac_newly_failing": new_bad, "count": len(new_bad)})
    if src["graphs"] != dst["graphs"]:
        problems.append({"graph_rebuild_differs": True, "source": src["graphs"], "target": dst["graphs"]})

    report = {
        "result": "PASS" if not problems else "FAIL",
        "problems": problems,
        "tables": dst["tables"],
        "evidence_total": len(dst["evidence"]), "evidence_match": sum(1 for v in dst["evidence"].values() if v == "MATCH"),
        "audit_events": dst["audit"]["total"], "audit_hmac_ok": dst["audit"]["total"] - len(dst["audit"]["bad"]),
        "audit_hmac_pre_existing_failures": sorted(src["audit"]["bad"]),
        "graphs": dst["graphs"],
    }
    print(json.dumps(report, indent=1, sort_keys=True))
    return 0 if report["result"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
