import { useCallback, useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import { Check, KeyRound, LogOut, Minus, MonitorSmartphone, Pencil, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, FactList, LoadingState, PageBody, PageHeader, Section } from "@/components/layout/page";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useAuthStore } from "@/stores/authStore";
import { ALL_CAPABILITIES, CAPABILITY_TEXT, can, roleLabel } from "@/lib/permissions";
import { listCases } from "@/services/api/casesApi";
import { setSession } from "@/services/api/real_client";
import {
  type MyActivity, type MyProfile, type MySession, changeMyPassword, getMyActivity, getMyProfile, getMySessions,
  revokeMyOtherSessions, revokeMySession, updateMyDisplayName,
} from "@/services/api/accountApi";
import type { CaseSummary } from "@/types/case";

const field = "mt-1 block w-full rounded-md border border-border-strong bg-surface-1 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-electric-blue-soft";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
}

/** Short, readable description of a browser user agent (never shown raw in full). */
function deviceText(ua: string): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /python|httpx|curl|testclient/i.test(ua) ? "API client" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

const ACTIVITY_TEXT: Record<string, string> = {
  LOGIN: "Signed in", LOGOUT: "Signed out", PASSWORD_CHANGE: "Changed password", PROFILE_UPDATE: "Updated display name",
  SESSION_REVOKE: "Signed out other sessions", USER_UPDATE: "Account details changed", USER_PASSWORD_RESET: "Password reset by an administrator",
  USER_DEACTIVATE: "Account deactivated", USER_REACTIVATE: "Account reactivated", USER_UNLOCK: "Sign-in lock cleared",
  USER_ID_ASSIGN: "User ID allocated", USER_ID_CHANGE: "User ID changed", USER_ID_CORRECT: "User ID corrected",
  USER_ID_RETIRE: "User ID retired", USER_CREATE: "Account created", ACCOUNT_LOCKED: "Sign-in locked after failed attempts",
};
function activityText(a: MyActivity): string {
  if (a.action === "LOGIN" && a.outcome !== "OK") return a.reason === "rate limited" ? "Sign-in blocked (too many attempts)" : "Failed sign-in";
  if (a.action === "PASSWORD_CHANGE" && a.outcome !== "OK") return "Password change refused";
  return ACTIVITY_TEXT[a.action] ?? a.action;
}

/** Display name: the one field users edit themselves (PATCH /auth/me). */
function NameEditor({ profile, onSaved }: { profile: MyProfile; onSaved: (p: MyProfile) => void }) {
  const ids = { name: useId(), err: useId() };
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(profile.display_name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!editing) {
    return (
      <span className="flex flex-wrap items-center gap-2">
        {profile.display_name}
        <Button variant="ghost" size="sm" className="h-7 px-2 gap-1" onClick={() => { setValue(profile.display_name); setError(null); setEditing(true); }}
          aria-label="Edit display name"><Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit</Button>
      </span>
    );
  }
  const save = async () => {
    setBusy(true); setError(null);
    try { onSaved(await updateMyDisplayName(value)); setEditing(false); }
    catch (e: any) { setError(e?.code === "UNCHANGED" ? "That is already your display name." : e?.message || "The name was not saved."); }
    finally { setBusy(false); }
  };
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <label htmlFor={ids.name} className="sr-only">Display name</label>
      <input id={ids.name} value={value} onChange={(e) => setValue(e.target.value)} className={field} required minLength={2} maxLength={120}
        aria-describedby={error ? ids.err : undefined} autoFocus />
      {error && <p id={ids.err} role="alert" className="text-sm text-critical-red">{error}</p>}
      <span className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={busy || value.trim().length < 2}>{busy ? "Saving…" : "Save"}</Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(false)} disabled={busy}>Cancel</Button>
      </span>
    </form>
  );
}

