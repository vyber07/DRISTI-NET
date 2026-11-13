import { useCallback, useEffect, useId, useState } from "react";
import { AlertTriangle, Check, History, Plus, RefreshCw, ShieldOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DeniedState, EmptyState, LoadingState } from "@/components/layout/page";
import { useAuthStore } from "@/stores/authStore";
import { ALL_ROLES, can, deniedReason, roleLabel } from "@/lib/permissions";
import { type AdminUser, listAllUsers } from "@/services/api/usersApi";
import {
  type OverrideDetail, type OverrideMeta, type OverrideStatusFilter, type PermissionOverride,
  approveOverride, createOverride, getOverride, getOverrideMeta, listOverrides, rejectOverride, revokeOverride,
} from "@/services/api/overridesApi";

/**
 * Administrator review of permission overrides (apps/api/app/routes/override_routes.py).
 *
 * ADMIN and AUDITOR may review; only ADMIN may create, approve, reject or revoke. The buttons below follow the same
 * rules the server enforces (no approving your own override, no approving or revoking one that applies to you), but
 * the server decides: a refused action shows the server's reason.
 */

const field = "mt-1 block w-full rounded-md border border-border-strong bg-surface-1 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-electric-blue-soft";
const FILTERS: OverrideStatusFilter[] = ["all", "active", "pending", "scheduled", "expired", "revoked", "rejected"];
const STATUS_TONE: Record<string, "emerald" | "amber" | "blue" | "gray" | "red" | "neutral"> = {
  ACTIVE: "emerald", PENDING: "amber", SCHEDULED: "blue", EXPIRED: "gray", REVOKED: "red", REJECTED: "neutral",
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function subjectText(o: PermissionOverride): string {
  return o.subject_type === "ROLE" ? `Role: ${roleLabel(o.subject)}` : (o.subject_username || o.subject);
}

function scopeText(o: PermissionOverride): string {
  const parts = [o.case_id ? `Case ${o.case_id}` : "All cases"];
  if (o.resource_type) parts.push(`${o.resource_type} ${o.resource_id}`);
  return parts.join(" · ");
}

function errorText(e: any, fallback: string): string {
  if (e?.status === 403) return "You are not permitted to do this.";
  return e?.message || fallback;
}

function CreateOverrideDialog({ open, onOpenChange, onCreated, meta, users }: {
  open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void; meta: OverrideMeta | null; users: AdminUser[];
}) {
  const ids = { effect: useId(), action: useId(), stype: useId(), subject: useId(), caseId: useId(), rtype: useId(), rid: useId(),
                reason: useId(), starts: useId(), expires: useId() };
  const me = useAuthStore((s) => s.user);
  const [effect, setEffect] = useState<"ALLOW" | "DENY">("ALLOW");
  const [action, setAction] = useState("");
  const [subjectType, setSubjectType] = useState<"USER" | "ROLE">("USER");
  const [subject, setSubject] = useState("");
  const [caseId, setCaseId] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [reason, setReason] = useState("");
  const [starts, setStarts] = useState("");
  const [expires, setExpires] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEffect("ALLOW"); setAction(meta?.overridable_actions[0] ?? ""); setSubjectType("USER"); setSubject(""); setCaseId("");
    setResourceType(""); setResourceId(""); setReason(""); setStarts(""); setExpires(""); setError(null);
  }, [open, meta]);

  // Mirrors the server: you cannot target yourself or your own role, and ALLOW never targets administrators.
  const userChoices = users.filter((u) => u.active && u.user_id !== me?.user_id && !(effect === "ALLOW" && u.role === "ADMIN"));
  const roleChoices = ALL_ROLES.filter((r) => r !== me?.role && !(effect === "ALLOW" && r === "ADMIN"));

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      await createOverride({
        effect, action, subject_type: subjectType, subject, reason: reason.trim(),
        case_id: caseId.trim() || null, resource_type: resourceType || null, resource_id: resourceId.trim() || null,
        starts_at: starts ? new Date(starts).toISOString() : null,
        expires_at: new Date(expires).toISOString(),
      });
      onCreated();
      onOpenChange(false);
    } catch (e: any) {
      setError(errorText(e, "Could not create the override."));
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent data-testid="create-override-dialog" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a permission override</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            Recorded in the audit log. An ALLOW takes effect only after a different administrator approves it; a DENY takes effect
            at once. Overrides cannot change {meta ? meta.mandatory_actions.join(", ") : "mandatory restrictions"}, jurisdiction,
            or evidence-integrity checks. At most {meta?.max_duration_days ?? 90} days.
          </DialogDescription>
        </DialogHeader>
        <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <div>
            <label htmlFor={ids.effect} className="text-sm font-medium">Effect</label>
            <select id={ids.effect} className={field} value={effect} onChange={(e) => { setEffect(e.target.value as "ALLOW" | "DENY"); setSubject(""); }}>
              <option value="ALLOW">Allow</option>
              <option value="DENY">Deny</option>
            </select>
          </div>
          <div>
            <label htmlFor={ids.action} className="text-sm font-medium">Action</label>
            <select id={ids.action} className={field} value={action} onChange={(e) => setAction(e.target.value)} required>
              {(meta?.overridable_actions ?? []).map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={ids.stype} className="text-sm font-medium">Applies to</label>
            <select id={ids.stype} className={field} value={subjectType} onChange={(e) => { setSubjectType(e.target.value as "USER" | "ROLE"); setSubject(""); }}>
              <option value="USER">One user</option>
              <option value="ROLE">Everyone with a role</option>
            </select>
          </div>
          <div>
            <label htmlFor={ids.subject} className="text-sm font-medium">{subjectType === "USER" ? "User" : "Role"}</label>
            <select id={ids.subject} className={field} value={subject} onChange={(e) => setSubject(e.target.value)} required>
              <option value="" disabled>Choose…</option>
              {subjectType === "USER"
                ? userChoices.map((u) => <option key={u.user_id} value={u.user_id}>{u.username} ({roleLabel(u.role)})</option>)
                : roleChoices.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={ids.caseId} className="text-sm font-medium">Case (optional)</label>
            <input id={ids.caseId} className={field} value={caseId} onChange={(e) => setCaseId(e.target.value)} placeholder="All cases" maxLength={64} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor={ids.rtype} className="text-sm font-medium">Resource</label>
              <select id={ids.rtype} className={field} value={resourceType} onChange={(e) => setResourceType(e.target.value)}>
                <option value="">Any</option>
                {(meta?.resource_types ?? []).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor={ids.rid} className="text-sm font-medium">ID</label>
              <input id={ids.rid} className={field} value={resourceId} onChange={(e) => setResourceId(e.target.value)} disabled={!resourceType} maxLength={64} />
            </div>
          </div>
          <div>
            <label htmlFor={ids.starts} className="text-sm font-medium">Starts (optional)</label>
            <input id={ids.starts} type="datetime-local" className={field} value={starts} onChange={(e) => setStarts(e.target.value)} />
          </div>
          <div>
            <label htmlFor={ids.expires} className="text-sm font-medium">Expires</label>
            <input id={ids.expires} type="datetime-local" className={field} value={expires} onChange={(e) => setExpires(e.target.value)} required />
          </div>
          <div className="col-span-2">
            <label htmlFor={ids.reason} className="text-sm font-medium">Reason</label>
            <textarea id={ids.reason} className={field} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} required minLength={10} maxLength={1000}
              placeholder="Why this exception is needed, and on whose authority (at least 10 characters)" />
          </div>
          {error && <p role="alert" className="col-span-2 text-sm text-critical-red">{error}</p>}
          <DialogFooter className="col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={busy || !subject || !expires || reason.trim().length < 10}>Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReasonDialog({ title, action, open, onOpenChange, onConfirm, minLength = 10 }: {
  title: string; action: string; open: boolean; onOpenChange: (o: boolean) => void; onConfirm: (reason: string) => Promise<void>; minLength?: number;
}) {
  const id = useId();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setReason(""); setError(null); } }, [open]);
  const submit = async () => {
    setBusy(true); setError(null);
    try { await onConfirm(reason.trim()); onOpenChange(false); }
    catch (e: any) { setError(errorText(e, `Could not ${action.toLowerCase()} the override.`)); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <label htmlFor={id} className="text-sm font-medium">{minLength ? "Reason (recorded in the audit log)" : "Note (optional, recorded)"}</label>
          <textarea id={id} className={field} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} minLength={minLength || undefined} maxLength={1000} />
          {error && <p role="alert" className="text-sm text-critical-red">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={busy || reason.trim().length < minLength}>{action}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ overrideId, onOpenChange }: { overrideId: string | null; onOpenChange: (o: boolean) => void }) {
  const [detail, setDetail] = useState<OverrideDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setDetail(null); setError(null);
    if (overrideId) getOverride(overrideId).then(setDetail).catch((e) => setError(errorText(e, "Could not load the history.")));
  }, [overrideId]);
  return (
    <Dialog open={!!overrideId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Override {overrideId}</DialogTitle>
          {detail && <DialogDescription className="text-sm text-text-secondary">{detail.effect} {detail.action} for {subjectText(detail)} · {scopeText(detail)}</DialogDescription>}
        </DialogHeader>
        {error && <p role="alert" className="text-sm text-critical-red">{error}</p>}
        {detail && (
          <div className="space-y-3 text-sm">
            <p><span className="text-text-muted">Reason:</span> {detail.reason}</p>
            <p><span className="text-text-muted">Window:</span> {fmt(detail.starts_at)} → {fmt(detail.expires_at)}</p>
            <ol className="space-y-2 border-l border-border-subtle pl-3">
              {detail.history.map((h, i) => (
                <li key={i}>
                  <div className="font-medium">{h.event.toLowerCase()} · {fmt(h.at)}</div>
                  <div className="text-xs text-text-secondary">by {h.actor_id}{h.reason ? ` — ${h.reason}` : ""}</div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function OverridesContent() {
  const me = useAuthStore((s) => s.user);
  const mayManage = can(me?.role, "manageOverrides");
  const [filter, setFilter] = useState<OverrideStatusFilter>("active");
  const [rows, setRows] = useState<PermissionOverride[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<OverrideMeta | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [pending, setPending] = useState<{ kind: "approve" | "reject" | "revoke"; row: PermissionOverride } | null>(null);

  const load = useCallback(() => {
    setRows(null); setError(null);
    listOverrides(filter).then(setRows).catch((e) => { setRows([]); setError(errorText(e, "Could not load overrides.")); });
  }, [filter]);
  useEffect(load, [load]);
  useEffect(() => {
    getOverrideMeta().then(setMeta).catch(() => setMeta(null));
    if (mayManage) listAllUsers().then(setUsers).catch(() => setUsers([]));
  }, [mayManage]);

  const appliesToMe = (o: PermissionOverride) =>
    (o.subject_type === "USER" && o.subject === me?.user_id) || (o.subject_type === "ROLE" && o.subject === me?.role);

  const confirm = async (reason: string) => {
    if (!pending) return;
    const id = pending.row.override_id;
    if (pending.kind === "approve") await approveOverride(id, reason);
    else if (pending.kind === "reject") await rejectOverride(id, reason);
    else await revokeOverride(id, reason);
    load();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold">Permission overrides</h1>
          <p className="text-xs text-text-secondary">
            Explicit, time-limited exceptions to role-based access. Deny always wins; {meta ? meta.precedence.join(" → ") : ""}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-xs gap-1.5" onClick={load}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
          {mayManage && <Button variant="primary" size="sm" className="text-xs gap-1.5" onClick={() => setCreateOpen(true)}><Plus className="h-3.5 w-3.5" /> New override</Button>}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-border-subtle px-4 py-2" role="tablist" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <Button key={f} role="tab" aria-selected={filter === f} variant={filter === f ? "secondary" : "ghost"} size="sm" className="h-7 text-xs capitalize"
            onClick={() => setFilter(f)}>{f}</Button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-critical-red/30 bg-critical-red/5 p-4 text-xs text-critical-red">
            <AlertTriangle className="h-4 w-4" /> {error}
          </div>
        )}
        {rows === null ? (
          <LoadingState label="Loading overrides…" rows={4} />
        ) : rows.length === 0 ? (
          <EmptyState icon={ShieldOff} title={`No ${filter === "all" ? "" : filter + " "}overrides`}>Overrides are time-limited exceptions to role-based access. They appear here once an administrator creates one.</EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border-subtle">
            <table className="w-full text-sm" data-testid="overrides-table">
              <thead className="bg-surface-2 text-xs uppercase text-text-muted">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Effect</th>
                  <th className="px-3 py-2 text-left font-medium">Action</th>
                  <th className="px-3 py-2 text-left font-medium">Applies to</th>
                  <th className="px-3 py-2 text-left font-medium">Scope</th>
                  <th className="px-3 py-2 text-left font-medium">Window</th>
                  <th className="px-3 py-2 text-left font-medium">Created / approved</th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle bg-surface-1">
                {rows.map((o) => {
                  const live = o.status === "ACTIVE" || o.status === "PENDING";
                  return (
                    <tr key={o.override_id} className="align-top hover:bg-surface-2">
                      <td className="px-3 py-2.5"><Badge tone={STATUS_TONE[o.effective_status] ?? "neutral"}>{o.effective_status.toLowerCase()}</Badge></td>
                      <td className="px-3 py-2.5"><Badge tone={o.effect === "DENY" ? "red" : "blue"}>{o.effect.toLowerCase()}</Badge></td>
                      <td className="px-3 py-2.5 font-mono text-xs">{o.action}</td>
                      <td className="px-3 py-2.5">{subjectText(o)}</td>
                      <td className="px-3 py-2.5 text-xs text-text-secondary">{scopeText(o)}</td>
                      <td className="px-3 py-2.5 text-xs text-text-secondary">{fmt(o.starts_at)}<br />→ {fmt(o.expires_at)}</td>
                      <td className="px-3 py-2.5 text-xs text-text-secondary">
                        {o.created_by_username || o.created_by}<br />{o.approved_by ? `${o.status === "REJECTED" ? "rejected" : "approved"} by ${o.approved_by_username || o.approved_by}` : o.effect === "DENY" ? "no approval needed" : "awaiting approval"}
                        {o.revoked_by && <><br />revoked by {o.revoked_by_username || o.revoked_by}</>}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => setHistoryFor(o.override_id)}><History className="h-3.5 w-3.5" /> History</Button>
                          {mayManage && o.status === "PENDING" && (
                            <>
                              <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs"
                                disabled={o.created_by === me?.user_id || appliesToMe(o)}
                                title={o.created_by === me?.user_id ? "Another administrator must approve an override you created" : appliesToMe(o) ? "You cannot approve an override that applies to you" : undefined}
                                onClick={() => setPending({ kind: "approve", row: o })}><Check className="h-3.5 w-3.5" /> Approve</Button>
                              <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => setPending({ kind: "reject", row: o })}><X className="h-3.5 w-3.5" /> Reject</Button>
                            </>
                          )}
                          {mayManage && live && (
                            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" disabled={appliesToMe(o)}
                              title={appliesToMe(o) ? "You cannot revoke an override that applies to you" : undefined}
                              onClick={() => setPending({ kind: "revoke", row: o })}><ShieldOff className="h-3.5 w-3.5" /> Revoke</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {mayManage && <CreateOverrideDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} meta={meta} users={users} />}
      <HistoryDialog overrideId={historyFor} onOpenChange={(o) => !o && setHistoryFor(null)} />
      <ReasonDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title={pending ? `${pending.kind === "approve" ? "Approve" : pending.kind === "reject" ? "Reject" : "Revoke"} ${pending.row.effect.toLowerCase()} ${pending.row.action} for ${subjectText(pending.row)}` : ""}
        action={pending?.kind === "approve" ? "Approve" : pending?.kind === "reject" ? "Reject" : "Revoke"}
        minLength={pending?.kind === "approve" ? 0 : 10}
        onConfirm={confirm}
      />
    </div>
  );
}

/** Review of active, pending, scheduled, expired, revoked and rejected overrides (ADMIN, AUDITOR; changes ADMIN only). */
export function PermissionOverridesPage() {
  const role = useAuthStore((s) => s.user?.role);
  if (!can(role, "viewOverrides")) {
    return <div className="p-6"><DeniedState message={deniedReason(role, "review permission overrides")} backTo="/command-center" backLabel="Back to Home" /></div>;
  }
  return <OverridesContent />;
}
