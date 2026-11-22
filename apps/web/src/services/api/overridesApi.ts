import { get, post } from "./real_client";

/** Mirrors apps/api/app/services/overrides.py override_out(). Times are UTC ISO strings ending in Z. */
export interface PermissionOverride {
  override_id: string;
  effect: "ALLOW" | "DENY";
  action: string;
  subject_type: "USER" | "ROLE";
  subject: string;
  subject_username: string | null;
  case_id: string | null;
  resource_type: string | null;
  resource_id: string | null;
  reason: string;
  starts_at: string;
  expires_at: string;
  status: "PENDING" | "ACTIVE" | "REJECTED" | "REVOKED";
  effective_status: "PENDING" | "ACTIVE" | "SCHEDULED" | "EXPIRED" | "REJECTED" | "REVOKED";
  created_by: string;
  created_by_username: string | null;
  created_at: string;
  approved_by: string | null;
  approved_by_username: string | null;
  approved_at: string | null;
  decided_reason: string | null;
  revoked_by: string | null;
  revoked_by_username: string | null;
  revoked_at: string | null;
  revoke_reason: string | null;
}

export interface OverrideHistoryEntry { event: string; actor_id: string; at: string; reason: string | null; snapshot: Record<string, unknown> }
export interface OverrideDetail extends PermissionOverride { history: OverrideHistoryEntry[] }

export interface OverrideMeta {
  overridable_actions: string[];
  mandatory_actions: string[];
  resource_types: string[];
  max_duration_days: number;
  precedence: string[];
}

export type OverrideStatusFilter = "all" | "active" | "pending" | "scheduled" | "expired" | "revoked" | "rejected";

export interface OverrideCreate {
  effect: "ALLOW" | "DENY";
  action: string;
  subject_type: "USER" | "ROLE";
  subject: string;
  case_id?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
  reason: string;
  starts_at?: string | null;
  expires_at: string;
}

/** GET /permission-overrides (ADMIN, AUDITOR). */
export function listOverrides(status: OverrideStatusFilter = "all"): Promise<PermissionOverride[]> {
  return get(`/permission-overrides?status=${encodeURIComponent(status)}`);
}

export function getOverride(id: string): Promise<OverrideDetail> {
  return get(`/permission-overrides/${encodeURIComponent(id)}`);
}

export function getOverrideMeta(): Promise<OverrideMeta> {
  return get(`/permission-overrides/meta`);
}

/** POST /permission-overrides (ADMIN). ALLOW starts PENDING and needs another administrator's approval. */
export function createOverride(body: OverrideCreate): Promise<PermissionOverride> {
  return post(`/permission-overrides`, body);
}

export function approveOverride(id: string, note?: string): Promise<PermissionOverride> {
  return post(`/permission-overrides/${encodeURIComponent(id)}/approve`, { note: note || null });
}

export function rejectOverride(id: string, reason: string): Promise<PermissionOverride> {
  return post(`/permission-overrides/${encodeURIComponent(id)}/reject`, { reason });
}

export function revokeOverride(id: string, reason: string): Promise<PermissionOverride> {
  return post(`/permission-overrides/${encodeURIComponent(id)}/revoke`, { reason });
}

export interface EffectivePermissions {
  role: string;
  case_id: string | null;
  capabilities: Record<string, { allowed: boolean; source: string }>;
}

/** GET /auth/me/permissions: what the server will decide for the signed-in user (overrides included). */
export function getMyPermissions(caseId?: string): Promise<EffectivePermissions> {
  return get(`/auth/me/permissions${caseId ? `?case_id=${encodeURIComponent(caseId)}` : ""}`);
}
