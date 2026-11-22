import { get, getPaged, post } from "./real_client";

/** Mirrors apps/api/app/routes/notification_routes.py. Each user only ever sees their own. */
export interface AppNotification {
  notification_id: string; kind: string; title: string; body: string; link: string | null; request_id: number | null;
  created_at: string; read_at: string | null;
}

export const getUnreadCount = () => get<{ unread: number }>("/notifications/unread-count");
export const listNotifications = (limit = 15) => getPaged<AppNotification>("/notifications", { limit, offset: 0 });
export const markRead = (id: string) => post<AppNotification & { unread: number }>(`/notifications/${encodeURIComponent(id)}/read`);
export const markAllRead = () => post<{ marked: number; unread: number }>("/notifications/read-all");
