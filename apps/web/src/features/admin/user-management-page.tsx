import { useEffect, useId, useState } from "react";
import { UserPlus, KeyRound, Ban, RotateCcw, Pencil, AlertTriangle, RefreshCw, IdCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DeniedState } from "@/components/layout/page";
import { useAuthStore } from "@/stores/authStore";
import { can, deniedReason, roleLabel, ALL_ROLES } from "@/lib/permissions";
import {
  type AdminUser, type OrgUserIdAllocation, listAllUsers, createUser, updateUser, deactivateUser, reactivateUser,
  resetUserPassword, assignOrgUserId, retireOrgUserId, getOrgUserIdHistory,
} from "@/services/api/usersApi";

/** Mirrors services/org_user_ids.normalize: 3-32 of A-Z, 0-9 and single inner hyphens, not starting with "USR-".
 *  The server is authoritative (its pattern is configurable); this only gives earlier feedback. */
const ORG_ID_HINT = "3–32 letters, digits and single hyphens, e.g. DL-04217";
const ORG_ID_ERRORS: Record<string, string> = {
  ORG_USER_ID_IN_USE: "That user ID is assigned to another account.",
  ORG_USER_ID_RETIRED: "That user ID was used before and can never be reused.",
  ORG_USER_ID_UNCHANGED: "This account already holds that user ID.",
  ORG_USER_ID_STALE: "Someone changed this user's ID since you opened it. Close and reopen to see the current value.",
  ORG_USER_ID_CONFLICT: "Another change took that user ID at the same moment. Reload and try again.",
  ORG_USER_ID_RESERVED: "User IDs may not start with USR- (reserved for internal account keys).",
  ORG_USER_ID_INVALID: `Invalid format: ${ORG_ID_HINT}.`,
  SELF_CHANGE_FORBIDDEN: "Another administrator must change your own user ID.",
  CORRECTION_WINDOW_PASSED: "The current ID is too old to void as a correction; it can only be retired.",
  CORRECTION_DISABLED: "Corrections are turned off on this server.",
  REASON_REQUIRED: "Give a reason of at least 5 characters.",
};
function orgIdError(e: any, fallback: string): string {
  return (e?.code && ORG_ID_ERRORS[e.code]) || e?.message || fallback;
}

const field = "mt-1 block w-full rounded-md border border-border-strong bg-surface-1 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-electric-blue-soft";

function CreateUserDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const ids = { username: useId(), name: useId(), role: useId(), jur: useId(), pw: useId(), err: useId(), org: useId(), orgHint: useId() };
  const [username, setUsername] = useState("");
  const [orgUserId, setOrgUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState(ALL_ROLES[0]);
  const [jurisdiction, setJurisdiction] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUsername(""); setOrgUserId(""); setDisplayName(""); setRole(ALL_ROLES[0]); setJurisdiction(""); setPassword(""); setError(null);
  }, [open]);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const org = orgUserId.trim();
      await createUser({ username: username.trim(), display_name: displayName.trim(), role, jurisdiction: jurisdiction.trim(), password, ...(org ? { org_user_id: org } : {}) });
      onCreated();
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.code && ORG_ID_ERRORS[e.code] ? ORG_ID_ERRORS[e.code]
        : e?.status === 409 ? "That username is already taken."
        : e?.status === 422 ? "Check the fields: username (lowercase/digits/._-), display name, user ID, and password (8+ characters)."
        : (e?.message || "Could not create the user."));
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent data-testid="create-user-dialog">
        <DialogHeader>
          <DialogTitle>Create a user</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            Recorded in the audit log. The account can sign in immediately with the password you set here.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <div>
            <label htmlFor={ids.username} className="text-sm font-medium">Username</label>
            <input id={ids.username} value={username} onChange={(e) => setUsername(e.target.value)} className={field} autoFocus required pattern="[a-z0-9_.\-]+" minLength={3} maxLength={40} />
          </div>
          <div>
            <label htmlFor={ids.org} className="text-sm font-medium">User ID <span className="font-normal text-text-secondary">(optional)</span></label>
            <input id={ids.org} value={orgUserId} onChange={(e) => setOrgUserId(e.target.value.toUpperCase())} className={`${field} font-mono`} aria-describedby={ids.orgHint} maxLength={32} autoComplete="off" spellCheck={false} />
            <p id={ids.orgHint} className="mt-1 text-xs text-text-secondary">The organisation's identifier for this person. {ORG_ID_HINT}. Leave empty to allocate later. Once used, an ID is never reused.</p>
          </div>
          <div>
            <label htmlFor={ids.name} className="text-sm font-medium">Display name</label>
            <input id={ids.name} value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={field} required minLength={2} maxLength={120} />
          </div>
          <div>
            <label htmlFor={ids.role} className="text-sm font-medium">Role</label>
            <select id={ids.role} value={role} onChange={(e) => setRole(e.target.value)} className={field}>
              {ALL_ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={ids.jur} className="text-sm font-medium">Jurisdiction</label>
            <input id={ids.jur} value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} className={field} placeholder="e.g. Demo District A" maxLength={120} />
          </div>
          <div>
            <label htmlFor={ids.pw} className="text-sm font-medium">Password</label>
            <input id={ids.pw} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} required minLength={8} maxLength={200} />
          </div>
          {error && <p id={ids.err} role="alert" className="text-sm text-critical-red">{error}</p>}
          <DialogFooter className="gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={busy}>{busy ? "Creating…" : "Create user"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({ target, open, onOpenChange, onSaved }: { target: AdminUser | null; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const ids = { name: useId(), role: useId(), jur: useId(), err: useId() };
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState(ALL_ROLES[0]);
  const [jurisdiction, setJurisdiction] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !target) return;
    setDisplayName(target.display_name); setRole(target.role); setJurisdiction(target.jurisdiction); setError(null);
  }, [open, target]);

  if (!target) return null;

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      await updateUser(target.user_id, { display_name: displayName.trim(), role, jurisdiction: jurisdiction.trim() });
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.message || "Could not update the user.");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent data-testid="edit-user-dialog">
        <DialogHeader>
          <DialogTitle>Edit {target.username}</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            Changing the role changes everything this account may do (apps/web/src/lib/permissions.ts).
            Recorded in the audit log with the before and after values.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <div>
            <label htmlFor={ids.name} className="text-sm font-medium">Display name</label>
            <input id={ids.name} value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={field} autoFocus minLength={2} maxLength={120} />
          </div>
          <div>
            <label htmlFor={ids.role} className="text-sm font-medium">Role</label>
            <select id={ids.role} value={role} onChange={(e) => setRole(e.target.value)} className={field}>
              {ALL_ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={ids.jur} className="text-sm font-medium">Jurisdiction</label>
            <input id={ids.jur} value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} className={field} maxLength={120} />
          </div>
          {error && <p id={ids.err} role="alert" className="text-sm text-critical-red">{error}</p>}
          <DialogFooter className="gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const STATUS_TONE = { ACTIVE: "emerald", RETIRED: "gray", VOIDED: "amber" } as const;

function fmt(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? ts : d.toLocaleString();
}

