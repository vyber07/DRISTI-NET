import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type AppNotification, getUnreadCount, listNotifications, markAllRead, markRead } from "@/services/api/notificationsApi";

const POLL_MS = 60_000;

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * Notification bell (GET /notifications). Status changes of your requests, and new requests for administrators.
 * Polls the unread count every minute, when the window regains focus and on navigation; opens a list on click.
 * The server returns only the signed-in user's own notifications.
 */
export function NotificationsBell() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(() => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    getUnreadCount().then((r) => setUnread(r.unread)).catch(() => { /* the bell stays as it was; pages show real errors */ });
  }, []);

  useEffect(() => {
    refreshCount();
    const t = setInterval(refreshCount, POLL_MS);
    window.addEventListener("focus", refreshCount);
    return () => { clearInterval(t); window.removeEventListener("focus", refreshCount); };
  }, [refreshCount]);
  useEffect(() => { refreshCount(); setOpen(false); }, [pathname, refreshCount]);

  useEffect(() => {
    if (!open) return;
    setItems(null); setError(null);
    listNotifications().then((p) => setItems(p.items)).catch((e) => { setItems([]); setError(e?.message || "Could not load notifications."); });
    const outside = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", esc); };
  }, [open]);

  const openItem = async (n: AppNotification) => {
    if (!n.read_at) {
      try { const r = await markRead(n.notification_id); setUnread(r.unread); } catch { /* navigation still works */ }
    }
    setOpen(false);
    if (n.link && n.link.startsWith("/")) navigate(n.link);
  };

  const readAll = async () => {
    try {
      await markAllRead();
      setUnread(0);
      setItems((xs) => xs?.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })) ?? xs);
    } catch (e: any) { setError(e?.message || "Could not mark notifications as read."); }
  };

  return (
    <div className="relative" ref={box}>
      <Button variant="ghost" size="sm" className="relative" aria-haspopup="true" aria-expanded={open} data-testid="notifications-bell"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} onClick={() => setOpen((o) => !o)}>
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-critical-red px-1 text-center text-[10px] font-semibold leading-[18px] text-white" aria-hidden="true">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Button>
      {open && (
        <div role="dialog" aria-label="Notifications"
          className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-border-subtle bg-surface-1 shadow-panel">
          <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2">
            <span className="text-sm font-semibold">Notifications</span>
            <button type="button" className="text-xs text-electric-blue hover:underline disabled:text-text-muted disabled:no-underline"
              onClick={() => void readAll()} disabled={unread === 0}>Mark all as read</button>
          </div>
          <div className="max-h-96 overflow-y-auto" data-testid="notifications-list">
            {error && <p className="px-3 py-3 text-sm text-critical-red" role="alert">{error}</p>}
            {items === null ? <p className="px-3 py-6 text-center text-sm text-text-secondary">Loading…</p>
              : items.length === 0 && !error ? <p className="px-3 py-6 text-center text-sm text-text-secondary">No notifications yet.</p>
              : (
                <ul className="divide-y divide-border-subtle">
                  {items.map((n) => (
                    <li key={n.notification_id}>
                      <button type="button" onClick={() => void openItem(n)}
                        className={`block w-full px-3 py-2.5 text-left hover:bg-surface-2 ${n.read_at ? "" : "bg-electric-blue/5"}`}>
                        <span className="flex items-start gap-2">
                          {!n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-electric-blue" aria-label="unread" />}
                          <span className="min-w-0">
                            <span className="block text-sm text-text-primary">{n.title}</span>
                            {n.body && <span className="mt-0.5 block text-xs text-text-secondary line-clamp-2">{n.body}</span>}
                            <span className="mt-0.5 block text-[11px] text-text-muted">{ago(n.created_at)}</span>
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
          </div>
        </div>
      )}
    </div>
  );
}
