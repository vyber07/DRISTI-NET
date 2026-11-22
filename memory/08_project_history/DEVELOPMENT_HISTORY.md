# DRISTI-NET — Master Development History & Changelog

**Authority:** `CHANGELOG.md`, `git log`, `frontend-audit/FRONTEND_CHANGELOG.md`  
**Consolidation Date:** 2026-11-19  

---

## 1. Major Release Milestones

### Phase 2.3 — Self-Service Account Management & Security (2026-11-19)
- **Commit `4f11760` / `2385d1c`:**
  - Added backend routes `/auth/me` (profile display name update), `/auth/me/password` (password change with rate limiting and session revocation), `/auth/me/sessions` (active session listing and revocation), and `/auth/me/activity` (personal security audit events).
  - Built frontend `profile-page.tsx` with display name inline editing, password change modal dialog, active session manager, and personal audit log viewer.
  - Added unit and integration tests (`test_account_self_service.py`, 24 passed).
  - Fixed database cold-boot declarative model registration.

### Phase 2.2 — Sidebar Navigation & Mobile Usability (2026-11-13)
- **Commit `489f286` / `28a6f5c`:**
  - Implemented streaming evidence download via `StreamingResponse` and `storage.iter_bytes()`.
  - Added server-side session revocation on `POST /auth/logout`.
  - Reorganized sidebar navigation into role-gated sections (Workspace, Oversight, Administration).
  - Added accessible modal dialog drawer below 1024px with focus trapping, backdrop closing, and Esc key support.
  - Added persistent sidebar collapse with keyboard-focusable hover tooltips.

### Phase 2.1 — UI/UX Accessibility Audit & Design System Pass (2026-11-13)
- **Commit `b3ead04`:**
  - Conducted axe-core accessibility audit across 42 route views: violations reduced from 8 to 0.
  - Set global minimum typography floor to 12px; eliminated all 8,600+ instances of micro-text under 12px.
  - Replaced ad-hoc uppercase headers with semantic PageHeader and H1 headings.
  - Introduced `ConfirmDialog` component replacing raw browser `window.confirm`.
  - Converted hardcoded palette colors to design system tokens (`tokens.css`).

### Phase 1.0 — 2.0 — Core Multimodal Architecture (2026-08 to 2026-11)
- Initial core pipeline build: FastAPI backend, React SPA, POLE+ relational models, quarantine pipeline, ClamAV integration, Neo4j graph projection, temporal decay calculation, RFC 6962 Merkle tree proofs, Besu EVM client, and neutral BSA s.63 evidence dossier PDF generation.