/** Allocate, change, correct or retire one user's organisational user ID, and show its allocation history. */
function OrgUserIdDialog({ target, isSelf, open, onOpenChange, onSaved }: { target: AdminUser | null; isSelf: boolean; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const ids = { org: useId(), reason: useId(), corr: useId(), err: useId(), hint: useId() };
  const [orgUserId, setOrgUserId] = useState("");
  const [reason, setReason] = useState("");
  const [correction, setCorrection] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [history, setHistory] = useState<OrgUserIdAllocation[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadHistory = (userId: string) => {
    setHistory(null); setHistoryError(null);
    getOrgUserIdHistory(userId)
      .then((h) => { setHistory(h.history); setCurrent(h.org_user_id); })
      .catch((e) => setHistoryError(e?.message || "History unavailable."));
  };

  useEffect(() => {
    if (!open || !target) return;
    setOrgUserId(""); setReason(""); setCorrection(false); setError(null); setNotice(null);
    setCurrent(target.org_user_id);
    loadHistory(target.user_id);
  }, [open, target]);

  if (!target) return null;

  const run = async (fn: () => Promise<{ org_user_id: string | null; previous_org_user_id: string | null; previous_status: string | null }>) => {
    setBusy(true); setError(null); setNotice(null);
    try {
      const r = await fn();
      setCurrent(r.org_user_id);
      setNotice(r.org_user_id
        ? `User ID is now ${r.org_user_id}.${r.previous_org_user_id ? ` ${r.previous_org_user_id} was ${r.previous_status?.toLowerCase()}.` : ""}`
        : `${r.previous_org_user_id} was retired. This account has no user ID now.`);
      setOrgUserId(""); setReason(""); setCorrection(false);
      loadHistory(target.user_id);
      onSaved();
    } catch (e: any) {
      setError(orgIdError(e, "Could not change the user ID."));
    } finally { setBusy(false); }
  };

  const submit = () => run(() => assignOrgUserId(target.user_id, { org_user_id: orgUserId.trim(), current_org_user_id: current, reason: reason.trim(), correction }));
  const retire = () => {
    if (!current) return;
    if (!window.confirm(`Retire ${current}? It can never be allocated to anyone again.`)) return;
    void run(() => retireOrgUserId(target.user_id, { current_org_user_id: current, reason: reason.trim() }));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent data-testid="org-user-id-dialog" className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>User ID for {target.username}</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            Current: <span className="font-mono text-text-primary">{current ?? "not allocated"}</span>.
            A replaced or retired ID is never reused. Every change needs a reason and is recorded in the audit log.
          </DialogDescription>
        </DialogHeader>
        {isSelf ? (
          <p className="text-sm text-text-secondary" role="note">Another administrator must change your own user ID.</p>
        ) : (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
            <div>
              <label htmlFor={ids.org} className="text-sm font-medium">{current ? "New user ID" : "User ID"}</label>
              <input id={ids.org} value={orgUserId} onChange={(e) => setOrgUserId(e.target.value.toUpperCase())} className={`${field} font-mono`}
                     aria-describedby={ids.hint} maxLength={32} autoComplete="off" spellCheck={false} autoFocus />
              <p id={ids.hint} className="mt-1 text-xs text-text-secondary">{ORG_ID_HINT}.</p>
            </div>
            <div>
              <label htmlFor={ids.reason} className="text-sm font-medium">Reason</label>
              <input id={ids.reason} value={reason} onChange={(e) => setReason(e.target.value)} className={field} required minLength={5} maxLength={500}
                     placeholder="e.g. Service number issued by the personnel office" />
            </div>
            {current && (
              <div className="flex items-start gap-2">
                <input id={ids.corr} type="checkbox" checked={correction} onChange={(e) => setCorrection(e.target.checked)} className="mt-1" />
                <label htmlFor={ids.corr} className="text-sm">
                  {current} was assigned in error
                  <span className="block text-xs text-text-secondary">Voids it instead of retiring it, so it can go to the right person. Only allowed shortly after it was allocated.</span>
                </label>
              </div>
            )}
            {error && <p id={ids.err} role="alert" className="text-sm text-critical-red">{error}</p>}
            {notice && <p role="status" className="text-sm text-verified-emerald">{notice}</p>}
            <DialogFooter className="gap-2 pt-1">
              {current && (
                <Button type="button" variant="secondary" onClick={retire} disabled={busy || reason.trim().length < 5}
                        title={reason.trim().length < 5 ? "Enter a reason first" : undefined}>Retire {current}</Button>
              )}
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>Close</Button>
              <Button type="submit" variant="primary" disabled={busy || !orgUserId.trim() || reason.trim().length < 5}>
                {busy ? "Saving…" : current ? "Change user ID" : "Allocate user ID"}
              </Button>
            </DialogFooter>
          </form>
        )}

        <div className="mt-2 border-t border-border-subtle pt-3">
          <h3 className="text-xs font-semibold uppercase text-text-muted mb-2">Allocation history</h3>
          {historyError ? <p className="text-sm text-text-secondary">{historyError}</p>
            : history === null ? <p className="text-sm text-text-secondary">Loading…</p>
            : history.length === 0 ? <p className="text-sm text-text-secondary">No user ID has been allocated to this account.</p>
            : (
              <ul className="space-y-2 max-h-56 overflow-y-auto">
                {history.map((h) => (
                  <li key={h.assignment_id} className="text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-text-primary">{h.org_user_id}</span>
                      <Badge tone={STATUS_TONE[h.status]}>{h.status.toLowerCase()}</Badge>
                    </div>
                    <p className="text-text-secondary">Allocated {fmt(h.assigned_at)} by {h.assigned_by_username ?? h.assigned_by}: {h.assign_reason}</p>
                    {h.ended_at && <p className="text-text-secondary">Ended {fmt(h.ended_at)} by {h.ended_by_username ?? h.ended_by}: {h.end_reason}</p>}
                  </li>
                ))}
              </ul>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ target, open, onOpenChange }: { target: AdminUser | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const ids = { pw: useId(), err: useId() };
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => { if (open) { setPassword(""); setError(null); setDone(false); } }, [open]);

  if (!target) return null;

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      await resetUserPassword(target.user_id, password);
      setDone(true);
    } catch (e: any) {
      setError(e?.message || "Could not reset the password.");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent data-testid="reset-password-dialog">
        <DialogHeader>
          <DialogTitle>Reset password for {target.username}</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">Recorded in the audit log. Tell them the new password out of band.</DialogDescription>
        </DialogHeader>
        {done ? (
          <>
            <p className="text-sm text-verified-emerald">Password updated.</p>
            <DialogFooter className="pt-1"><Button type="button" variant="primary" onClick={() => onOpenChange(false)}>Done</Button></DialogFooter>
          </>
        ) : (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
            <div>
              <label htmlFor={ids.pw} className="text-sm font-medium">New password</label>
              <input id={ids.pw} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} autoFocus required minLength={8} maxLength={200} />
            </div>
            {error && <p id={ids.err} role="alert" className="text-sm text-critical-red">{error}</p>}
            <DialogFooter className="gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={busy}>{busy ? "Resetting…" : "Reset password"}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function UserManagementContent() {
  const me = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [orgTarget, setOrgTarget] = useState<AdminUser | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    setError(null);
    listAllUsers().then(setUsers).catch((e) => setError(e?.message || "Could not load users."));
  };
  useEffect(() => { load(); }, []);

  const toggleActive = async (u: AdminUser) => {
    setBusyId(u.user_id);
    try {
      await (u.active ? deactivateUser(u.user_id) : reactivateUser(u.user_id));
      load();
    } catch (e: any) {
      setError(e?.message || "Could not change that account's status.");
    } finally { setBusyId(null); }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-background overflow-hidden">
      <div className="shrink-0 border-b border-border-subtle bg-surface-1 px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold font-mono tracking-wide uppercase text-text-primary">User management</h2>
          {users && <span className="text-xs text-text-muted">· {users.length} account{users.length === 1 ? "" : "s"}</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-xs gap-1.5" onClick={load}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
          <Button variant="primary" size="sm" className="text-xs gap-1.5" onClick={() => setCreateOpen(true)}><UserPlus className="h-3.5 w-3.5" /> Create user</Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="mb-3 rounded-lg border border-red-400/30 bg-red-400/5 p-4 text-xs text-red-400 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> {error}
          </div>
        )}
        {users === null ? (
          <div className="flex items-center justify-center py-16"><div className="h-7 w-7 animate-spin rounded-full border-2 border-electric-blue border-t-transparent" /></div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border-subtle">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-xs text-text-muted uppercase">
                <tr>
                  <th className="px-4 py-2 text-left font-medium whitespace-nowrap">User ID</th>
                  <th className="px-4 py-2 text-left font-medium">Username</th>
                  <th className="px-4 py-2 text-left font-medium">Display name</th>
                  <th className="px-4 py-2 text-left font-medium">Role</th>
                  <th className="px-4 py-2 text-left font-medium">Jurisdiction</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle bg-surface-1">
                {users.map((u) => (
                  <tr key={u.user_id} className="hover:bg-surface-2 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap">{u.org_user_id ?? <span className="font-sans text-text-muted">Not allocated</span>}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{u.username}</td>
                    <td className="px-4 py-2.5">{u.display_name}</td>
                    <td className="px-4 py-2.5"><Badge tone="blue">{roleLabel(u.role)}</Badge></td>
                    <td className="px-4 py-2.5 text-text-secondary">{u.jurisdiction || "—"}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={u.active ? "emerald" : "gray"}>{u.active ? "Active" : "Deactivated"}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => setEditTarget(u)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => setOrgTarget(u)}><IdCard className="h-3.5 w-3.5" /> User ID</Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => setResetTarget(u)}><KeyRound className="h-3.5 w-3.5" /> Reset password</Button>
                        <Button
                          variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1"
                          disabled={busyId === u.user_id || (u.active && u.user_id === me?.user_id)}
                          title={u.active && u.user_id === me?.user_id ? "You cannot deactivate your own account" : undefined}
                          onClick={() => toggleActive(u)}
                        >
                          {u.active ? <Ban className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
                          {u.active ? "Deactivate" : "Reactivate"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
      <EditUserDialog target={editTarget} open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)} onSaved={load} />
      <ResetPasswordDialog target={resetTarget} open={!!resetTarget} onOpenChange={(o) => !o && setResetTarget(null)} />
      <OrgUserIdDialog target={orgTarget} isSelf={orgTarget?.user_id === me?.user_id} open={!!orgTarget} onOpenChange={(o) => !o && setOrgTarget(null)} onSaved={load} />
    </div>
  );
}

/** Admin-only user management: create, edit role/jurisdiction, allocate user IDs, deactivate/reactivate, reset password. */
export function UserManagementPage() {
  const role = useAuthStore((s) => s.user?.role);
  if (!can(role, "manageUsers")) {
    return <div className="p-6"><DeniedState message={deniedReason(role, "manage user accounts")} backTo="/command-center" backLabel="Back to Home" /></div>;
  }
  return <UserManagementContent />;
}
