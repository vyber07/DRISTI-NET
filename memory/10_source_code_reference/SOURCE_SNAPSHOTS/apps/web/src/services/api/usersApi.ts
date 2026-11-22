import { get, patch, post } from "./real_client";

/** Mirrors apps/api/app/routes/auth_routes.py's user_out(); admin-management view of a user. */
export interface AdminUser {
  user_id: string;
  username: string;
  display_name: string;
  role: string;
  jurisdiction: string;
  active: boolean;
}

/** GET /users — every account, any status (ADMIN/AUDITOR/INVESTIGATOR may call this; others get 403). */
export function listAllUsers(): Promise<AdminUser[]> {
  return get(`/users`);
}

/** POST /users (ADMIN only). */
export function createUser(body: { username: string; display_name: string; role: string; jurisdiction: string; password: string }): Promise<AdminUser> {
  return post(`/users`, body);
}

/** PATCH /users/{id} (ADMIN only) — only the given fields change. */
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
