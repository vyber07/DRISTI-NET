"""Live validation of Besu EVM Merkle anchor.

Submits a Merkle root, waits for the receipt, and reads it back to verify inclusion.
Requires a running Besu node at http://localhost:8545 (via docker-compose).
"""
import os
import sys
import logging
from web3 import Web3

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from apps.api.app.services.integrity import MerkleTree, LedgerAnchor

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

def main():
    besu_url = os.environ.get("DRISHTI_BESU_ENDPOINT", "http://localhost:8545")
    w3 = Web3(Web3.HTTPProvider(besu_url))
    
    if not w3.is_connected():
        logging.error(f"Cannot connect to Besu at {besu_url}. Is it running?")
        sys.exit(1)
        
    logging.info(f"Connected to Besu node: {w3.client_version}")
    
    # 1. Generate Merkle Tree
    hashes = [b"evd1_hash", b"evd2_hash", b"evd3_hash"]
    tree = MerkleTree(hashes)
    root_hex = tree.root().hex()
    logging.info(f"Generated Merkle Root: {root_hex}")
    
    # 2. Anchor to Besu
    # Using a standard dev account for validation
    dev_key = os.environ.get("DRISHTI_BESU_SIGNING_KEY", "0x8f2a55949038a9610f50fb23b5883af3b4ecb3c3bb792cbcefbd1542c692be63")
    anchor = LedgerAnchor(besu_url, dev_key)
    
    try:
        tx_hash = anchor.anchor_root("CASE-TEST", root_hex)
        logging.info(f"Transaction submitted. Hash: {tx_hash}")
        
        # 3. Wait for Receipt
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=30)
        logging.info(f"Transaction mined in block {receipt.blockNumber}")
        
        # 4. Read back and verify
        tx = w3.eth.get_transaction(tx_hash)
        input_data = Web3.to_text(tx.input)
        
        logging.info(f"Read back payload: {input_data}")
        if root_hex in input_data and "CASE-TEST" in input_data:
            logging.info("SUCCESS: Merkle root verified on ledger.")
        else:
            logging.error("FAILURE: Payload does not match submitted root.")
            sys.exit(1)
            
    except Exception as e:
        logging.error(f"Validation failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
