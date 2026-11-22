"""Live validation of Besu EVM Merkle anchor.

Submits a Merkle root, waits for the receipt, and reads it back to verify inclusion.
Requires a running Besu node at http://localhost:8545 (via docker-compose).
"""
import os
import sys
import logging
from web3 import Web3

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from apps.api.app.services.integrity import merkle_root, submit_to_besu

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

def main():
    besu_url = os.environ.get("DRISHTI_BESU_ENDPOINT", "http://localhost:8545")
    w3 = Web3(Web3.HTTPProvider(besu_url))
    
    if not w3.is_connected():
        logging.error(f"Cannot connect to Besu at {besu_url}. Is it running?")
        sys.exit(1)
        
    logging.info(f"Connected to Besu node: {w3.client_version}")
    
    # 1. Generate Merkle Tree root
    hashes = ["e" * 64, "f" * 64, "a" * 64]
    root_hex = merkle_root(hashes)
    logging.info(f"Generated Merkle Root: {root_hex}")
    
    # 2. Anchor to Besu
    # No in-source fallback key (DEF-034): a hard-coded default is how a dev key ends up signing on a real network.
    # For a local Besu `--network=dev` node, export the dev account key from the Besu documentation yourself.
    dev_key = os.environ.get("DRISHTI_BESU_SIGNING_KEY", "")
    if not dev_key:
        logging.error("DRISHTI_BESU_SIGNING_KEY is not set; refusing to sign with a built-in key.")
        sys.exit(2)
    
    try:
        res = submit_to_besu(root_hex, besu_url, dev_key)
        tx_hash = res["tx_hash"]
        logging.info(f"Transaction submitted. Hash: {tx_hash}")
        
        # 3. Read back and verify
        tx = w3.eth.get_transaction(tx_hash)
        input_data = Web3.to_hex(tx.input)
        
        logging.info(f"Read back payload: {input_data}")
        if root_hex.lower() in input_data.lower():
            logging.info("SUCCESS: Merkle root verified on ledger.")
        else:
            logging.error("FAILURE: Payload does not match submitted root.")
            sys.exit(1)
            
    except Exception as e:
        logging.error(f"Validation failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
