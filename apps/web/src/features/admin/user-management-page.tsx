import { useEffect, useId, useState } from "react";
import { UserPlus, KeyRound, Ban, RotateCcw, Pencil, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DeniedState } from "@/components/layout/page";
import { useAuthStore } from "@/stores/authStore";
import { can, deniedReason, roleLabel, ALL_ROLES } from "@/lib/permissions";
import {
  type AdminUser, listAllUsers, createUser, updateUser, deactivateUser, reactivateUser, resetUserPassword,
} from "@/services/api/usersApi";

const field = "mt-1 block w-full rounded-md border border-border-strong bg-surface-1 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-electric-blue-soft";

function CreateUserDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const ids = { username: useId(), name: useId(), role: useId(), jur: useId(), pw: useId(), err: useId() };
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState(ALL_ROLES[0]);
  const [jurisdiction, setJurisdiction] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUsername(""); setDisplayName(""); setRole(ALL_ROLES[0]); setJurisdiction(""); setPassword(""); setError(null);
  }, [open]);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      await createUser({ username: username.trim(), display_name: displayName.trim(), role, jurisdiction: jurisdiction.trim(), password });
      onCreated();
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.status === 409 ? "That username is already taken." : e?.status === 422 ? "Check the fields: username (lowercase/digits/._-), display name, and password (8+ characters)." : (e?.message || "Could not create the user."));
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
    </div>
  );
}

/** Admin-only user management: create, edit role/jurisdiction, deactivate/reactivate, reset password. */
export function UserManagementPage() {
  const role = useAuthStore((s) => s.user?.role);
  if (!can(role, "manageUsers")) {
    return <div className="p-6"><DeniedState message={deniedReason(role, "manage user accounts")} backTo="/command-center" backLabel="Back to Home" /></div>;
  }
  return <UserManagementContent />;
}
