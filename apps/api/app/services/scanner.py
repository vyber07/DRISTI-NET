"""Fail-closed malware scan gate.

Modes (DRISHTI_SCANNER_MODE):
  clamav      – connect to ClamAV daemon via TCP (INSTREAM)
  testgate    – documented safe substitute: flags the EICAR test signature; everything else CLEAN
  unavailable – always returns SCANNER_UNAVAILABLE (demonstrates fail-closed behaviour)
  auto        – ClamAV TCP when available; otherwise SCANNER_UNAVAILABLE

Only the literal result "CLEAN" lets a file leave quarantine. Every other outcome keeps it there.
"""
from __future__ import annotations

import socket
import struct
from dataclasses import dataclass
from pathlib import Path

from .. import config

EICAR_SIGNATURE = b"EICAR-STANDARD-ANTIVIRUS-TEST-FILE"


@dataclass
class ScanOutcome:
    result: str      # CLEAN | INFECTED | SCAN_FAILED | SCAN_TIMEOUT | SCANNER_UNAVAILABLE
    engine: str
    detail: str = ""

    @property
    def is_clean(self) -> bool:
        return self.result == "CLEAN"


def _scan_clamav_tcp(path: Path) -> ScanOutcome:
    timeout = config.SCAN_TIMEOUT_S
    try:
        with socket.create_connection((config.CLAMAV_HOST, config.CLAMAV_PORT), timeout=timeout) as s:
            s.sendall(b"zINSTREAM\x00")
            with open(path, "rb") as f:
                while True:
                    chunk = f.read(8192)
                    if not chunk:
                        break
                    s.sendall(struct.pack("!I", len(chunk)))
                    s.sendall(chunk)
            s.sendall(struct.pack("!I", 0))
            result = b""
            while True:
                resp_chunk = s.recv(1024)
                if not resp_chunk:
                    break
                result += resp_chunk
        decoded = result.replace(b"\x00", b"").decode().strip()
        if "OK" in decoded:
            return ScanOutcome("CLEAN", "clamav-tcp", decoded)
        if "FOUND" in decoded:
            return ScanOutcome("INFECTED", "clamav-tcp", decoded)
        return ScanOutcome("SCAN_FAILED", "clamav-tcp", decoded)
    except socket.timeout:
        return ScanOutcome("SCAN_TIMEOUT", "clamav-tcp", f"timeout after {timeout}s")
    except OSError as exc:
        return ScanOutcome("SCANNER_UNAVAILABLE", "clamav-tcp", str(exc))


def _scan_testgate(path: Path) -> ScanOutcome:
    try:
        data = path.read_bytes()
    except OSError as exc:
        return ScanOutcome("SCAN_FAILED", "testgate", str(exc))
    if EICAR_SIGNATURE in data:
        return ScanOutcome("INFECTED", "testgate", "EICAR test signature found")
    return ScanOutcome("CLEAN", "testgate", "no test signature present (testgate is NOT a real antivirus)")


def scan_file(path: Path, mode: str | None = None) -> ScanOutcome:
    mode = mode or config.SCANNER_MODE
    if mode == "unavailable":
        return ScanOutcome("SCANNER_UNAVAILABLE", "none", "scanner disabled by configuration")
    
    if mode == "clamav" or mode == "auto":
        return _scan_clamav_tcp(path)
    
    if mode == "testgate":
        return _scan_testgate(path)
        
    return ScanOutcome("SCAN_FAILED", mode, f"unknown scanner mode {mode}")
