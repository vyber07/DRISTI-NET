"""Kafka event bus integration — architecture target.

Publishes evidence job events to the `drishti.evidence.jobs` topic so a separate
worker process can consume them asynchronously (decoupling the API request path from
heavy processing).

The API defaults to direct in-process execution (ADR-004) and only switches to Kafka
when DRISHTI_KAFKA_BOOTSTRAP_SERVERS is set.  The existing Job row remains the
idempotency / status source of truth regardless of which path is used.

Topic: drishti.evidence.jobs
Message key: evidence_id
Message value: JSON {"evidence_id": str, "case_id": str, "trace_id": str, "actor_id": str|null}

This module is import-guarded: kafka-python is NOT in requirements.txt.  When absent,
publish() returns False and the caller falls through to direct in-process execution.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Optional

logger = logging.getLogger("drishti.kafka")

TOPIC = "drishti.evidence.jobs"
_BOOTSTRAP = os.environ.get("DRISHTI_KAFKA_BOOTSTRAP_SERVERS", "")

_producer: Optional[object] = None


def _get_producer():
    """Import-guarded KafkaProducer.  Raises ImportError if kafka-python absent."""
    global _producer
    if _producer is None:
        from kafka import KafkaProducer
        _producer = KafkaProducer(
            bootstrap_servers=_BOOTSTRAP.split(","),
            value_serializer=lambda v: json.dumps(v).encode(),
            key_serializer=lambda k: k.encode() if k else None,
            acks="all",
            retries=3,
        )
        logger.info("Kafka producer connected to %s", _BOOTSTRAP)
    return _producer


def kafka_enabled() -> bool:
    """Return True only when both the library is installed and servers are configured."""
    if not _BOOTSTRAP:
        return False
    try:
        import kafka  # noqa: F401
        return True
    except ImportError:
        return False


def publish(
    evidence_id: str,
    case_id: str,
    trace_id: str,
    actor_id: Optional[str],
) -> bool:
    """Publish an evidence-processing event to Kafka.

    Returns True on success, False when Kafka is not configured or unavailable.
    The caller must fall back to direct execution on False.
    """
    if not kafka_enabled():
        return False
    try:
        producer = _get_producer()
        payload = {
            "evidence_id": evidence_id,
            "case_id": case_id,
            "trace_id": trace_id,
            "actor_id": actor_id,
        }
        future = producer.send(TOPIC, key=evidence_id, value=payload)
        producer.flush(timeout=5)
        future.result(timeout=5)
        logger.debug("Published job for %s to %s", evidence_id, TOPIC)
        return True
    except Exception as exc:
        logger.warning("Kafka publish failed for %s: %s — falling back to direct execution", evidence_id, exc)
        return False