function PasswordForm({ onChanged }: { onChanged: () => void }) {
  const ids = { cur: useId(), next: useId(), again: useId(), msg: useId() };
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null); setNotice(null);
    if (next.length < 8) return setError("The new password needs at least 8 characters.");
    if (next !== again) return setError("The two new passwords do not match.");
    setBusy(true);
    try {
      const r = await changeMyPassword(current, next);
      // The server invalidated every earlier token (including this one) and returned a fresh one for this session.
      const st = useAuthStore.getState();
      if (st.user) setSession(r.token, st.user as any);
      useAuthStore.setState({ token: r.token });
      setCurrent(""); setNext(""); setAgain("");
      setNotice(r.other_sessions_revoked
        ? `Password changed. ${r.other_sessions_revoked} other session${r.other_sessions_revoked === 1 ? " was" : "s were"} signed out.`
        : "Password changed.");
      onChanged();
    } catch (e: any) {
      setError(e?.code === "CURRENT_PASSWORD_INVALID" ? "The current password is not correct."
        : e?.code === "PASSWORD_UNCHANGED" ? "Choose a password different from the current one."
        : e?.code === "PASSWORD_WEAK" ? "The new password must not be your username."
        : e?.status === 429 ? "Too many failed attempts. Wait a while and try again."
        : e?.message || "The password was not changed.");
    } finally { setBusy(false); }
  };

  return (
    <form className="grid max-w-md gap-3" onSubmit={(e) => { e.preventDefault(); void submit(); }} aria-describedby={error || notice ? ids.msg : undefined}>
      <div>
        <label htmlFor={ids.cur} className="text-sm font-medium">Current password</label>
        <input id={ids.cur} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={field} required maxLength={200} />
      </div>
      <div>
        <label htmlFor={ids.next} className="text-sm font-medium">New password</label>
        <input id={ids.next} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={field} required minLength={8} maxLength={200} />
        <p className="mt-1 text-xs text-text-secondary">At least 8 characters, not your username.</p>
      </div>
      <div>
        <label htmlFor={ids.again} className="text-sm font-medium">New password again</label>
        <input id={ids.again} type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} className={field} required minLength={8} maxLength={200} />
      </div>
      {error && <p id={ids.msg} role="alert" className="text-sm text-critical-red">{error}</p>}
      {notice && <p id={ids.msg} role="status" className="text-sm text-verified-emerald">{notice}</p>}
      <div><Button type="submit" variant="primary" disabled={busy || !current || !next || !again}>{busy ? "Changing…" : "Change password"}</Button></div>
    </form>
  );
}

function SessionsSection({ refreshKey }: { refreshKey: number }) {
  const [sessions, setSessions] = useState<MySession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { confirm, confirmDialog } = useConfirm();

  const load = useCallback(() => {
    setError(null);
    getMySessions().then((r) => setSessions(r.sessions)).catch((e) => setError(e?.message || "Sessions could not be loaded."));
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  const others = (sessions ?? []).filter((s) => s.status === "active" && !s.current);
  const act = async (fn: () => Promise<{ revoked: number }>, title: string, description: string) => {
    if (!(await confirm({ title, description, confirmLabel: "Sign out", destructive: true }))) return;
    setBusy(true); setNotice(null);
    try { const r = await fn(); setNotice(`${r.revoked} session${r.revoked === 1 ? "" : "s"} signed out.`); load(); }
    catch (e: any) { setError(e?.message || "The session was not signed out."); }
    finally { setBusy(false); }
  };

  return (
    <Section id="sessions" icon={<MonitorSmartphone className="h-4 w-4" />} title="Signed-in sessions"
      description="Where this account is signed in. Signing a session out ends it on that device at its next request."
      actions={others.length > 0 ? <Button variant="secondary" size="sm" disabled={busy}
        onClick={() => act(revokeMyOtherSessions, "Sign out all other sessions?", "Every session except this one ends at its next request.")}>Sign out other sessions</Button> : undefined}>
      {error ? <ErrorState message={error} onRetry={load} />
        : sessions === null ? <LoadingState label="Loading sessions…" rows={2} />
        : sessions.length === 0 ? <EmptyState title="No sessions recorded" />
        : (
          <ul className="divide-y divide-border-subtle" data-testid="my-sessions">
            {sessions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="min-w-0">
                  <span className="text-text-primary">{deviceText(s.user_agent)}</span>
                  {s.current && <Badge tone="emerald" className="ml-2">This session</Badge>}
                  {s.status !== "active" && <Badge tone="gray" className="ml-2">{s.status === "revoked" ? "Signed out" : "Expired"}</Badge>}
                  <span className="block text-xs text-text-secondary">
                    Signed in {fmt(s.created_at)}{s.ip_address ? ` · ${s.ip_address}` : ""}{s.status === "active" ? ` · until ${fmt(s.expires_at)}` : ""}
                  </span>
                </span>
                {s.status === "active" && !s.current && (
                  <Button variant="ghost" size="sm" disabled={busy}
                    onClick={() => act(() => revokeMySession(s.id), "Sign out this session?", `${deviceText(s.user_agent)}, signed in ${fmt(s.created_at)}.`)}>Sign out</Button>
                )}
              </li>
            ))}
          </ul>
        )}
      {notice && <p role="status" className="mt-2 text-sm text-verified-emerald">{notice}</p>}
      {confirmDialog}
    </Section>
  );
}

