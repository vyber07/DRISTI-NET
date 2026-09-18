# Workers

In the prototype the SCAN → EXTRACT → RESOLVE stages run in-process (`apps/api/app/services/pipeline.py`), each as a `Job` row
with an idempotency key, attempt counter and trace id. To move a stage behind Kafka/Redpanda, publish the `evidence_id` and call the
same `run_*` function from a consumer — the state machine and audit events do not change.
