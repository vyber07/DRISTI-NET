import os
import socket
import psycopg2
import redis
from neo4j import GraphDatabase

def test_postgresql():
    print("Testing PostgreSQL...")
    db_url = os.environ.get("DRISHTI_DATABASE_URL")
    if db_url and db_url.startswith("postgresql+psycopg2://"):
        url = db_url.replace("postgresql+psycopg2://", "postgresql://")
    else:
        # Fallback to discrete vars if not fully defined in a URL
        db = os.environ.get("POSTGRES_DB", "drishti")
        user = os.environ.get("POSTGRES_USER", "drishti")
        password = os.environ["POSTGRES_PASSWORD"]
        host = os.environ.get("POSTGRES_HOST", "postgres")
        port = os.environ.get("POSTGRES_PORT", "5432")
        url = f"postgresql://{user}:{password}@{host}:{port}/{db}"
    
    conn = psycopg2.connect(url)
    cur = conn.cursor()
    cur.execute("SELECT 1;")
    assert cur.fetchone()[0] == 1
    cur.execute("SELECT tablename FROM pg_tables WHERE schemaname='public';")
    tables = [row[0] for row in cur.fetchall()]
    assert "users" in tables, "Schema not initialized"
    cur.execute("SELECT user_id FROM users LIMIT 1;")
    user_id = cur.fetchone()[0]
    # Verify uix_evidence_case_sha constraint


    # Verify uix_evidence_case_sha constraint
    cur.execute("SELECT 1 FROM pg_constraint WHERE conname = 'uix_evidence_case_sha';")
    assert cur.fetchone() is not None, "uix_evidence_case_sha constraint missing"
    
    # Test uniqueness
    try:
        cur.execute(f"INSERT INTO cases (case_id, title, jurisdiction, purpose, authority_reference, owner_id, opened_at, classification, sensitivity, created_at) VALUES ('INFRA-CASE', 'Test', 'J', 'P', 'A', '{user_id}', '2023', 'C', 'S', '2023-01-01') ON CONFLICT DO NOTHING;")
        cur.execute(f"INSERT INTO evidence (evidence_id, case_id, filename, extension, detected_type, record_type, size_bytes, sha256, status, storage_path, source_label, created_at, updated_at, version, uploaded_by, retention_policy, legal_hold, tombstoned, classification, jurisdiction, purpose, access_class) VALUES ('EVD-INFRA-1', 'INFRA-CASE', 'f', 'e', 't', 'r', 1, 'sha-infra-dup', 'UPLOADED', 's', 's', '2023-01-01', '2023-01-01', 1, '{user_id}', 'Standard', false, false, 'C', 'J', 'P', 'A');")
        try:
            cur.execute(f"INSERT INTO evidence (evidence_id, case_id, filename, extension, detected_type, record_type, size_bytes, sha256, status, storage_path, source_label, created_at, updated_at, version, uploaded_by, retention_policy, legal_hold, tombstoned, classification, jurisdiction, purpose, access_class) VALUES ('EVD-INFRA-2', 'INFRA-CASE', 'f', 'e', 't', 'r', 1, 'sha-infra-dup', 'UPLOADED', 's', 's', '2023-01-01', '2023-01-01', 1, '{user_id}', 'Standard', false, false, 'C', 'J', 'P', 'A');")
            assert False, "Duplicate evidence insert succeeded!"
        except psycopg2.errors.UniqueViolation:
            conn.rollback()
        finally:
            conn.rollback()
            cur.execute("DELETE FROM evidence WHERE case_id = 'INFRA-CASE';")
            cur.execute("DELETE FROM cases WHERE case_id = 'INFRA-CASE';")
            conn.commit()
    except Exception as e:
        conn.rollback()
        raise e

    cur.close()
    conn.close()
    print("PostgreSQL ✅ (Connected, schema verified, read successful)")