function ActivitySection({ refreshKey }: { refreshKey: number }) {
  const [events, setEvents] = useState<MyActivity[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    setError(null);
    getMyActivity().then((r) => setEvents(r.events)).catch((e) => setError(e?.message || "Activity could not be loaded."));
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);
  return (
    <Section id="activity" title="Recent account activity"
      description="Sign-ins, failed sign-ins that named your username, and changes to your account. If something here was not you, change your password and tell an administrator.">
      {error ? <ErrorState message={error} onRetry={load} />
        : events === null ? <LoadingState label="Loading activity…" rows={3} />
        : events.length === 0 ? <EmptyState title="No account activity recorded yet" />
        : (
          <ul className="divide-y divide-border-subtle" data-testid="my-activity">
            {events.map((a, i) => (
              <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm">
                <span className="flex items-center gap-2">
                  {a.outcome !== "OK" && <Badge tone="red">Refused</Badge>}
                  <span className="text-text-primary">{activityText(a)}</span>
                  {a.by && <span className="text-xs text-text-secondary">by {a.by}</span>}
                </span>
                <span className="text-xs text-text-secondary">{fmt(a.at)}{a.ip_address ? ` · ${a.ip_address}` : ""}</span>
              </li>
            ))}
          </ul>
        )}
    </Section>
  );
}

/**
 * Account page (P2.3). What the server knows about the signed-in user, what they may change themselves (display name,
 * password, their own sessions) and what only an administrator may change (role, jurisdiction, office, user ID,
 * username, status — the server refuses those on /auth/me). Recent sign-ins and account changes come from the audit log.
 * No profile photo: there is no avatar storage, and image upload would have to go through the evidence upload and
 * malware-scanning pipeline (docs/frontend/PROFILE.md).
 */
