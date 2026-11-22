"""Evidence integrity — SHA-256 Merkle tree + optional ledger anchor.

Architecture target (docs/context.md §7.2, ADR-010 §Migration).

Design
------
SHA-256 is computed per evidence file at upload (existing behaviour, unchanged).
This module adds a *batch Merkle root*: one deterministic root hash covering a set
of evidence hashes from a case or an explicit list of evidence IDs.

The Merkle root can optionally be anchored to an EVM-compatible ledger
(Hyperledger Besu in the evaluation stack; any JSON-RPC compatible endpoint in
production).  The anchor stores only the root — no PII ever leaves the system.
Evidence files remain off-chain.  The anchor is an integrity reference; it is not
a chain-of-custody certificate or legal proof.

Merkle tree
-----------
Uses a simple binary tree with SHA-256 double-hashing (à la Bitcoin / RFC 6962):
  hash(left || right)  where both are already SHA-256 hashes (hex strings)
Odd leaves are duplicated, which is the standard RFC 6962 / Bitcoin Merkle behaviour.
The tree is deterministic for a given ordered list of leaf hashes.

Inclusion proof
---------------
Returns the sibling hashes needed to recompute the root from a single leaf.
Verifiable offline with the functions in this module.

Besu adapter
------------
Import-guarded (requires web3 ≥ 6.0).  Falls back gracefully if the library is not
installed or the node is unreachable.  The evaluation Compose stack uses Hyperledger
Besu 25.7.0; production must use HSM-backed signing (never a plaintext private key
in env or source).

STRICT scope (AGENTS.md §3): any change to _merkle_hash, merkle_root,
verify_inclusion, or LedgerAnchor must include a success test and a failure test.
"""
from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..db import Base
from ..models import utcnow

logger = logging.getLogger("drishti.integrity")

# ─── Merkle tree ─────────────────────────────────────────────────────────────

def _merkle_hash(left: str, right: str) -> str:
    """SHA-256(left_hex || right_hex) — both inputs are hex strings."""
    combined = bytes.fromhex(left) + bytes.fromhex(right)
    return hashlib.sha256(combined).hexdigest()


# DEF-085: the original construction (kept below as scheme "dup-last-v0" so existing anchors still verify) had no
# leaf/node domain separation and duplicated the last node on odd levels: root([a,b,c]) == root([a,b,c,c]), and an
# internal node could be presented as a leaf. Its docstring claimed RFC 6962, which it was not. New anchors use
# RFC 6962 Merkle Tree Hash: leaf = SHA-256(0x00 || leaf), node = SHA-256(0x01 || left || right), split at the
# largest power of two smaller than n, no duplication.
SCHEME_RFC6962 = "rfc6962"
SCHEME_LEGACY = "dup-last-v0"
CURRENT_SCHEME = SCHEME_RFC6962


def _rfc_leaf(leaf_hex: str) -> str:
    return hashlib.sha256(b"\x00" + bytes.fromhex(leaf_hex)).hexdigest()


def _rfc_node(left_hex: str, right_hex: str) -> str:
    return hashlib.sha256(b"\x01" + bytes.fromhex(left_hex) + bytes.fromhex(right_hex)).hexdigest()


def _split(n: int) -> int:
    k = 1
    while k * 2 < n:
        k *= 2
    return k


def _rfc_mth(leaves: list[str]) -> str:
    if len(leaves) == 1:
        return _rfc_leaf(leaves[0])
    k = _split(len(leaves))
    return _rfc_node(_rfc_mth(leaves[:k]), _rfc_mth(leaves[k:]))


def _rfc_path(m: int, leaves: list[str]) -> list[dict]:
    """RFC 6962 audit path, ordered from the leaf upwards."""
    if len(leaves) == 1:
        return []
    k = _split(len(leaves))
    if m < k:
        return _rfc_path(m, leaves[:k]) + [{"hash": _rfc_mth(leaves[k:]), "position": "right"}]
    return _rfc_path(m - k, leaves[k:]) + [{"hash": _rfc_mth(leaves[:k]), "position": "left"}]


def _legacy_root(leaf_hashes: list[str]) -> str:
    level = list(leaf_hashes)
    while len(level) > 1:
        if len(level) % 2 == 1:
            level.append(level[-1])
        level = [_merkle_hash(level[i], level[i + 1]) for i in range(0, len(level), 2)]
    return level[0]


