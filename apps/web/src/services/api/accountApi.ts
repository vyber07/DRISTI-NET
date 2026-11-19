import { get, patch, post } from "./real_client";

/** Self-service account calls (P2.3, apps/api/app/routes/account_routes.py). All act on the signed-in user only. */

export interface MyProfile {
  user_id: string;
  org_user_id: string | null;
  username: string;
  display_name: string;
  role: string;
  jurisdiction: string;
  office_id: string | null;
  active: boolean;
  assigned_cases?: string[];
}

export interface MySession {
  /** One-way hash of the session id (the raw id is never sent). */
  id: string;
  current: boolean;
  status: "active" | "revoked" | "expired";
  created_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  ip_address: string | null;
  user_agent: string;
}

export interface MyActivity {
  at: string | null;
  action: string;
  outcome: string;
  reason: string | null;
  ip_address: string | null;
  /** Username of the administrator who acted on this account; null for the account's own actions. */
  by: string | null;
}

export const getMyProfile = () => get<MyProfile>("/auth/me");
export const updateMyDisplayName = (display_name: string) => patch<MyProfile>("/auth/me", { display_name });
export const changeMyPassword = (current_password: string, new_password: string) =>
  post<{ ok: boolean; token: string; other_sessions_revoked: number }>("/auth/me/password", { current_password, new_password });
export const getMySessions = () => get<{ sessions: MySession[] }>("/auth/me/sessions");
export const revokeMySession = (id: string) => post<{ ok: boolean; revoked: number }>(`/auth/me/sessions/${encodeURIComponent(id)}/revoke`);
export const revokeMyOtherSessions = () => post<{ ok: boolean; revoked: number }>("/auth/me/sessions/revoke-others");
export const getMyActivity = (limit = 30) => get<{ events: MyActivity[] }>(`/auth/me/activity?limit=${limit}`);
