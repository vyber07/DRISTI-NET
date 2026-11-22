import { get, getPaged, post, type Paged } from "./real_client";

/** Mirrors apps/api/app/services/case_assignments.py (docs/CASE_ASSIGNMENT.md). */
export type AccessStatus = "OK" | "DEACTIVATED" | "JURISDICTION_MISMATCH" | "DENIED_BY_OVERRIDE" | "UNKNOWN_USER";

export interface TeamPerson {
  user_id: string;
  org_user_id: string | null;
  username: string | null;
  display_name: string | null;
  role: string | null;
  jurisdiction: string | null;
  active: boolean;
}

export interface TeamMember extends TeamPerson {
  purpose: string;
  is_primary: boolean;
  assigned_by: string | null;
  assigned_by_username: string | null;
  assigned_at: string | null;
  reason: string | null;
  /** Whether this person can actually open the case right now (the server's authorize_case rules). */
  access: AccessStatus;
}

export interface CaseAssignmentOverview {
  case_id: string;
  title: string;
  jurisdiction: string;
  primary: TeamMember | null;
  member_count: number;
  blocked_count: number;
  issues: string[];
}

export interface AssignmentEvent {
  event_id: string;
  event: "ASSIGNED" | "REMOVED" | "PRIMARY_SET" | "PRIMARY_RELEASED";
  user: TeamPerson;
  purpose: string | null;
  actor_id: string;
  actor_username: string | null;
  actor_role: string;
  at: string;
  reason: string;
  detail: Record<string, unknown>;
}

export interface CaseAssignmentDetail extends CaseAssignmentOverview {
  members: TeamMember[];
  history: AssignmentEvent[];
}

/** GET /case-assignments (ADMIN, AUDITOR). */
export function listCaseAssignments(opts: { q?: string; jurisdiction?: string; attention?: boolean; unstaffed?: boolean; limit: number; offset: number }): Promise<Paged<CaseAssignmentOverview>> {
  return getPaged(`/case-assignments`, { q: opts.q || undefined, jurisdiction: opts.jurisdiction || undefined,
    attention: opts.attention || undefined, unstaffed: opts.unstaffed || undefined, limit: opts.limit, offset: opts.offset });
}

/** GET /cases/{id}/assignments (ADMIN, AUDITOR): the team with effective access, and the history. */
export function getCaseAssignments(caseId: string): Promise<CaseAssignmentDetail> {
  return get(`/cases/${encodeURIComponent(caseId)}/assignments`);
}

/** POST /cases/{id}/assign (ADMIN or the primary investigator). */
export function assignToCase(caseId: string, body: { user_id?: string; username?: string; purpose: string; reason: string }) {
  return post(`/cases/${encodeURIComponent(caseId)}/assign`, body);
}

/** POST /cases/{id}/assignments/{user}/remove (ADMIN). Access ends on the person's next request. */
export function removeFromCase(caseId: string, userId: string, reason: string): Promise<{ removed: boolean; access_remains_via_override: boolean }> {
  return post(`/cases/${encodeURIComponent(caseId)}/assignments/${encodeURIComponent(userId)}/remove`, { reason });
}

/** POST /cases/{id}/primary (ADMIN): hand the case over. 409 PRIMARY_CHANGED if expected is stale. */
export function changePrimary(caseId: string, body: { user_id: string; expected_primary_id: string | null; reason: string; previous: "KEEP" | "REMOVE" }) {
  return post(`/cases/${encodeURIComponent(caseId)}/primary`, body);
}
