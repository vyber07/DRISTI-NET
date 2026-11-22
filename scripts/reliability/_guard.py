"""Refuse to run the reliability scripts against anything but this machine.

They log in with the seeded synthetic passwords, reset a user's password, ingest evidence and generate heavy load.
They are for disposable local instances only (docs/TROUBLESHOOTING.md, "Reproducing").
"""
import sys
from urllib.parse import urlparse

LOOPBACK = {"127.0.0.1", "localhost", "::1"}


def require_loopback(*urls: str) -> None:
    for url in urls:
        host = urlparse(url).hostname or ""
        if host not in LOOPBACK:
            sys.exit(f"refusing to run against {url!r}: only a disposable local instance (127.0.0.1/localhost) is allowed")
