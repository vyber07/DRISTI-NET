# Masking and sensitive-field authorization model

Status: implemented on branch `worktree-auth-login-ratelimit`, not deployed. Decision record: ADR-014.

## 1. Inventory

| Item | Where | Notes |
|---|---|---|
| Sensitive entity kinds | `models.SENSITIVE_KINDS` = PHONE, ACCOUNT | Entity labels of these kinds are masked on every output |
| Sensitive attributes | `masking.SENSITIVE_ATTRIBUTE_KEYS` = address, dob, phone, account | Field-level masks: `[masked address]`, `YYYY-**-**`, `+91 •••••• 123`, `ACC-DEMO-••02` |
| Text masking | `masking.mask_text` (phone and account patterns) plus `redact_known_values` (this case's raw personal values) | Applied to claim values, provenance snippets, review reasons, analysis rules |
| Structured outputs | `masking.redact_structure` | Matcher signals, conflicts and missing-field reports |
| Policy table | `masking_policies` (kind, reveal_roles, updated_at, updated_by, reason) | Kinds: PHONE, ACCOUNT, PII_ATTRIBUTE, EVIDENCE_CONTEXT, RAW_FILE |
| Policy service | `services/masking_policy.py` | `authorize_reveal`, `update_policy`, `ensure_default_policies` |
| Policy API | `GET /masking-policies` (ADMIN, AUDITOR), `PUT /masking-policies/{kind}` (ADMIN) | `routes/masking_routes.py` |
| Reveal APIs | `POST /entities/{id}/reveal` (PHONE/ACCOUNT label), `POST /entities/{id}/attributes/reveal` (one attribute), `POST /evidence/{id}/context/reveal` (source lines), `POST /evidence/{id}/download` (raw file) | All need a reason; all audited as `UNMASK` (raw download also as `EVIDENCE_DOWNLOAD`) |
| Frontend controls | `apps/web/src/lib/permissions.ts` (`reveal`, `downloadOriginal`), `services/api/evidenceApi.ts` (`RAW_DOWNLOAD_ROLES`), reveal modal and stores | UI only. The server decides. A test keeps the mirror equal to the server default. |
| Client-side masking helpers | `apps/web/src/lib/pii.ts`, `revealStore.officerClearance` | Presentation only. Never a security boundary: the server never sends raw values outside the reveal responses. |

## 2. Rules

1. **Masked by default, for everyone.** Every non-reveal response is masked for every role, including ADMIN and AUDITOR.
   Holding reveal permission does not change default views.
2. **Reveal is a separate, explicit request** with a reason (5–500 characters). It is allowed only when ALL hold:
   1. a policy row exists for the kind;
   2. the caller's role is in that row's `reveal_roles`;
   3. the caller is assigned to, or owns, the case (no ADMIN or AUDITOR bypass for reveals);
   4. the value belongs to the case named in the request (entity has a claim in it; evidence is filed in it).
3. **Configuring is not viewing.** Only ADMIN may change a policy (`PUT /masking-policies/{kind}`, reason ≥ 10
   characters). ADMIN can never be in any `reveal_roles` list: the API refuses it (422, audited), and
   `reveal_roles()` ignores it even if written into the table directly. AUDITOR may view the policy but not change it.
4. **Defaults** (migration `5bcde1234573`, `ensure_default_policies`): INVESTIGATOR and REVIEWER for every kind.

## 3. Denied, missing and conflicting permissions

| Situation | Result |
|---|---|
| Role not in the kind's `reveal_roles` | 403 with a generic message; `UNMASK` DENIED audited with the reason |
| No policy row for the kind | Nobody may reveal (fail closed); `GET /masking-policies` lists it under `missing_kinds` |
| Empty `reveal_roles` | Nobody may reveal |
| Role permitted, but not assigned to the case | Denied (deny wins) |
| Role permitted, assigned, but the entity or evidence is in another case | Denied, same message as an unknown entity (no IDOR oracle) |
| ADMIN or AUDITOR (case access without assignment) | Default views allowed, reveals denied |
| `ADMIN` written into the table outside the API | Ignored |
| Unknown kind in a policy change | 404, audited |
| Role, header, query or body parameter claiming a role or `unmasked` | Ignored: role comes only from the signed token and the user row |

## 4. Coverage of output paths

Masked: entity view, graph nodes (labels and attributes), claims and evidence claims (values, provenance snippets,
reviews), candidates (labels, summaries, matcher signals, conflicts), timeline, locations, analysis, reviews,
contradictions, JSON and HTML reports, the court PDF, the audit log (revealed values are never written to it).

Raw (by design, policy-gated, audited): the four reveal routes in section 1.

## 5. Errors, logs, caches and metadata

- 403 messages are generic ("You are not permitted to reveal this value"): no role, kind or value.
- 422 validation errors carry location, message and type only. The rejected input is no longer echoed. Before this
  change, an over-long login password came back in the response body.
- `/api/*` responses carry `Cache-Control: no-store` and `Pragma: no-cache`.
- Audit rows for reveals record the kind, target and stated reason, never the revealed value.
- No in-process cache holds raw values across requests. The per-request memo of a case's personal values (used for
  redaction) lives only for that request.

## 6. Verification

- `test_masking_sweep.py` and `test_masking_sweep_controls.py`: every case read endpoint and the reports, as 8 roles,
  scanned for every raw phone and account value (literal and full digit sequence), with a positive control proving
  the scanner sees raw values in a raw download.
- `test_masking_pii_attributes.py`: the same sweep for raw addresses and dates of birth. Before the fix this found
  raw values on candidates, the graph, claims and evidence claims for six roles, including ADMIN and AUDITOR.
- `test_masking_authorization.py` (44): policy administration and validation, separation of duties, legitimate
  reveals, policy changes taking effect, fail-closed missing rows, a tampered row, case-level conflicts, IDOR, forged
  role claims, role headers and parameters, unmask query parameters, the court PDF text, audit content, denial
  messages, caching headers, and the frontend mirror.
- `test_masking_errors.py`: validation errors do not echo passwords, usernames or query values.

## 7. Known limits

- **Review UI:** reviewers see masked `dob` and `address` when comparing candidates. The matcher's signals still say
  whether the values agree, and the raw values are available through `POST /entities/{id}/attributes/reveal`, but the
  review page has no reveal button for attributes yet.
- **Person names** are not masked: investigation and review depend on them. If names must be masked, they need their
  own kind and a reveal path.
- **Free-text redaction** removes this case's known personal values and phone and account patterns. A personal value
  that is not stored as an attribute (e.g. an address mentioned only inside a document) is masked only if it matches
  those patterns.
- **ADMIN bypass elsewhere:** `require_roles` still lets ADMIN through every other role gate (audit finding SEC-03).
  Reveals no longer depend on it.
- **Policy changes are single-person:** an ADMIN can widen a policy alone (with a reason, audited). There is no
  two-person approval.
