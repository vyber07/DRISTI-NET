// Neo4j constraints for the graph projection. Applied by services/neo4j_store.apply_constraints() on
// startup whenever DRISHTI_NEO4J_URI is set (see docker-compose.yml's `neo4j` service).
CREATE CONSTRAINT entity_id IF NOT EXISTS FOR (n:Entity) REQUIRE n.entity_id IS UNIQUE;
CREATE CONSTRAINT claim_id  IF NOT EXISTS FOR ()-[r:REL]-() REQUIRE r.claim_id IS UNIQUE;
// One marker node per case: holds the fingerprint of the projection last written, and is the lock every writer of
// that case takes first, so concurrent writers wait in turn instead of deadlocking on Entity nodes (P1.4).
CREATE CONSTRAINT projection_case IF NOT EXISTS FOR (p:Projection) REQUIRE p.case_id IS UNIQUE;
CREATE INDEX entity_kind IF NOT EXISTS FOR (n:Entity) ON (n.kind);
CREATE INDEX rel_type    IF NOT EXISTS FOR ()-[r:REL]-() ON (r.rel_type, r.observed_time);
