"""Kafka path (DEF-104), found by running the real Compose stack: kafka-python futures have get(), not result(), so
every publish raised and the API fell back to direct processing although the message HAD been sent -- the worker then
processed the same evidence concurrently and crashed on the duplicate job key. The old tests only covered
"publish returns False"; a MagicMock accepts any method name, which is how this was never caught."""
from unittest.mock import Mock, patch

import pytest

kafka_future = pytest.importorskip("kafka.producer.future")


def test_publish_succeeds_against_the_real_future_interface(monkeypatch):
    from ..services import kafka_bus
    fut = Mock(spec=kafka_future.FutureRecordMetadata)  # only methods the real class has
    fut.get.return_value = object()
    producer = Mock()
    producer.send.return_value = fut
    monkeypatch.setattr(kafka_bus, "_BOOTSTRAP", "kafka:9092")
    monkeypatch.setattr(kafka_bus, "_get_producer", lambda: producer)
    assert kafka_bus.publish("EVD-1", "CASE-1", "TRC-1", None) is True
    fut.get.assert_called_once()
    producer.send.assert_called_once()


def test_worker_treats_a_concurrent_duplicate_job_as_already_handled(monkeypatch, caplog):
    import sqlalchemy.exc
    import workers.worker as worker
    from ..services import pipeline

    def dup(*a, **k):
        raise sqlalchemy.exc.IntegrityError("INSERT INTO jobs ...", {}, Exception('duplicate key value violates unique constraint "jobs_idempotency_key_key"'))
    monkeypatch.setattr(pipeline, "process_evidence", dup)
    with caplog.at_level("WARNING"):
        assert worker._process_message({"evidence_id": "EVD-1", "trace_id": "TRC-1"}) is True  # commit: someone else owns it
    assert not [r for r in caplog.records if r.levelname == "ERROR"], "a concurrent duplicate is not an error"
