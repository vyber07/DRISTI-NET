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


def _process_message(msg_value: dict) -> bool:
    """Run the pipeline for one evidence job message.
    Returns True if the message should be committed (success or permanent failure).
    Returns False if it's a transient failure (e.g., DB lock timeout) to trigger a retry.
    """
    from apps.api.app.db import SessionLocal
    from apps.api.app.services import pipeline
    import sqlalchemy.exc

    evidence_id: str = msg_value.get("evidence_id", "")
    trace_id: str = msg_value.get("trace_id", "WORKER")
    actor_id: Optional[str] = msg_value.get("actor_id")

    if not evidence_id:
        logger.warning("Worker received message with no evidence_id: %s", msg_value)
        return True  # Permanent failure, don't retry

    db = SessionLocal()
    try:
        ev = pipeline.process_evidence(db, evidence_id, trace_id, actor_id, async_allowed=False)
        logger.info("Worker processed %s → status=%s", evidence_id, ev.status)
        return True
    except sqlalchemy.exc.OperationalError as exc:
        logger.warning("Worker transient DB error for %s: %s", evidence_id, exc)
        return False
    except ValueError as exc:
        if "already running" in str(exc):
            logger.warning("Worker concurrent execution skipped for %s: %s", evidence_id, exc)
            return False  # Could be transient if other worker dies, retry later
        elif "already succeeded" in str(exc):
            logger.info("Worker skipped duplicate successful job for %s", evidence_id)
            return True
        logger.error("Worker pipeline logic error for %s: %s", evidence_id, exc, exc_info=True)
        return True  # Permanent logic error
    except Exception as exc:
        logger.error("Worker permanent pipeline error for %s: %s", evidence_id, exc, exc_info=True)
        return True  # Other errors treated as permanent for now to prevent poison pills
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
                batch_success = True
                for msg in messages:
                    success = _process_message(msg.value)
                    if not success:
                        batch_success = False
                        break
                if batch_success:
                    consumer.commit()
                else:
                    # Seek back to the first offset of the failed partition to retry later
                    consumer.seek(tp, messages[0].offset)
        except Exception as exc:
            logger.error("Worker consumer error: %s", exc, exc_info=True)

    consumer.close()
    logger.info("Worker shut down cleanly.")


if __name__ == "__main__":
    run_worker()
