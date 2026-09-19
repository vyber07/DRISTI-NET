"""DRISHTI-NET Kafka evidence-processing worker.

Consumes from the `drishti.evidence.jobs` topic and runs the same pipeline stages
(SCAN → EXTRACT → RESOLVE) that the API calls directly in the dev/test mode.

This worker is an architecture target: it separates heavy processing from the API
request path.  The existing Job row in PostgreSQL is the idempotency/status source
of truth — the worker checks it before processing and updates it during each stage.

Usage (run separately from the API):
    DRISHTI_KAFKA_BOOTSTRAP_SERVERS=localhost:9092 python3 -m workers.worker

Environment variables (all prefixed DRISHTI_):
    KAFKA_BOOTSTRAP_SERVERS   Required when running this worker
    DATABASE_URL              PostgreSQL / SQLite connection string
    Other DRISHTI_* vars      Same as the API (storage, scanner, etc.)

The worker exits cleanly on SIGINT/SIGTERM.  Restart policy should be handled by the
process supervisor (Docker Compose restart:unless-stopped, systemd, or Kubernetes).
"""
from __future__ import annotations

import json
import logging
import os
import signal
import sys
from typing import Optional

# ── Add project root to path when run as `python3 -m workers.worker` ─────────
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("drishti.worker")

TOPIC = "drishti.evidence.jobs"
GROUP_ID = "drishti-evidence-processor"
_running = True


def _handle_signal(sig, _frame):
    global _running
    logger.info("Signal %s received, shutting down worker", sig)
    _running = False


signal.signal(signal.SIGINT, _handle_signal)
signal.signal(signal.SIGTERM, _handle_signal)


def _process_message(msg_value: dict) -> None:
    """Run the pipeline for one evidence job message.  Idempotent via Job table."""
    from apps.api.app.db import SessionLocal
    from apps.api.app.services import pipeline

    evidence_id: str = msg_value.get("evidence_id", "")
    trace_id: str = msg_value.get("trace_id", "WORKER")
    actor_id: Optional[str] = msg_value.get("actor_id")

    if not evidence_id:
        logger.warning("Worker received message with no evidence_id: %s", msg_value)
        return

    db = SessionLocal()
    try:
        ev = pipeline.process_evidence(db, evidence_id, trace_id, actor_id)
        logger.info("Worker processed %s → status=%s", evidence_id, ev.status)
    except Exception as exc:
        logger.error("Worker pipeline error for %s: %s", evidence_id, exc, exc_info=True)
    finally:
        db.close()


def run_worker() -> None:
    """Main loop: consume from Kafka and process messages."""
    bootstrap = os.environ.get("DRISHTI_KAFKA_BOOTSTRAP_SERVERS", "")
    if not bootstrap:
        logger.error("DRISHTI_KAFKA_BOOTSTRAP_SERVERS is not set. Worker cannot start.")
        sys.exit(1)

    try:
        from kafka import KafkaConsumer
    except ImportError:
        logger.error("kafka-python is not installed. Install it to run the worker.")
        sys.exit(1)

    consumer = KafkaConsumer(
        TOPIC,
        bootstrap_servers=bootstrap.split(","),
        group_id=GROUP_ID,
        value_deserializer=lambda v: json.loads(v.decode()),
        auto_offset_reset="earliest",
        enable_auto_commit=False,
        consumer_timeout_ms=1000,
    )
    logger.info("Worker listening on topic=%s group=%s bootstrap=%s", TOPIC, GROUP_ID, bootstrap)

    while _running:
        try:
            batch = consumer.poll(timeout_ms=1000)
            for tp, messages in batch.items():
                for msg in messages:
                    _process_message(msg.value)
                consumer.commit()
        except Exception as exc:
            logger.error("Worker consumer error: %s", exc, exc_info=True)

    consumer.close()
    logger.info("Worker shut down cleanly.")


if __name__ == "__main__":
    run_worker()
