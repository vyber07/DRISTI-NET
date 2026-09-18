"""Runtime settings. Every value can be overridden with a DRISHTI_* environment variable."""
from __future__ import annotations

import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]


def _env(name: str, default: str) -> str:
    return os.environ.get(f"DRISHTI_{name}", default)

def _env_bool(name: str, default: bool = False) -> bool:
    val = os.environ.get(f"DRISHTI_{name}")
    if val is None:
        return default
    return val.lower() in {"1", "true", "yes"}


STORAGE_ROOT = Path(_env("STORAGE_ROOT", str(REPO_ROOT / "storage"))).resolve()
# S3/MinIO object storage (TASK_BOARD.md Phase 2). Empty endpoint = local filesystem under STORAGE_ROOT
# (default, zero-install, same "empty = not configured" pattern as NEO4J_URI/REDIS_URL). Set
# DRISHTI_S3_ENDPOINT_URL to switch evidence bytes to a real S3-compatible store.
S3_ENDPOINT_URL = _env("S3_ENDPOINT_URL", "")
S3_BUCKET = _env("S3_BUCKET", "drishti")
S3_ACCESS_KEY = _env("S3_ACCESS_KEY", "drishti")
S3_SECRET_KEY = _env("S3_SECRET_KEY", "drishti-minio-demo")
S3_REGION = _env("S3_REGION", "us-east-1")
DATABASE_URL = _env("DATABASE_URL", f"sqlite:///{STORAGE_ROOT / 'drishti.db'}")
SECRET_KEY = _env("SECRET_KEY", "change-me-demo-only")

import json
# Key registry for HMAC rotation. Maps key_id -> secret string
_raw_audit_keys = _env("AUDIT_KEYS", "")
AUDIT_KEYS = json.loads(_raw_audit_keys) if _raw_audit_keys else {"k1-2026": SECRET_KEY}
CURRENT_AUDIT_KEY_ID = _env("CURRENT_AUDIT_KEY_ID", "k1-2026")
if CURRENT_AUDIT_KEY_ID not in AUDIT_KEYS:
    raise ValueError(f"CURRENT_AUDIT_KEY_ID {CURRENT_AUDIT_KEY_ID} is not present in AUDIT_KEYS")
