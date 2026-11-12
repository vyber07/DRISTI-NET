import { get, patch, post, put } from "./real_client";

/** Mirrors apps/api/app/routes/auth_routes.py's user_out(); admin-management view of a user. */
export interface AdminUser {
  /** Internal account key (USR-…): stable, used in API paths. */
  user_id: string;
  /** Organisational user ID (ADR-019) shown to people as "User ID"; null = not allocated. */
  org_user_id: string | null;
  username: string;
  display_name: string;
  role: string;
  jurisdiction: string;
  office_id?: string | null;
  active: boolean;
}

/** One allocation of an organisational user ID (GET /users/{id}/org-user-id/history). */
export interface OrgUserIdAllocation {
  assignment_id: number;
  org_user_id: string;
  user_id: string;
  username: string | null;
  status: "ACTIVE" | "RETIRED" | "VOIDED";
  assigned_by: string;
  assigned_by_username: string | null;
  assigned_at: string;
  assign_reason: string;
  ended_by: string | null;
  ended_by_username: string | null;
  ended_at: string | null;
  end_reason: string | null;
}

/** GET /users — every account, any status (ADMIN/AUDITOR/INVESTIGATOR may call this; others get 403). */
export function listAllUsers(): Promise<AdminUser[]> {
  return get(`/users`);
}

/** POST /users (ADMIN only). org_user_id is optional; omit it to allocate later. */
export function createUser(body: { username: string; display_name: string; role: string; jurisdiction: string; password: string; org_user_id?: string }): Promise<AdminUser> {
  return post(`/users`, body);
}

/** PATCH /users/{id} (ADMIN only) — only the given fields change. The user ID is not changeable here. */
export function updateUser(userId: string, body: { display_name?: string; role?: string; jurisdiction?: string }): Promise<AdminUser> {
  return patch(`/users/${userId}`, body);
}

/** POST /users/{id}/deactivate (ADMIN only; refused for your own account). */
export function deactivateUser(userId: string): Promise<AdminUser> {
  return post(`/users/${userId}/deactivate`);
}

/** POST /users/{id}/reactivate (ADMIN only). */
export function reactivateUser(userId: string): Promise<AdminUser> {
  return post(`/users/${userId}/reactivate`);
}

/** POST /users/{id}/reset-password (ADMIN only). */
export function resetUserPassword(userId: string, newPassword: string): Promise<{ ok: boolean }> {
  return post(`/users/${userId}/reset-password`, { new_password: newPassword });
}

interface OrgUserIdChange { user_id: string; org_user_id: string | null; previous_org_user_id: string | null; previous_status: string | null; user: AdminUser }

/** PUT /users/{id}/org-user-id (ADMIN only, never your own). `current` must be the ID you last saw (null = none):
 *  a 409 ORG_USER_ID_STALE means someone else changed it first. */
export function assignOrgUserId(userId: string, body: { org_user_id: string; current_org_user_id: string | null; reason: string; correction?: boolean }): Promise<OrgUserIdChange> {
  return put(`/users/${userId}/org-user-id`, body);
}

/** POST /users/{id}/org-user-id/retire (ADMIN only, never your own). The retired ID can never be allocated again. */
export function retireOrgUserId(userId: string, body: { current_org_user_id: string | null; reason: string }): Promise<OrgUserIdChange> {
  return post(`/users/${userId}/org-user-id/retire`, body);
}

/** GET /users/{id}/org-user-id/history (ADMIN, AUDITOR). Newest first. */
export function getOrgUserIdHistory(userId: string): Promise<{ user_id: string; org_user_id: string | null; history: OrgUserIdAllocation[] }> {
  return get(`/users/${userId}/org-user-id/history`);
}