def test_neo4j():
    print("Testing Neo4j...")
    neo4j_password = os.environ["DRISHTI_NEO4J_PASSWORD"]
    neo4j_uri = os.environ.get("DRISHTI_NEO4J_URI", "bolt://neo4j:7687")
    driver = GraphDatabase.driver(neo4j_uri, auth=(os.environ.get("DRISHTI_NEO4J_USER", "neo4j"), neo4j_password))
    with driver.session() as session:
        res = session.run("RETURN 1 AS num")
        assert res.single()["num"] == 1
        res = session.run("SHOW CONSTRAINTS")
        constraints = [record["name"] for record in res]
        assert len(constraints) > 0, "No constraints initialized"
        res = session.run("CREATE (n:TestInfraNode {id: 'test-1'}) RETURN n.id AS id")
        assert res.single()["id"] == 'test-1'
        session.run("MATCH (n:TestInfraNode {id: 'test-1'}) DELETE n")
    driver.close()
    print("Neo4j ✅")

def test_redis():
    print("Testing Redis...")
    redis_url = os.environ.get("DRISHTI_REDIS_URL", "redis://redis:6379/0")
    r = redis.Redis.from_url(redis_url)
    assert r.ping()
    r.set("infra_test_key", "value", ex=5)
    assert r.get("infra_test_key") == b"value"
    ttl = r.ttl("infra_test_key")
    assert 0 < ttl <= 5
    r.delete("infra_test_key")
    print("Redis ✅")

def test_minio():
    print("Testing MinIO...")
    import boto3
    from botocore.config import Config as BotoConfig
    minio_secret = os.environ["DRISHTI_S3_SECRET_KEY"]
    minio_url = os.environ.get("DRISHTI_S3_ENDPOINT_URL", "http://minio:9000")
    client = boto3.client(
        "s3", endpoint_url=minio_url,
        aws_access_key_id=os.environ.get("DRISHTI_S3_ACCESS_KEY", "drishti"),
        aws_secret_access_key=minio_secret,
        region_name="us-east-1", config=BotoConfig(signature_version="s3v4")
    )
    
    # Check bucket exists
    buckets = [b["Name"] for b in client.list_buckets().get("Buckets", [])]
    assert "drishti" in buckets, "Bucket drishti does not exist"
    
    data = b"Hello Minio Infra Test"
    client.put_object(Bucket="drishti", Key="infra-test-file.txt", Body=data)
    resp = client.get_object(Bucket="drishti", Key="infra-test-file.txt")
    assert resp["Body"].read() == data
    client.delete_object(Bucket="drishti", Key="infra-test-file.txt")
    print("MinIO ✅")

def test_clamav():
    print("Testing ClamAV...")
    clamav_host = os.environ.get("DRISHTI_CLAMAV_HOST", "clamav")
    clamav_port = int(os.environ.get("DRISHTI_CLAMAV_PORT", "3310"))
    EICAR = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
    
    def scan_bytes(data: bytes):
        import struct
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.connect((clamav_host, clamav_port))
        s.sendall(b"zINSTREAM\0")
        s.sendall(struct.pack("!I", len(data)))
        s.sendall(data)
        s.sendall(struct.pack("!I", 0))
        result = b""
        while True:
            chunk = s.recv(1024)
            if not chunk:
                break
            result += chunk
        s.close()
        return result.replace(b"\0", b"").decode()

    res_clean = scan_bytes(b"Clean content")
    assert "OK" in res_clean, f"Expected OK, got: {res_clean}"
    
    res_eicar = scan_bytes(EICAR)
    assert "FOUND" in res_eicar, f"Expected FOUND, got: {res_eicar}"
    print("ClamAV ✅")

def main():
    test_postgresql()
    test_neo4j()
    test_redis()
    test_minio()
    test_clamav()
    print("ALL INFRASTRUCTURE TESTS PASSED!")

if __name__ == "__main__":
    main()