def _legacy_path(leaf_hashes: list[str], leaf_index: int) -> list[dict]:
    level, idx, siblings = list(leaf_hashes), leaf_index, []
    while len(level) > 1:
        if len(level) % 2 == 1:
            level.append(level[-1])
        if idx % 2 == 0:
            siblings.append({"hash": level[idx + 1], "position": "right"})
        else:
            siblings.append({"hash": level[idx - 1], "position": "left"})
        level = [_merkle_hash(level[i], level[i + 1]) for i in range(0, len(level), 2)]
        idx //= 2
    return siblings


def merkle_root(leaf_hashes: list[str], scheme: str = CURRENT_SCHEME) -> str:
    """Merkle root of an ordered list of hex SHA-256 leaf values. Empty list -> SHA-256 of the empty string."""
    if not leaf_hashes:
        return hashlib.sha256(b"").hexdigest()
    if scheme == SCHEME_RFC6962:
        return _rfc_mth(list(leaf_hashes))
    if scheme == SCHEME_LEGACY:
        return _legacy_root(leaf_hashes)
    raise ValueError(f"unknown Merkle scheme {scheme!r}")


@dataclass
class MerkleProof:
    """An inclusion proof for a single leaf. Can be verified offline."""
    leaf_hash: str
    root: str
    siblings: list[dict]   # [{"hash": hex, "position": "left"|"right"}, ...], leaf upwards
    scheme: str = CURRENT_SCHEME

    def verify(self) -> bool:
        """Recompute the root from the leaf + siblings and check it matches."""
        if self.scheme == SCHEME_RFC6962:
            current, combine = _rfc_leaf(self.leaf_hash), _rfc_node
        elif self.scheme == SCHEME_LEGACY:
            current, combine = self.leaf_hash, _merkle_hash
        else:
            return False
        for step in self.siblings:
            current = combine(step["hash"], current) if step["position"] == "left" else combine(current, step["hash"])
        return current == self.root


def merkle_proof(leaf_hashes: list[str], leaf_index: int, scheme: str = CURRENT_SCHEME) -> MerkleProof:
    """Inclusion proof for leaf_hashes[leaf_index]. Raises IndexError if leaf_index is out of bounds."""
    if not leaf_hashes or leaf_index < 0 or leaf_index >= len(leaf_hashes):
        raise IndexError(f"leaf_index {leaf_index} out of range for {len(leaf_hashes)} leaves")
    siblings = _rfc_path(leaf_index, list(leaf_hashes)) if scheme == SCHEME_RFC6962 else _legacy_path(leaf_hashes, leaf_index)
    return MerkleProof(leaf_hash=leaf_hashes[leaf_index], root=merkle_root(leaf_hashes, scheme), siblings=siblings, scheme=scheme)


# ─── Database model ──────────────────────────────────────────────────────────

class LedgerAnchor(Base):
    """One on-chain (or simulated) anchor of a Merkle root over a set of evidence hashes.

    The root is anchored; evidence files stay off-chain.  PII never leaves the system.
    This record is an integrity reference, not a legal certificate or chain of custody proof.
    """
    __tablename__ = "ledger_anchors"

    anchor_id: Mapped[str] = mapped_column(String, primary_key=True)
    case_id: Mapped[str] = mapped_column(String, index=True)
    # Ordered list of evidence SHA-256 hex strings that form the Merkle leaves
    leaf_hashes: Mapped[list] = mapped_column(JSON, default=list)
    merkle_root: Mapped[str] = mapped_column(String)
    # Ledger-side references (None if the ledger is not configured or the tx failed)
    tx_hash: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    block_number: Mapped[Optional[int]] = mapped_column(String, nullable=True)
    chain_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    endpoint: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    anchor_status: Mapped[str] = mapped_column(String, default="LOCAL_ONLY")
    # DEF-085: which Merkle construction produced merkle_root. Rows that existed before the column get the legacy
    # value through the server default (migration 5bcde1234570 / SQLite additive upgrade in db.init_db).
    merkle_scheme: Mapped[Optional[str]] = mapped_column(String, nullable=True, server_default=SCHEME_LEGACY)
    # LOCAL_ONLY = Merkle root computed but no ledger tx submitted
    # SUBMITTED  = tx submitted, awaiting confirmation
    # CONFIRMED  = block confirmation received
    # FAILED     = submission attempted but failed
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    created_by: Mapped[str] = mapped_column(String)