export function ProfilePage() {
  const { user, logout } = useAuthStore();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [cases, setCases] = useState<CaseSummary[] | null>(null);
  const [casesError, setCasesError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadProfile = useCallback(() => {
    setProfileError(null);
    getMyProfile().then(setProfile).catch((e) => setProfileError(e?.message || "Your account details could not be loaded."));
  }, []);
  useEffect(() => {
    loadProfile();
    listCases().then((r) => setCases(r.data)).catch((e) => setCasesError(e?.message || "unavailable"));
  }, [loadProfile]);

  const onNameSaved = (p: MyProfile) => {
    setProfile(p);
    const st = useAuthStore.getState();
    if (st.user) {
      const next = { ...st.user, display_name: p.display_name };
      useAuthStore.setState({ user: next });
      if (st.token) setSession(st.token, next as any);
    }
    setRefreshKey((k) => k + 1);
  };

  if (!user) return null;
  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <PageHeader icon={<UserRound className="h-5 w-5" />} title="Account" description="Who you are signed in as, what your role allows, and your password and sessions." />
      <PageBody>
        <Section title="Signed in as" description={<>Only your display name can be changed here. Role, jurisdiction, office, user ID and username are managed by an administrator; to change one, <Link to="/requests" className="text-electric-blue underline underline-offset-2">raise a request</Link>.</>}>
          {profileError ? <ErrorState message={profileError} onRetry={loadProfile} />
            : profile === null ? <LoadingState label="Loading your account…" rows={3} />
            : (
              <FactList columns={2} items={[
                { label: "Name", value: <NameEditor profile={profile} onSaved={onNameSaved} /> },
                { label: "Username", value: <span className="font-mono">{profile.username}</span> },
                { label: "User ID", value: profile.org_user_id ? <span className="font-mono">{profile.org_user_id}</span>
                    : <span className="text-text-secondary">Not allocated yet (an administrator assigns it)</span> },
                { label: "Role", value: roleLabel(profile.role) },
                { label: "Jurisdiction", value: profile.jurisdiction || "—" },
                { label: "Office", value: profile.office_id ? <span className="font-mono">{profile.office_id}</span> : <span className="text-text-secondary">Not assigned</span> },
                { label: "Account status", value: <Badge tone={profile.active ? "emerald" : "gray"}>{profile.active ? "Active" : "Deactivated"}</Badge> },
                { label: "Internal reference", value: <span className="font-mono text-xs text-text-secondary">{profile.user_id}</span> },
              ]} />
            )}
        </Section>

        <Section id="password" icon={<KeyRound className="h-4 w-4" />} title="Change password"
          description="You need your current password. Changing it signs out your other sessions; this one stays signed in. Failed attempts count toward the sign-in lockout.">
          <PasswordForm onChanged={() => setRefreshKey((k) => k + 1)} />
        </Section>

        <SessionsSection refreshKey={refreshKey} />
        <ActivitySection refreshKey={refreshKey} />

        <Section title="What your role allows" description="The server checks every request; this list explains why some buttons are unavailable to you.">
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {ALL_CAPABILITIES.map((c) => {
              const ok = can(user.role, c);
              return (
                <li key={c} className="flex items-start gap-2 text-sm">
                  {ok ? <Check className="h-4 w-4 text-verified-emerald mt-0.5 shrink-0" aria-hidden="true" />
                      : <Minus className="h-4 w-4 text-text-muted mt-0.5 shrink-0" aria-hidden="true" />}
                  <span className={ok ? "text-text-primary" : "text-text-secondary"}>
                    {CAPABILITY_TEXT[c]}<span className="sr-only">{ok ? " — allowed" : " — not allowed"}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </Section>

        <Section title="Your cases" description="Cases are visible only through assignment within your jurisdiction (administrators and auditors see all).">
          {casesError ? <p className="text-sm text-text-secondary">Case list unavailable: {casesError}</p>
            : cases === null ? <p className="text-sm text-text-secondary">Loading…</p>
            : cases.length === 0 ? <p className="text-sm text-text-secondary">No cases are assigned to you.</p>
            : (
              <ul className="divide-y divide-border-subtle">
                {cases.map((c) => (
                  <li key={c.id} className="py-2 flex items-center justify-between gap-3">
                    <Link to={`/cases/${encodeURIComponent(c.id)}`} className="text-sm text-electric-blue hover:underline min-w-0 truncate">
                      {c.title} <span className="font-mono text-xs text-text-secondary">{c.id}</span>
                    </Link>
                    <span className="text-xs text-text-secondary shrink-0">{c.jurisdiction}</span>
                  </li>
                ))}
              </ul>
            )}
        </Section>

        <Section title="Session">
          <p className="text-sm text-text-secondary mb-3">
            Signing out clears this browser's session and every loaded case view. Your session token is kept in this browser's local storage until you sign out.
          </p>
          <Button variant="secondary" className="gap-1.5" onClick={() => logout()}>
            <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
          </Button>
        </Section>
      </PageBody>
    </div>
  );
}
