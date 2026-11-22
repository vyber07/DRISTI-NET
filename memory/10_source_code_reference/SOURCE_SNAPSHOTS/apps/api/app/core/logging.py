"""Structured logging configuration for DRISTI-NET.

Configures the root logger to emit JSON-structured log records in production
(when DRISHTI_LOG_FORMAT=json) and human-readable records in development (default).

Usage:
    from apps.api.app.core.logging import configure_logging
    configure_logging()  # call once at startup, before the first log message
"""
from __future__ import annotations

import json
import logging
import os
import sys
from datetime import datetime, timezone
from typing import Any


class _JsonFormatter(logging.Formatter):
    """Emit one JSON object per log record, suitable for log aggregation."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        # Carry structured extras from logger.xxx(..., extra={...}) calls
        for key in ("trace_id", "actor", "action", "resource", "outcome", "case_id"):
            value = getattr(record, key, None)
            if value is not None:
                payload[key] = value

        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)

        return json.dumps(payload, ensure_ascii=False)


def configure_logging(level: str = "INFO") -> None:
    """Configure root logging for the application.

    Call once at startup. Idempotent if called multiple times with the same parameters.
    """
    log_format = os.environ.get("DRISHTI_LOG_FORMAT", "text").lower()
    log_level_str = os.environ.get("DRISHTI_LOG_LEVEL", level).upper()
    log_level = getattr(logging, log_level_str, logging.INFO)

    root = logging.getLogger()
    if root.handlers:
        return  # already configured

    handler = logging.StreamHandler(sys.stdout)

    if log_format == "json":
        handler.setFormatter(_JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter(
                "%(asctime)s %(levelname)-8s %(name)-30s %(message)s",
                datefmt="%Y-%m-%dT%H:%M:%S",
            )
        )

    root.addHandler(handler)
    root.setLevel(log_level)

    # Quiet noisy third-party loggers
    for noisy in ("uvicorn.access", "sqlalchemy.engine", "neo4j"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
