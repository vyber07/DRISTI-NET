# DRISTI-NET — Duplicate Code Analysis Report

**Audit Date:** 2026-11-19  

---

## 1. Identified Duplicate Code Patterns

| Instance ID | Subsystem | Files Involved | Duplicate Pattern Description | Proposed Remediation | Risk Level |
|---|---|---|---|---|---|
| **DUP-01** | Backend Parsing | `services/extract_document.py` & `services/extract_structured.py` | Overlapping header normalization and row coordinate tracking logic. | Unify row coordinate tracking in `services/extract_common.py`. | Low |
| **DUP-02** | Backend Auth | `routes/override_routes.py` & `routes/user_request_routes.py` | Repeated supervisor approval verification checks and audit serialization. | Create shared dependency `require_supervisor_approval()`. | Low |
| **DUP-03** | Frontend Modals | `reveal-identity-modal.tsx` & `confirm-dialog.tsx` | Duplicate modal overlay backdrop and keyboard Esc handler logic. | Rebase `reveal-identity-modal` onto base `Dialog` primitive. | Low |
| **DUP-04** | Backend Hashing | `services/storage.py` & `services/pipeline.py` | Duplicate streaming chunk SHA-256 calculation loops. | Standardize on `storage.calculate_sha256()`. | Low |
