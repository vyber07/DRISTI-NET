"""DEF-085: RFC 6962 Merkle hashing for new anchors; legacy anchors keep verifying under their recorded scheme."""
import hashlib

import pytest

from ..services import integrity as I


def _h(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()


def test_rfc6962_definition_for_small_trees():
    a, b, c = _h("a"), _h("b"), _h("c")
    leaf = lambda x: hashlib.sha256(b"\x00" + bytes.fromhex(x)).hexdigest()
    node = lambda l, r: hashlib.sha256(b"\x01" + bytes.fromhex(l) + bytes.fromhex(r)).hexdigest()
    assert I.merkle_root([]) == hashlib.sha256(b"").hexdigest()
    assert I.merkle_root([a]) == leaf(a)                      # a single leaf is hashed, not returned raw
    assert I.merkle_root([a, b]) == node(leaf(a), leaf(b))
    assert I.merkle_root([a, b, c]) == node(node(leaf(a), leaf(b)), leaf(c))  # split at 2, no duplication


def test_rfc6962_removes_the_legacy_ambiguities():
    a, b, c = _h("a"), _h("b"), _h("c")
    # failure of the legacy scheme, demonstrated: duplicating the last leaf gives the same root
    assert I.merkle_root([a, b, c], I.SCHEME_LEGACY) == I.merkle_root([a, b, c, c], I.SCHEME_LEGACY)
    assert I.merkle_root([a, b, c]) != I.merkle_root([a, b, c, c])
    # an internal node can no longer be presented as a leaf of a shorter tree
    legacy_node = I._merkle_hash(a, b)
    assert I.merkle_root([legacy_node, I._merkle_hash(c, c)], I.SCHEME_LEGACY) == I.merkle_root([a, b, c], I.SCHEME_LEGACY)
    left = I._rfc_node(I._rfc_leaf(a), I._rfc_leaf(b))
    assert I.merkle_root([left, I._rfc_leaf(c)]) != I.merkle_root([a, b, c])


@pytest.mark.parametrize("n", range(1, 18))
@pytest.mark.parametrize("scheme", [I.SCHEME_RFC6962, I.SCHEME_LEGACY])
def test_every_proof_verifies_and_tampering_fails(n, scheme):
    leaves = [_h(str(i)) for i in range(n)]
    root = I.merkle_root(leaves, scheme)
    for idx in range(n):
        p = I.merkle_proof(leaves, idx, scheme)
        assert p.root == root and p.verify(), (n, idx)
        assert not I.MerkleProof(_h("not-a-member"), root, p.siblings, scheme).verify()
        if p.siblings:
            bad = [dict(s) for s in p.siblings]
            bad[0]["hash"] = _h("tampered")
            assert not I.MerkleProof(p.leaf_hash, root, bad, scheme).verify()
    # a proof built for one scheme does not verify under the other
    if n > 1:
        other = I.SCHEME_LEGACY if scheme == I.SCHEME_RFC6962 else I.SCHEME_RFC6962
        p = I.merkle_proof(leaves, 0, scheme)
        assert not I.MerkleProof(p.leaf_hash, p.root, p.siblings, other).verify()


def test_new_anchor_records_rfc6962_and_its_proof_matches(client, investigator, ingested):
    r = client.post("/api/v1/cases/CASE-0001/integrity/anchor", headers=investigator)
    assert r.status_code == 201, r.text
    anchor = r.json()
    assert anchor["merkle_scheme"] == I.SCHEME_RFC6962
    ev = client.get("/api/v1/cases/CASE-0001/evidence", headers=investigator).json()
    leaf = next(e["sha256"] for e in ev if e["status"] in I_ANCHORABLE)
    proof = client.get(f"/api/v1/cases/CASE-0001/integrity/anchors/{anchor['anchor_id']}/proof/{leaf}", headers=investigator).json()
    assert proof["merkle_scheme"] == I.SCHEME_RFC6962 and proof["proof_root_matches_anchor"] is True
    assert I.MerkleProof(leaf, anchor["merkle_root"], proof["siblings"], proof["merkle_scheme"]).verify()


I_ANCHORABLE = ("HITL", "GRAPH_PROJECTED", "ACTIVE", "EXTRACTED", "ACCEPTED")


def test_sqlite_additive_upgrade_adds_the_new_column_to_an_existing_database(tmp_path, monkeypatch):
    """DEF-086: an existing SQLite DB never received new columns (create_all only creates tables)."""
    import sqlite3
    from sqlalchemy import create_engine
    from .. import db as dbmod

    path = tmp_path / "old.db"
    con = sqlite3.connect(path)
    con.execute("create table ledger_anchors (anchor_id varchar primary key, case_id varchar, leaf_hashes json, merkle_root varchar, "
                "tx_hash varchar, block_number varchar, chain_id varchar, endpoint varchar, anchor_status varchar, note text, "
                "created_at datetime, created_by varchar)")
    con.execute("insert into ledger_anchors (anchor_id, case_id, leaf_hashes, merkle_root, anchor_status, created_by) values "
                "('ANC-old', 'C', '[]', 'r', 'LOCAL_ONLY', 'u')")
    con.commit(); con.close()
    monkeypatch.setattr(dbmod, "engine", create_engine(f"sqlite:///{path}"))
    dbmod._sqlite_add_missing_columns()
    con = sqlite3.connect(path)
    cols = {r[1] for r in con.execute("pragma table_info(ledger_anchors)")}
    assert "merkle_scheme" in cols
    assert con.execute("select merkle_scheme from ledger_anchors where anchor_id='ANC-old'").fetchone()[0] == I.SCHEME_LEGACY
