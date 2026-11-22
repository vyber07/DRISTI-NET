# DRISTI-NET — Dead & Obsolete Code Candidates

**Audit Date:** 2026-11-19  

---

## 1. Candidate Unused Files and Modules

| Candidate ID | Path | Type | Evidence & Reference Analysis | Proposed Action | Safety Status |
|---|---|---|---|---|---|
| **DEAD-01** | `apps/api/app/services/extract.py` | Python Stub | Contains 4 lines only (`_check_archive` import forwarder). Real implementation resides in `services/extract_common.py`. | Retain as compatibility alias or inline into `pipeline.py`. | Low Risk |
| **DEAD-02** | `apps/api/app/routes/listing.py` | Python Route | 35 lines; minimal legacy case listing superseded by `case_routes.py`. | Review if any external consumer hits `/listing` before removal. | Medium Risk |
| **DEAD-03** | `apps/web/src/services/api/real_client.ts` | TypeScript Client | Legacy fetch wrapper largely superseded by `client.ts`. | Consolidate any unique error headers into `client.ts` and deprecate. | Low Risk |
| **DEAD-04** | `apps/api/app/routes/demo_routes.py` | Python Route | Mounted strictly when `DB_TYPE=sqlite`. Provides quick seed shortcuts for dev UI. | Retain strictly for development/demo mode; ensure disabled in production. | Protected |
