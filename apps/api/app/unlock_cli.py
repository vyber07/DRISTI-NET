"""Operator recovery: clear login locks for one account from the command line.

Use this when no administrator can sign in (for example, the only ADMIN account is locked). It is the
break-glass path; the normal path is POST /api/v1/users/{user_id}/unlock by another administrator.

Run it inside the API container so it shares the running API's Redis:

    docker compose exec api python -m apps.api.app.unlock_cli <username>

It writes an audit row (action USER_UNLOCK, actor "operator-cli"). If Redis is not configured or is
unreachable, the counters live in the API process's memory: this command then has no effect on them, so
restart the API container to clear its in-process fallback state.
"""
from __future__ import annotations

import sys
import uuid

from .db import SessionLocal
from .models import User
from .services import ratelimit
from .services.audit import record_audit


def main(argv: list[str]) -> int:
    if len(argv) != 1 or not argv[0].strip():
        print("usage: python -m apps.api.app.unlock_cli <username>", file=sys.stderr)
        return 2
    username = argv[0].strip()
    db = SessionLocal()
    try:
        target = db.query(User).filter_by(username=username).first()
        if target is None:
            print(f"no such user: {username}", file=sys.stderr)
            return 1
        before = ratelimit.account_status(target.username, target.role)
        ratelimit.unlock_account(target.username)
        record_audit(db, f"operator-{uuid.uuid4().hex[:12]}", None, "USER_UNLOCK", "USER", target.user_id,
                     detail={"username": target.username, "was_locked": before["locked"], "actor": "operator-cli"})
        db.commit()
        print(f"unlocked {target.username} (was_locked={before['locked']}); audit recorded")
        if ratelimit.degraded() or not ratelimit.config.REDIS_URL:
            print("warning: no shared Redis reachable from this process; restart the API to clear its counters",
                  file=sys.stderr)
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
