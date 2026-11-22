# DRISTI-NET — Master Evidence Integrity Specification

**Authority:** `docs/adr/010-integrity-mechanism.md`, `apps/api/app/services/storage.py`, `apps/api/app/models.py`  
**Consolidation Date:** 2026-11-19  

---

## 1. Digital Evidence Integrity Lifecycle

Every piece of digital evidence admitted into DRISTI-NET is governed by a strict cryptographic chain of custody:

1. **Streaming SHA-256 Hashing:** Calculated in 64 KB streaming chunks during initial HTTP upload before persisting to quarantine storage.
2. **Immutable Manifest:** The SHA-256 hash is recorded in `evidence.sha256` alongside byte count, original filename, client IP, and UTC timestamp.
3. **Pre-Promotion Verification:** Prior to promoting a file from quarantine to accepted storage, the backend recalculates the SHA-256 hash from storage. If the recomputed hash does not match the database record, the system triggers `INTEGRITY_MISMATCH`, locks the evidence, and generates a critical security alert.
4. **Download Checksum Verification:** Whenever an investigator downloads an evidence file, the server streams the content with an `X-Evidence-SHA256` HTTP header, enabling local forensic verification against the original case manifest.

---

## 2. Tamper Detection & Defense Drill

- **Tamper Simulation:** Verified during disaster recovery and security drills using intentionally modified files (`data/synthetic/documents/fir_001_TAMPERED.txt`).
- **Fail-Closed Outcome:** Any single-bit alteration in the file payload changes the SHA-256 hash, causing immediate rejection during extraction and blocking all downstream graph projection.
