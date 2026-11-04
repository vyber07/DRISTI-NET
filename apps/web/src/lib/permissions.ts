/**
 * What each role may do, mirroring the backend's `require_roles(...)` checks (apps/api/app/routes/*.py).
 *
 * This is a UI convenience only: it decides whether a control is shown or explained as unavailable. The backend
 * authorizes every request itself, so a wrong entry here can only produce a refused request, never extra access.
 * ADMIN passes every backend role check (auth.require_roles), so it is included everywhere.
 */
export type Capability =
  | "upload"          // POST /cases/{id}/evidence, POST /evidence/{id}/process
  | "downloadOriginal"// POST /evidence/{id}/download (DEF-101, reason required)
  | "reveal"          // POST /evidence/{id}/context/reveal, POST /entities/{id}/reveal (reason required)
  | "decide"          // POST /candidates/{id}/decision, /claims/{id}/decision, GET /cases/{id}/stats
  | "createAnchor"    // POST /cases/{id}/integrity/anchor
  | "listAnchors"     // GET /cases/{id}/integrity/anchors
  | "report"          // POST /cases/{id}/report and /report/court-pdf
  | "globalAudit"     // GET /audit
  | "createCase";     // POST /cases

const RULES: Record<Capability, readonly string[]> = {
  upload: ["EVIDENCE_OFFICER", "INVESTIGATOR", "ADMIN"],
  downloadOriginal: ["INVESTIGATOR", "REVIEWER", "ADMIN"],
  reveal: ["INVESTIGATOR", "REVIEWER", "ADMIN"],
  decide: ["REVIEWER", "INVESTIGATOR", "ADMIN"],
  createAnchor: ["INVESTIGATOR", "REVIEWER", "ANALYST", "ADMIN"],
  listAnchors: ["INVESTIGATOR", "REVIEWER", "ANALYST", "ADMIN", "AUDITOR"],
  report: ["INVESTIGATOR", "REVIEWER", "ANALYST", "ADMIN"],
  globalAudit: ["AUDITOR", "ADMIN"],
  createCase: ["INVESTIGATOR", "ADMIN"],
};

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrator",
  AUDITOR: "Auditor",
  INVESTIGATOR: "Investigator",
  EVIDENCE_OFFICER: "Evidence officer",
  REVIEWER: "Reviewer",
  ANALYST: "Analyst",
};

export function can(role: string | undefined | null, capability: Capability): boolean {
  return !!role && RULES[capability].includes(role);
}

export function roleLabel(role: string | undefined | null): string {
  return (role && ROLE_LABEL[role]) || role || "Unknown role";
}

/** Plain-language reason for a disabled control, e.g. "Your role (Analyst) cannot record review decisions." */
export function deniedReason(role: string | undefined | null, what: string): string {
  return `Your role (${roleLabel(role)}) cannot ${what}.`;
}

/** Human-readable list of what a role may do — shown on the Account page. */
export const CAPABILITY_TEXT: Record<Capability, string> = {
  upload: "Upload and reprocess evidence",
  downloadOriginal: "Download original (unmasked) files, with a recorded reason",
  reveal: "Reveal masked values, with a recorded reason",
  decide: "Record and reverse review decisions",
  createAnchor: "Create integrity anchors",
  listAnchors: "View integrity anchors",
  report: "Generate case reports and the integrity-reference PDF",
  globalAudit: "View the audit log across all cases",
  createCase: "Create cases",
};

export const ALL_CAPABILITIES = Object.keys(RULES) as Capability[];
