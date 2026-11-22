// Neo4j constraints for the graph projection. Applied by services/neo4j_store.apply_constraints() on
// startup whenever DRISHTI_NEO4J_URI is set (see docker-compose.yml's `neo4j` service).
CREATE CONSTRAINT entity_id IF NOT EXISTS FOR (n:Entity) REQUIRE n.entity_id IS UNIQUE;
CREATE CONSTRAINT claim_id  IF NOT EXISTS FOR ()-[r:REL]-() REQUIRE r.claim_id IS UNIQUE;
CREATE INDEX entity_kind IF NOT EXISTS FOR (n:Entity) ON (n.kind);
CREATE INDEX rel_type    IF NOT EXISTS FOR ()-[r:REL]-() ON (r.rel_type, r.observed_time);
