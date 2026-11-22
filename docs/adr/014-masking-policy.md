# ADR-014: Masking policy, separation of duties, and field-level masking of personal attributes

**Status:** Accepted. Tested on SQLite (353 passed) and on a disposable PostgreSQL 16 container (all passing, including
the migration-chain test). Not deployed. Model and rules: `docs/MASKING_AUTHORIZATION.md`.

## Problem

- Phone and account labels were masked on every default path. A sweep confirmed no raw value leaked for any role.
- Reveal rules were hard-coded in three places (entity reveal, context reveal, raw download), and mirrored by hand in
  the frontend. There was no policy to administer or audit.
- ADMIN could reveal values and download raw files, so the role that would configure masking could also read what it masks.
- Personal attributes (`address`, `dob`) were returned raw to every role that could read the case, including ADMIN and
  AUDITOR. This covered candidates, graph nodes, claims and evidence claims, and matcher signals quoting compared values.
- 422 validation errors echoed the rejected input, so an over-long login password came back in the response.
- `claim_out` had an unused `unmasked=True` switch: a bypass waiting to be wired up.

## Decision

- **Masking is unconditional** on default outputs. Only *who may request a reveal* is configurable.
- **`masking_policies` table** (migration `5bcde1234573`): one row per kind (PHONE, ACCOUNT, PII_ATTRIBUTE,
  EVIDENCE_CONTEXT, RAW_FILE). Defaults: INVESTIGATOR and REVIEWER.
- **One reveal check** (`masking_policy.authorize_reveal`) for all four reveal routes: policy row present, role listed,
  case assignment (no ADMIN/AUDITOR bypass), and the value belongs to the case. Deny wins; every attempt is audited.
- **Separation of duties:** ADMIN alone changes policy and can never be in `reveal_roles`. AUDITOR can view the policy.
- **Field-level masking** at the output boundary: `mask_attributes`, `redact_known_values`, `redact_structure`. Internal
  logic (resolution, graph building) keeps raw data. A new `POST /entities/{id}/attributes/reveal` releases one attribute.
- **Validation errors** no longer carry input. `/api/*` responses are `Cache-Control: no-store`.
- The `unmasked` switch was removed from `claim_out`.

## Trade-offs

- **Behaviour change:** ADMIN can no longer reveal values, read evidence context unmasked, or download raw files
  (including quarantined ones). This is the separation-of-duties requirement. A deployment that relies on admin
  downloads must give that task to an investigator or reviewer.
- **Review workflow:** reviewers compare candidates on masked `dob` and `address` (birth year, masked address). The
  matcher's signals still show agreement, and the raw values are one audited reveal away, but the review UI has no
  attribute-reveal button yet.
- **Single-person policy change:** an ADMIN widens a policy alone, with a reason, audited. No two-person approval.
- **Names stay visible.** They are needed for investigation; masking them is a separate decision.

## Migration and rollback

Additive. PostgreSQL: `upgrade head` creates the table and the defaults (verified with a fresh build, downgrade and
re-upgrade). SQLite: `init_db` and `seed` add any missing kind without overwriting changes. Rollback: revert the
commit and downgrade one revision. ADMIN reveal returns with the old code.

## Verification

See `docs/MASKING_AUTHORIZATION.md` section 6. Not verified: the live stack, and browser behaviour of the review page
with masked attributes (the frontend type-checks, but no browser test was run).
