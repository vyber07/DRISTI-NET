"""Fail-closed parsing of clamd INSTREAM replies (DEF-036/037).

A fake clamd answers each connection with a fixed reply so the parser can be tested against replies a real
daemon does not produce on demand. Real clamd 1.4 replies are `stream: OK\\0` and `stream: <signature> FOUND\\0`.
"""
import socket
import threading

import pytest

from .. import config
from ..services import scanner


def _fake_clamd(reply: bytes) -> int:
    srv = socket.socket()
    srv.bind(("127.0.0.1", 0))
    srv.listen(1)

    def serve():
        conn, _ = srv.accept()
        with conn:
            conn.settimeout(5)
            try:
                while True:  # read until the zero-length INSTREAM terminator arrives (or the client stops)
                    chunk = conn.recv(65536)
                    if not chunk or chunk.endswith(b"\x00\x00\x00\x00"):
                        break
            except OSError:
                pass
            conn.sendall(reply)
        srv.close()

    threading.Thread(target=serve, daemon=True).start()
    return srv.getsockname()[1]


@pytest.mark.parametrize("reply, expected", [
    (b"stream: OK\x00", "CLEAN"),                                   # success: the only reply that may clear a file
    (b"stream: Eicar-Test-Signature FOUND\x00", "INFECTED"),
    (b"stream: Win.Trojan.OKbot-1 FOUND\x00", "INFECTED"),          # DEF-036: "OK" inside a signature name
    (b"stream: Doc.Dropper.OK-Agent FOUND\x00", "INFECTED"),
    (b"INSTREAM size limit exceeded. ERROR\x00", "SCAN_FAILED"),
    (b"stream: OK but something else\x00", "SCAN_FAILED"),
    (b"", "SCAN_FAILED"),
    (b"\xff\xfe\xfd garbage", "SCAN_FAILED"),                       # DEF-037: undecodable reply must not raise
])
def test_clamd_reply_parsing_is_fail_closed(tmp_path, monkeypatch, reply, expected):
    sample = tmp_path / "sample.bin"
    sample.write_bytes(b"synthetic test bytes\n")
    monkeypatch.setattr(config, "CLAMAV_HOST", "127.0.0.1")
    monkeypatch.setattr(config, "CLAMAV_PORT", _fake_clamd(reply))
    monkeypatch.setattr(config, "SCAN_TIMEOUT_S", 5)
    outcome = scanner.scan_file(sample, mode="clamav")
    assert outcome.result == expected, (reply, outcome)
    assert outcome.is_clean is (expected == "CLEAN")


def test_unexpected_scanner_exception_is_scan_failed(tmp_path, monkeypatch):
    """Any exception inside the TCP scan (not only socket errors) must become SCAN_FAILED, never propagate."""
    sample = tmp_path / "sample.bin"
    sample.write_bytes(b"x")

    def boom(*a, **k):
        raise RuntimeError("unexpected")
    monkeypatch.setattr(scanner.socket, "create_connection", boom)
    outcome = scanner.scan_file(sample, mode="clamav")
    assert outcome.result == "SCAN_FAILED"
    assert not outcome.is_clean
