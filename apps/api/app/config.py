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
SECRET_KEY = _env("SECRET_KEY", "change-me-demo-only-minimum-32-chars-for-dev-jwt")

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
# DEF-098: a RUNNING job untouched for longer than this is treated as abandoned (its process died) and may be
# reclaimed. Must exceed the slowest legitimate stage (scan timeout, large extraction).
JOB_LEASE_S = int(_env("JOB_LEASE_S", "900"))
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
# Rate limiting / brute-force protection (services/ratelimit.py). Redis, when configured, holds the shared
# counters; if Redis is unreachable the counters fall back to per-process memory (never to "no limit").
#
# Account type = role (models.ROLES). Failed-login ceiling per *username*, by role: (max failures, window s).
# Unknown usernames use the "DEFAULT" policy so probing a name gets no different treatment from a real one.
LOGIN_THROTTLE_MAX_ATTEMPTS = int(_env("LOGIN_THROTTLE_MAX_ATTEMPTS", "5"))
LOGIN_THROTTLE_WINDOW_S = int(_env("LOGIN_THROTTLE_WINDOW_S", str(15 * 60)))
LOGIN_THROTTLE_POLICY_BY_ROLE: dict[str, tuple[int, int]] = {
    "DEFAULT": (LOGIN_THROTTLE_MAX_ATTEMPTS, LOGIN_THROTTLE_WINDOW_S),
    # Privileged accounts are the most valuable brute-force target: fewer guesses, longer lockout.
    "ADMIN": (3, 30 * 60),
    "AUDITOR": (3, 30 * 60),
}
# Failed logins per client IP across ALL usernames (defeats password spraying, which rotates usernames
# to stay under the per-username ceiling). Shared-NAT offices hit this together; tune via env if needed.
LOGIN_IP_MAX_FAILURES = int(_env("LOGIN_IP_MAX_FAILURES", "30"))
LOGIN_IP_WINDOW_S = int(_env("LOGIN_IP_WINDOW_S", str(15 * 60)))
# Account lockout across sources. An account is locked only when failures come from this many DISTINCT
# source IPs within LOGIN_ACCOUNT_WINDOW_S. A single source can never lock an account for other users,
# however many guesses it makes -- that is the anti-lockout-DoS property. Lock duration escalates per repeat:
# base * 2^(level-1), capped at max. The escalation level is remembered for LOGIN_ACCOUNT_LEVEL_TTL_S.
LOGIN_ACCOUNT_SOURCES_BY_ROLE: dict[str, int] = {"DEFAULT": 10, "ADMIN": 5, "AUDITOR": 5}
LOGIN_ACCOUNT_WINDOW_S = int(_env("LOGIN_ACCOUNT_WINDOW_S", str(60 * 60)))
LOGIN_ACCOUNT_LOCK_BASE_S = int(_env("LOGIN_ACCOUNT_LOCK_BASE_S", str(15 * 60)))
LOGIN_ACCOUNT_LOCK_MAX_S = int(_env("LOGIN_ACCOUNT_LOCK_MAX_S", str(4 * 3600)))
# Input bounds on the login body. Oversized values are rejected before any hashing work.
LOGIN_USERNAME_MAX_LEN = 200
LOGIN_PASSWORD_MAX_LEN = 1024
# General API request ceilings (requests per 60 s window) -- the DoS layer.
# API_IP_RATE_PER_MIN: every /api/v1 request from one client IP, including unauthenticated ones.
# API_USER_RATE_PER_MIN_BY_ROLE: authenticated requests per user, by role (checked after the token is verified).
API_IP_RATE_PER_MIN = int(_env("API_IP_RATE_PER_MIN", "600"))
API_USER_RATE_PER_MIN_BY_ROLE: dict[str, int] = {"DEFAULT": 300, "ADMIN": 600}
# Proxies whose X-Forwarded-For header is trusted to report the real client IP (the nginx front end).
# Default covers loopback and Docker bridge networks (172.16.0.0/12). Any other peer is its own client IP,
# so a direct caller cannot spoof an address to dodge the limits.
TRUSTED_PROXIES = [p.strip() for p in _env("TRUSTED_PROXIES", "127.0.0.1/32,::1/128,172.16.0.0/12").split(",") if p.strip()]
SYNTHETIC_DIR = REPO_ROOT / "data" / "synthetic" / "golden"
# DRISHTI_WEB_DIST lets a test server serve a separate build, so building for tests never replaces the files a
# running deployment serves from apps/web/dist.
WEB_DIST = Path(_env("WEB_DIST", str(REPO_ROOT / "apps" / "web" / "dist")))

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
    # DEF-057: strength applies to every deployment, including the SQLite demo (the default dev key is 51 chars,
    # so local development is unaffected). Previously `DRISHTI_SECRET_KEY=x` was accepted.
    if len(SECRET_KEY) < 32:
        raise ValueError("DRISHTI_SECRET_KEY must be at least 32 characters (HMAC-SHA256 JWT and audit signing key)")
    if DATABASE_URL.startswith("sqlite"):
        return
    if SECRET_KEY.startswith("change-me-demo-only"):
        raise ValueError("DRISHTI_SECRET_KEY must be changed from the default in production")
    if S3_ENDPOINT_URL and S3_SECRET_KEY == "drishti-minio-demo":
        raise ValueError("DRISHTI_S3_SECRET_KEY must be changed from the default in production")
    if NEO4J_URI and NEO4J_PASSWORD == "drishti-neo4j-demo":
        raise ValueError("DRISHTI_NEO4J_PASSWORD must be changed from the default in production")
    if SCANNER_MODE == "testgate" and not _env_bool("ALLOW_TEST_SCANNER"):
        raise ValueError("SCANNER_MODE=testgate is not permitted in production. Set DRISHTI_ALLOW_TEST_SCANNER=1 if this is a test environment using PostgreSQL.")

validate_production_secrets()