# ─── Besu / EVM ledger adapter ───────────────────────────────────────────────

def _get_web3(endpoint: str):
    """Import-guarded Web3 client.  Raises ImportError if web3 is not installed."""
    from web3 import Web3
    w3 = Web3(Web3.HTTPProvider(endpoint, request_kwargs={"timeout": 10}))
    return w3


def submit_to_besu(
    merkle_root_hex: str,
    endpoint: str,
    signing_key_hex: str,
    chain_id: int = 1337,
) -> dict:
    """Submit the Merkle root as a 0-value ETH transaction to a Besu node.

    The root is encoded as the transaction `data` field (0x-prefixed).
    Returns {"tx_hash": str, "block_number": int, "chain_id": int} on success.
    Raises RuntimeError on submission failure.

    SECURITY NOTE: signing_key_hex must NEVER be a plaintext value stored in source code
    or .env in production.  Use a managed key / HSM.  The evaluation stack uses a
    dev-mode unlocked account only because Besu is running in --miner-enabled
    dev mode with a well-known dev key — this is not safe for production.
    """
    try:
        w3 = _get_web3(endpoint)
    except ImportError as exc:
        raise RuntimeError(f"web3 not installed; ledger anchor skipped: {exc}") from exc

    if not w3.is_connected():
        raise RuntimeError(f"Cannot connect to Besu at {endpoint}")

    account = w3.eth.account.from_key(signing_key_hex)
    tx = {
        "from": account.address,
        "to": account.address,       # self-send; we only care about the data field
        "value": 0,
        "data": "0x" + merkle_root_hex,
        "gas": 50_000,
        "gasPrice": w3.eth.gas_price,
        "nonce": w3.eth.get_transaction_count(account.address),
        "chainId": chain_id,
    }
    signed = w3.eth.account.sign_transaction(tx, signing_key_hex)
    tx_hash_hex = w3.eth.send_raw_transaction(signed.rawTransaction).hex()
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash_hex, timeout=30)
    return {
        "tx_hash": tx_hash_hex,
        "block_number": receipt["blockNumber"],
        "chain_id": chain_id,
    }


# ─── High-level helper ───────────────────────────────────────────────────────

def new_anchor_id() -> str:
    import uuid
    return f"ANC-{uuid.uuid4().hex[:12]}"


def build_and_anchor(
    db_session,
    case_id: str,
    evidence_sha256_list: list[str],
    created_by: str,
    besu_endpoint: str = "",
    besu_signing_key: str = "",
    besu_chain_id: int = 1337,
) -> "LedgerAnchor":
    """Compute Merkle root for a list of evidence SHA-256 hashes and store in DB.
    Optionally submit to a Besu node if endpoint and key are provided.

    Returns the saved LedgerAnchor row.
    """
    root = merkle_root(evidence_sha256_list, CURRENT_SCHEME)
    anchor = LedgerAnchor(
        merkle_scheme=CURRENT_SCHEME,
        anchor_id=new_anchor_id(),
        case_id=case_id,
        leaf_hashes=evidence_sha256_list,
        merkle_root=root,
        anchor_status="LOCAL_ONLY",
        created_by=created_by,
        note="Merkle root computed from case evidence SHA-256 hashes. Off-chain. Integrity reference only.",
    )
    db_session.add(anchor)
    db_session.flush()

    if besu_endpoint and besu_signing_key:
        try:
            result = submit_to_besu(root, besu_endpoint, besu_signing_key, besu_chain_id)
            anchor.tx_hash = result["tx_hash"]
            anchor.block_number = str(result["block_number"])
            anchor.chain_id = str(result["chain_id"])
            anchor.endpoint = besu_endpoint
            anchor.anchor_status = "CONFIRMED"
            anchor.note = (
                f"Merkle root anchored to Besu chain {result['chain_id']} "
                f"block {result['block_number']} tx {result['tx_hash'][:12]}…. "
                "Off-chain. Integrity reference only."
            )
        except Exception as exc:
            anchor.anchor_status = "FAILED"
            anchor.note = f"Ledger submission failed: {exc}"
            logger.warning("Besu anchor failed for case %s: %s", case_id, exc)

    db_session.flush()
    return anchor