SCANNER_MODE = _env("SCANNER_MODE", "auto")  # auto | clamav | testgate | unavailable
CLAMAV_HOST = _env("CLAMAV_HOST", "clamav")
CLAMAV_PORT = int(_env("CLAMAV_PORT", "3310"))
CLAMAV_DB = _env("CLAMAV_DB", "")  # optional --database path for clamscan (user-space installs)
SCAN_TIMEOUT_S = int(_env("SCAN_TIMEOUT_S", "120"))
MAX_UPLOAD_MB = int(_env("MAX_UPLOAD_MB", "25"))
GRAPH_MAX_HOPS = int(_env("GRAPH_MAX_HOPS", "2"))
GRAPH_MAX_NODES = int(_env("GRAPH_MAX_NODES", "150"))
SUPERNODE_DEGREE = int(_env("SUPERNODE_DEGREE", "12"))
# Neo4j: the analytical graph projection (docs/context.md §7/§10/§17). Empty URI = not configured, the
# fast local/test loop falls back to an in-process build with no external service (same pattern as
# DATABASE_URL defaulting to SQLite). Set DRISHTI_NEO4J_URI to project real claims into a real Neo4j
# instance via parameterized Cypher — see services/graph.py and docker-compose.yml's `neo4j` service.
NEO4J_URI = _env("NEO4J_URI", "")
NEO4J_USER = _env("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = _env("NEO4J_PASSWORD", "")
# Bounds both the initial connection attempt and the driver's own retry backoff (services/neo4j_store.py)
# -- without this, an unreachable Neo4j left requests hanging ~60s instead of failing fast (found by
# failure-injection testing, TASK_BOARD.md Phase 8).
NEO4J_CONNECTION_TIMEOUT_S = int(_env("NEO4J_CONNECTION_TIMEOUT_S", "5"))
# Bounds a single Cypher query's own server-side execution time once connected -- distinct from the
# connection timeout above, which only covers reaching the server. Without this, a pathological or
# unexpectedly large bounded-graph query could run indefinitely on the server even though the client
# connected fine. Passed as neo4j.Query(text, timeout=...), which Neo4j enforces itself
# (Neo.ClientError.Transaction.TransactionTimedOutClientConfiguration), live-verified in
# test_neo4j_live.py against a real running Neo4j instance, not assumed from the driver docs.
NEO4J_QUERY_TIMEOUT_S = float(_env("NEO4J_QUERY_TIMEOUT_S", "10"))
# Redis: ephemeral login-throttle counters only (TASK_BOARD.md Phase 4). Empty = feature disabled,
# same "empty = not configured" pattern as NEO4J_URI. Never a source of truth for anything Postgres/
# SQLite already owns -- job status, claims, reviews etc. stay in the relational DB.
REDIS_URL = _env("REDIS_URL", "")
LOGIN_THROTTLE_MAX_ATTEMPTS = int(_env("LOGIN_THROTTLE_MAX_ATTEMPTS", "5"))
LOGIN_THROTTLE_WINDOW_S = int(_env("LOGIN_THROTTLE_WINDOW_S", str(15 * 60)))
SYNTHETIC_DIR = REPO_ROOT / "data" / "synthetic" / "golden"
WEB_DIST = REPO_ROOT / "apps" / "web" / "dist"

ALLOWED_EXTENSIONS = {".csv", ".json", ".pdf", ".txt", ".zip"}
# Extensions accepted *inside* a .zip archive -- deliberately excludes ".zip" itself (no nested
# archives; TASK_BOARD.md archive-controls item, task directive Phase 8 "archive controls").
ARCHIVE_MEMBER_EXTENSIONS = {".csv", ".json", ".pdf", ".txt"}
# Parser resource caps (TASK_BOARD.md Phase 9): bound the size of a single file's structured content
# before extraction touches it, so one pathological upload can't tie up the extractor indefinitely.
# Enforced in validate_upload() -- a clean 422 at upload time, before the file is ever accepted --
# the same place the pre-existing CSV row cap already lived. A wall-clock/CPU timeout around the
# extractor itself was considered and rejected: signal.alarm only works reliably in a process's main
# thread and this API runs extraction inline in the request-handling thread, so an alarm-based timeout
# would either do nothing (wrong thread) or risk interrupting unrelated code -- an input-size cap gives
# a portable, deterministic bound on a single file's cost without that risk (directive §64: no
# unjustified mechanism). A real queueing/worker architecture (Architecture target, docs/architecture.md)
# is the correct place for a true CPU/wall-clock timeout, not a signal hack bolted onto an inline call.
CSV_MAX_ROWS = int(_env("CSV_MAX_ROWS", "50000"))
JSON_MAX_RECORDS = int(_env("JSON_MAX_RECORDS", "20000"))
PDF_MAX_PAGES = int(_env("PDF_MAX_PAGES", "500"))
# Archive (.zip) controls -- decompression-bomb, path-traversal and resource-exhaustion protection,
# checked against the central directory (cheap metadata) *before* any member is decompressed, so a
# hostile archive is rejected at validation time, never partially unpacked. Fail-closed: any archive
# whose bounds cannot be established (corrupt central directory, unreadable member info) is rejected
# rather than assumed safe. See TASK_BOARD.md archive-controls item / directive §8 "malware / file
# security".
ARCHIVE_MAX_MEMBERS = int(_env("ARCHIVE_MAX_MEMBERS", "200"))
ARCHIVE_MAX_MEMBER_UNCOMPRESSED_MB = int(_env("ARCHIVE_MAX_MEMBER_UNCOMPRESSED_MB", "25"))
ARCHIVE_MAX_TOTAL_UNCOMPRESSED_MB = int(_env("ARCHIVE_MAX_TOTAL_UNCOMPRESSED_MB", "100"))
ARCHIVE_MAX_COMPRESSION_RATIO = int(_env("ARCHIVE_MAX_COMPRESSION_RATIO", "100"))

def validate_production_secrets():
    if DATABASE_URL.startswith("sqlite"):
        return
    if SECRET_KEY == "change-me-demo-only":
        raise ValueError("DRISHTI_SECRET_KEY must be changed from the default in production")
    if S3_ENDPOINT_URL and S3_SECRET_KEY == "drishti-minio-demo":
        raise ValueError("DRISHTI_S3_SECRET_KEY must be changed from the default in production")
    if NEO4J_URI and NEO4J_PASSWORD == "drishti-neo4j-demo":
        raise ValueError("DRISHTI_NEO4J_PASSWORD must be changed from the default in production")
    if SCANNER_MODE == "testgate" and not _env_bool("ALLOW_TEST_SCANNER"):
        raise ValueError("SCANNER_MODE=testgate is not permitted in production. Set DRISHTI_ALLOW_TEST_SCANNER=1 if this is a test environment using PostgreSQL.")

validate_production_secrets()
