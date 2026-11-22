"""End-to-end check of the audit and rate-limit branch against an ISOLATED instance (127.0.0.1:8011, disposable Postgres).

Prints one line per check: PASS or FAIL, with the observed value. Never touches the live stack.
"""
import json
import os
import sys

import httpx

import random

BASE = os.environ.get("DRISTI_E2E_BASE", "http://127.0.0.1:8011/api/v1")
# Guard: this script creates logins, failed attempts and session revocations. It must never run against the live demo.
if any(marker in BASE for marker in ("nip.io", "65.0.102.181")):
    sys.exit("refusing to run against the live demo host; point DRISTI_E2E_BASE at an isolated instance")
FRESH_IP = f"10.{random.randint(1, 250)}.{random.randint(0, 255)}.{random.randint(1, 254)}"
results = []


def check(name, ok, observed=""):
    ok = bool(ok)
    results.append(ok)
    print(("PASS " if ok else "FAIL ") + name + (f"  [{observed}]" if observed else ""))


def login(username, password, headers=None):
    return httpx.post(f"{BASE}/auth/login", json={"username": username, "password": password}, headers=headers or {}, timeout=30)


with httpx.Client(timeout=30) as c:
    check("health", c.get(f"{BASE}/health").status_code == 200)

    # --- authentication and login record ---------------------------------------------------------
    r = login("auditor", "auditor-demo", {"X-Forwarded-For": "198.51.100.9", "X-Trace-Id": "TRC-forged-e2e",
                                          "User-Agent": "e2e-check/1.0\tFORGED LINE"})
    check("auditor login succeeds", r.status_code == 200, str(r.status_code))
    aud = {"Authorization": f"Bearer {r.json()['token']}"}
    check("spoofed X-Trace-Id not echoed", r.headers.get("X-Trace-Id") != "TRC-forged-e2e" and r.headers.get("X-Trace-Id", "").startswith("REQ-"),
          r.headers.get("X-Trace-Id", ""))

    rows = c.get(f"{BASE}/audit", params={"action": "LOGIN", "limit": 5}, headers=aud).json()
    mine = [x for x in rows if x["actor_username"] == "auditor" and x["outcome"] == "OK"]
    check("LOGIN row present with actor username", bool(mine))
    if mine:
        row = mine[0]
        check("client IP from trusted proxy chain (not the socket peer)", row["ip_address"] == "198.51.100.9", row["ip_address"])
        check("user agent sanitised (no newline)", row["user_agent"] and "\t" not in row["user_agent"] and row["user_agent"].startswith("e2e-check/1.0 FORGED"), repr(row["user_agent"]))
        check("request id equals trace id", row["request_id"] == row["trace_id"] and row["request_id"].startswith("REQ-"))
        check("UTC and local time present", row["occurred_at_utc"].endswith("Z") and row["occurred_at_local"].endswith("+05:30"),
              f'{row["occurred_at_utc"]} / {row["occurred_at_local"]}')
        check("session id and office recorded", bool(row["session_id"]) and row["office_id"] == "OFF-DDA", row["office_id"])

    # --- failed login: reason, no secret --------------------------------------------------------
    secret = "E2E-Wrong-Secret-4471"
    bad = login("investigator", secret, {"X-Forwarded-For": "198.51.100.44"})
    check("failed login is 401 with generic message", bad.status_code == 401 and bad.json()["detail"] == "Invalid credentials")
    denied = [x for x in c.get(f"{BASE}/audit", params={"action": "LOGIN", "outcome": "DENIED", "limit": 20}, headers=aud).json()
              if x["ip_address"] == "198.51.100.44"]
    check("failed login audited with reason and IP", bool(denied) and denied[0]["failure_reason"] == "bad credentials")
    check("password never appears in any audit row",
          secret not in json.dumps(c.get(f"{BASE}/audit", params={"limit": 1000}, headers=aud).json()))

    # --- access control ---------------------------------------------------------------------------
    inv = login("investigator", "investigator-demo").json()["token"]
    inv_h = {"Authorization": f"Bearer {inv}"}
    check("investigator cannot read audit log", c.get(f"{BASE}/audit", headers=inv_h).status_code == 403)
    check("investigator cannot export audit", c.get(f"{BASE}/audit/export", headers=inv_h).status_code == 403)
    case_rows = c.get(f"{BASE}/cases/CASE-0001/audit", headers=inv_h)
    # This isolated database has no evidence ingested, so CASE-0001's trail may be empty: the check is that the
    # response is allowed and carries no network fields, whatever rows exist.
    trail = case_rows.json() if case_rows.status_code == 200 else []
    check("assigned investigator sees case trail without network fields",
          case_rows.status_code == 200 and all("ip_address" not in x and "session_id" not in x for x in trail),
          f"{case_rows.status_code}, {len(trail)} rows")

    # --- searches are fingerprints --------------------------------------------------------------
    secret_q = "E2E Confidential Name"
    c.get(f"{BASE}/cases", params={"q": secret_q}, headers=inv_h)
    rows_all = c.get(f"{BASE}/audit", params={"limit": 1000}, headers=aud).json()
    check("search text never stored", secret_q not in json.dumps(rows_all))

    # --- logout revokes the session -------------------------------------------------------------
    lo = login("analyst", "analyst-demo").json()["token"]
    lo_h = {"Authorization": f"Bearer {lo}"}
    check("analyst can call /auth/me before logout", c.get(f"{BASE}/auth/me", headers=lo_h).status_code == 200)
    check("logout succeeds", c.post(f"{BASE}/auth/logout", headers=lo_h).status_code == 200)
    after = c.get(f"{BASE}/auth/me", headers=lo_h)
    check("token rejected after logout", after.status_code == 401)
    rej = [x for x in c.get(f"{BASE}/audit", params={"action": "AUTH_TOKEN_REJECTED", "limit": 5}, headers=aud).json()]
    check("rejection audited with reason", bool(rej) and rej[0]["failure_reason"] == "session revoked", str(rej[:1]))

    # --- integrity: verify, digest, export ------------------------------------------------------
    v = c.get(f"{BASE}/audit/verify", headers=aud).json()
    check("all signatures verify", v["invalid"] == 0 and v["valid"] > 0, json.dumps({k: v[k] for k in ("total", "valid", "invalid", "unsigned")}))
    d = c.get(f"{BASE}/audit/digest", params={"day": "2026-11-12"}, headers=aud)
    check("daily digest endpoint answers", d.status_code == 200 and len(d.json()["sha256"]) == 64, str(d.status_code))
    ex = c.get(f"{BASE}/audit/export", params={"format": "csv", "limit": 20}, headers=aud)
    header = ex.text.splitlines()[0] if ex.text else ""
    check("CSV export has UTC, local, network and office columns",
          all(col in header for col in ("occurred_at_utc", "occurred_at_local", "ip_address", "session_id", "office_id")), header[:80])

    # --- rate limit shared through Redis ----------------------------------------------------------
    codes = [login("reviewer", "wrong-rl-check", {"X-Forwarded-For": FRESH_IP}).status_code for _ in range(6)]
    check("pair lockout after 5 failures (Redis-backed)", codes[:5] == [401] * 5 and codes[5] == 429, str(codes))

print()
print(f"{sum(results)} passed, {len(results) - sum(results)} failed")
sys.exit(0 if all(results) else 1)
