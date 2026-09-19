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
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
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


def merkle_root(leaf_hashes: list[str]) -> str:
    """Compute the deterministic Merkle root of an ordered list of hex SHA-256 hashes.

    Empty list returns the hash of an empty byte string (standard sentinel).
    Odd-length levels duplicate the last leaf (RFC 6962 / Bitcoin convention).

    Parameters
    ----------
    leaf_hashes : list of SHA-256 hex strings (64 chars each)

    Returns
    -------
    Hex SHA-256 string of the Merkle root.
    """
    if not leaf_hashes:
        return hashlib.sha256(b"").hexdigest()
    level = list(leaf_hashes)
    while len(level) > 1:
        if len(level) % 2 == 1:
            level.append(level[-1])   # duplicate last leaf on odd-length level
        next_level = []
        for i in range(0, len(level), 2):
            next_level.append(_merkle_hash(level[i], level[i + 1]))
        level = next_level
    return level[0]


@dataclass
class MerkleProof:
    """An inclusion proof for a single leaf.  Can be verified offline."""
    leaf_hash: str
    root: str
    siblings: list[dict]   # [{"hash": hex, "position": "left"|"right"}, ...]

    def verify(self) -> bool:
        """Recompute the root from the leaf + siblings and check it matches."""
        current = self.leaf_hash
        for step in self.siblings:
            sib = step["hash"]
            if step["position"] == "left":
                current = _merkle_hash(sib, current)
            else:
                current = _merkle_hash(current, sib)
        return current == self.root


def merkle_proof(leaf_hashes: list[str], leaf_index: int) -> MerkleProof:
    """Compute the inclusion proof for leaf_hashes[leaf_index].

    Raises IndexError if leaf_index is out of bounds.
    """
    if not leaf_hashes or leaf_index < 0 or leaf_index >= len(leaf_hashes):
        raise IndexError(f"leaf_index {leaf_index} out of range for {len(leaf_hashes)} leaves")
    root = merkle_root(leaf_hashes)
    level = list(leaf_hashes)
    idx = leaf_index
    siblings: list[dict] = []
    while len(level) > 1:
        if len(level) % 2 == 1:
            level.append(level[-1])
        if idx % 2 == 0:
            # right sibling
            sib_idx = idx + 1
            siblings.append({"hash": level[sib_idx], "position": "right"})
        else:
            # left sibling
            sib_idx = idx - 1
            siblings.append({"hash": level[sib_idx], "position": "left"})
        next_level = []
        for i in range(0, len(level), 2):
            next_level.append(_merkle_hash(level[i], level[i + 1]))
        level = next_level
        idx //= 2
    return MerkleProof(leaf_hash=leaf_hashes[leaf_index], root=root, siblings=siblings)


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
    root = merkle_root(evidence_sha256_list)
    anchor = LedgerAnchor(
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
