import { useCallback, useEffect, useId, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Briefcase, Crown, RefreshCw, UserMinus, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DeniedState, EmptyState, ErrorState, LoadingState, PageBody, PageHeader, Pager } from "@/components/layout/page";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useAuthStore } from "@/stores/authStore";
import { can, deniedReason, roleLabel } from "@/lib/permissions";
import { type AdminUser, listAllUsers } from "@/services/api/usersApi";
import {
  type AccessStatus, type CaseAssignmentDetail, type CaseAssignmentOverview, type TeamMember, type TeamPerson,
  assignToCase, changePrimary, getCaseAssignments, listCaseAssignments, removeFromCase,
} from "@/services/api/caseAssignmentsApi";

/**
 * Administrator case assignment (apps/api/app/services/case_assignments.py, docs/CASE_ASSIGNMENT.md).
 * ADMIN and AUDITOR see every case's team, its effective access and its history; only ADMIN changes it. The server
 * enforces every rule shown here (reason required, eligible roles, jurisdiction, no removing the primary investigator,
 * stale handovers refused); a refused action shows the server's reason.
 */

const field = "mt-1 block w-full rounded-md border border-border-strong bg-surface-1 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-electric-blue-soft";
const PAGE = 25;
const ASSIGNABLE = ["INVESTIGATOR", "EVIDENCE_OFFICER", "REVIEWER", "ANALYST"];
const PURPOSES = ["investigation", "review", "analysis", "evidence handling"];

const ISSUE_TEXT: Record<string, string> = {
  NO_PRIMARY: "No primary investigator",
  PRIMARY_DEACTIVATED: "Primary investigator deactivated",
  PRIMARY_JURISDICTION_MISMATCH: "Primary investigator outside the case's jurisdiction",
  PRIMARY_DENIED_BY_OVERRIDE: "Primary investigator blocked by an override",
  PRIMARY_UNKNOWN_USER: "Primary investigator account missing",
  PRIMARY_NOT_INVESTIGATOR: "Primary is not an investigator",
  MEMBER_ACCESS_BLOCKED: "A member cannot open the case",
  NO_SUPPORTING_MEMBERS: "No supporting members",
};
const ACCESS_TEXT: Record<AccessStatus, string> = {
  OK: "Has access", DEACTIVATED: "Deactivated", JURISDICTION_MISMATCH: "Other jurisdiction",
  DENIED_BY_OVERRIDE: "Blocked by override", UNKNOWN_USER: "Unknown account",
};
const EVENT_TEXT: Record<string, string> = {
  ASSIGNED: "added to the case", REMOVED: "removed from the case", PRIMARY_SET: "made primary investigator",
  PRIMARY_RELEASED: "no longer primary investigator",
};
const ERRORS: Record<string, string> = {
  REASON_REQUIRED: "Give a reason of at least 5 characters.",
  ALREADY_ASSIGNED: "That person is already on the case.",
  NOT_ASSIGNED: "That person is no longer on the case. Reload to see the current team.",
  PRIMARY_CANNOT_BE_REMOVED: "The primary investigator cannot be removed. Hand the case over first.",
  PRIMARY_CHANGED: "Someone changed the primary investigator meanwhile. Reload and try again.",
  ALREADY_PRIMARY: "That person is already the primary investigator.",
  PRIMARY_ROLE_REQUIRED: "The primary investigator must have the Investigator role.",
  JURISDICTION_MISMATCH: "That person is in a different jurisdiction from the case.",
  USER_INACTIVE: "That account is deactivated.",
  ROLE_NOT_ASSIGNABLE: "Administrators and auditors see every case by role and are not assigned.",
  CONFLICT: "The team changed at the same moment. Reload and try again.",
};
const errText = (e: any, fallback: string) => (e?.code && ERRORS[e.code]) || e?.message || fallback;

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function who(p: TeamPerson | null | undefined): string {
  if (!p) return "—";
  const name = p.display_name || p.username || p.user_id;
  return p.org_user_id ? `${name} (${p.org_user_id})` : name;
}

function TeamDialog({ caseId, onClose, onChanged }: { caseId: string | null; onClose: () => void; onChanged: () => void }) {
  const me = useAuthStore((s) => s.user);
  const manage = can(me?.role, "manageCaseAssignments");
  const ids = { person: useId(), purpose: useId(), reason: useId(), hand: useId(), keep: useId() };
  const [detail, setDetail] = useState<CaseAssignmentDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [person, setPerson] = useState("");
  const [purpose, setPurpose] = useState(PURPOSES[0]);
  const [handTo, setHandTo] = useState("");
  const [keepPrevious, setKeepPrevious] = useState(true);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { confirm, confirmDialog } = useConfirm();

  const load = useCallback(() => {
    if (!caseId) return;
    setLoadError(null);
    getCaseAssignments(caseId).then(setDetail).catch((e) => setLoadError(e?.message || "Could not load the team."));
  }, [caseId]);

  useEffect(() => {
    if (!caseId) return;
    setDetail(null); setPerson(""); setHandTo(""); setReason(""); setError(null); setNotice(null); setKeepPrevious(true);
    load();
    if (manage) listAllUsers().then(setUsers).catch(() => setUsers([]));
  }, [caseId, load, manage]);

  if (!caseId) return null;
  const onCase = new Set(detail?.members.map((m) => m.user_id) ?? []);
  const eligible = users.filter((u) => u.active && ASSIGNABLE.includes(u.role) && u.jurisdiction === detail?.jurisdiction);
  const addable = eligible.filter((u) => !onCase.has(u.user_id));
  const handable = eligible.filter((u) => u.role === "INVESTIGATOR" && u.user_id !== detail?.primary?.user_id);
  const reasonOk = reason.trim().length >= 5;

  const run = async (fn: () => Promise<string | void>, done: string) => {
    setBusy(true); setError(null); setNotice(null);
    try {
      const msg = await fn();
      setNotice(msg || done); setReason(""); setPerson(""); setHandTo("");
      load(); onChanged();
    } catch (e: any) {
      setError(errText(e, "The change was not made."));
    } finally { setBusy(false); }
  };

  const remove = async (m: TeamMember) => {
    if (!reasonOk) { setError("Enter a reason first (at least 5 characters)."); return; }
    if (!(await confirm({ title: `Remove ${who(m)} from ${caseId}?`, description: "They lose access to the case on their next request. The removal and your reason are recorded.",
      confirmLabel: "Remove from case", destructive: true }))) return;
    void run(async () => {
      const r = await removeFromCase(caseId, m.user_id, reason.trim());
      if (r.access_remains_via_override) return `${who(m)} was removed, but an active permission override still lets them open the case.`;
    }, `${who(m)} was removed from ${caseId}.`);
  };

  return (
    <Dialog open={!!caseId} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent data-testid="case-team-dialog" className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Team for {caseId}</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            {detail ? `${detail.title} · ${detail.jurisdiction}. ` : ""}
            Access follows these assignments on every request. Changes need a reason, notify the person, and are recorded in the history and the audit log.
          </DialogDescription>
        </DialogHeader>

        {loadError ? <p role="alert" className="text-sm text-critical-red">{loadError}</p> : !detail ? <p className="text-sm text-text-secondary">Loading…</p> : (
          <>
            {detail.issues.length > 0 && (
              <ul className="flex flex-wrap gap-1.5" aria-label="Issues">
                {detail.issues.map((i) => <li key={i}><Badge tone={i === "NO_SUPPORTING_MEMBERS" ? "neutral" : "amber"}>{ISSUE_TEXT[i] ?? i}</Badge></li>)}
              </ul>
            )}
            <div className="overflow-x-auto rounded-lg border border-border-subtle">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-xs text-text-muted uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Person</th>
                    <th className="px-3 py-2 text-left font-medium">Assignment</th>
                    <th className="px-3 py-2 text-left font-medium">Access</th>
                    <th className="px-3 py-2 text-left font-medium">Assigned</th>
                    {manage && <th className="px-3 py-2 text-right font-medium"><span className="sr-only">Actions</span></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle bg-surface-1">
                  {detail.members.map((m) => (
                    <tr key={m.user_id} data-testid={`member-${m.username ?? m.user_id}`}>
                      <td className="px-3 py-2">{who(m)}<span className="block text-xs text-text-secondary">{roleLabel(m.role)}</span></td>
                      <td className="px-3 py-2">
                        {m.is_primary ? <Badge tone="purple"><Crown className="h-3 w-3" aria-hidden="true" /> Primary</Badge> : <Badge tone="blue">Supporting</Badge>}
                        <span className="block text-xs text-text-secondary">{m.purpose}</span>
                      </td>
                      <td className="px-3 py-2"><Badge tone={m.access === "OK" ? "emerald" : "red"}>{ACCESS_TEXT[m.access]}</Badge></td>
                      <td className="px-3 py-2 text-xs text-text-secondary">
                        {m.assigned_at ? <>{fmt(m.assigned_at)} by {m.assigned_by_username ?? m.assigned_by}{m.reason ? <span className="block">“{m.reason}”</span> : null}</> : "Before history was kept"}
                      </td>
                      {manage && (
                        <td className="px-3 py-2 text-right">
                          {!m.is_primary && (
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" disabled={busy} onClick={() => remove(m)}>
                              <UserMinus className="h-3.5 w-3.5" aria-hidden="true" /> Remove
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {manage && (
              <div className="space-y-3 rounded-lg border border-border-subtle p-3">
                <div>
                  <label htmlFor={ids.reason} className="text-sm font-medium">Reason (required for every change)</label>
                  <input id={ids.reason} value={reason} onChange={(e) => setReason(e.target.value)} className={field} maxLength={500}
                         placeholder="e.g. Needed for the financial trail analysis" />
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
                  <div>
                    <label htmlFor={ids.person} className="text-sm font-medium">Add a person</label>
                    <select id={ids.person} value={person} onChange={(e) => setPerson(e.target.value)} className={field}>
                      <option value="">{addable.length ? "Choose…" : `Nobody else eligible in ${detail.jurisdiction}`}</option>
                      {addable.map((u) => <option key={u.user_id} value={u.user_id}>{u.display_name}{u.org_user_id ? ` (${u.org_user_id})` : ""} — {roleLabel(u.role)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={ids.purpose} className="text-sm font-medium">Purpose</label>
                    <select id={ids.purpose} value={purpose} onChange={(e) => setPurpose(e.target.value)} className={field}>
                      {PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <Button variant="primary" size="sm" className="gap-1.5" disabled={busy || !person || !reasonOk}
                          onClick={() => run(async () => { await assignToCase(caseId, { user_id: person, purpose, reason: reason.trim() }); }, "Person added.")}>
                    <UserPlus className="h-3.5 w-3.5" aria-hidden="true" /> Add
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div>
                    <label htmlFor={ids.hand} className="text-sm font-medium">Hand over to a new primary investigator</label>
                    <select id={ids.hand} value={handTo} onChange={(e) => setHandTo(e.target.value)} className={field}>
                      <option value="">{handable.length ? "Choose an investigator…" : "No other eligible investigator"}</option>
                      {handable.map((u) => <option key={u.user_id} value={u.user_id}>{u.display_name}{u.org_user_id ? ` (${u.org_user_id})` : ""}{onCase.has(u.user_id) ? " — on the case" : ""}</option>)}
                    </select>
                    <div className="mt-1.5 flex items-center gap-2 text-xs">
                      <input id={ids.keep} type="checkbox" checked={keepPrevious} onChange={(e) => setKeepPrevious(e.target.checked)} />
                      <label htmlFor={ids.keep}>Keep {who(detail.primary)} on the case as a supporting member</label>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" className="gap-1.5" disabled={busy || !handTo || !reasonOk}
                          onClick={async () => {
                            if (!(await confirm({ title: `Hand ${caseId} over?`, confirmLabel: "Hand over", destructive: !keepPrevious,
                              description: keepPrevious ? "The current primary investigator stays on the case as a supporting member." : "The current primary investigator loses access to the case." }))) return;
                            void run(async () => { await changePrimary(caseId, { user_id: handTo, expected_primary_id: detail.primary?.user_id ?? null, reason: reason.trim(), previous: keepPrevious ? "KEEP" : "REMOVE" }); }, "Case handed over.");
                          }}>
                    <Crown className="h-3.5 w-3.5" aria-hidden="true" /> Hand over
                  </Button>
                </div>
                {error && <p role="alert" className="text-sm text-critical-red">{error}</p>}
                {notice && <p role="status" className="text-sm text-verified-emerald">{notice}</p>}
              </div>
            )}

            <div className="border-t border-border-subtle pt-3">
              <h3 className="text-sm font-semibold text-text-primary mb-2">History</h3>
              {detail.history.length === 0 ? <p className="text-sm text-text-secondary">No changes recorded since history was introduced.</p> : (
                <ul className="space-y-1.5 max-h-56 overflow-y-auto" data-testid="assignment-history">
                  {detail.history.map((h) => (
                    <li key={h.event_id} className="text-xs">
                      <span className="text-text-primary">{who(h.user)} {EVENT_TEXT[h.event] ?? h.event}</span>
                      <span className="text-text-secondary"> · {fmt(h.at)} by {h.actor_username ?? h.actor_id}: {h.reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
        <DialogFooter className="pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Close</Button>
        </DialogFooter>
        {confirmDialog}
      </DialogContent>
    </Dialog>
  );
}

function CaseAssignmentsContent() {
  const [params, setParams] = useSearchParams();
  const ids = { q: useId() };
  const [q, setQ] = useState(params.get("q") ?? "");
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [attention, setAttention] = useState(false);
  const [unstaffed, setUnstaffed] = useState(false);
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<CaseAssignmentOverview[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const openCase = params.get("case");

  const load = useCallback(() => {
    setError(null);
    listCaseAssignments({ q: query, attention, unstaffed, limit: PAGE, offset })
      .then((r) => { setRows(r.items); setTotal(r.total); })
      .catch((e) => setError(e?.message || "Could not load cases."));
  }, [query, attention, unstaffed, offset]);
  useEffect(() => { load(); }, [load]);

  const setOpen = (cid: string | null) => {
    const next = new URLSearchParams(params);
    if (cid) next.set("case", cid); else next.delete("case");
    setParams(next, { replace: true });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <PageHeader icon={<Briefcase className="h-5 w-5" />} title="Case assignments"
        description={<>Who is on each case and whether they can actually open it.{rows ? ` ${total} case${total === 1 ? "" : "s"}.` : ""}</>}
        actions={<Button variant="secondary" size="sm" className="gap-1.5" onClick={load}><RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Refresh</Button>} />
      <PageBody wide>
        <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); setOffset(0); setQuery(q.trim()); }}>
          <div className="min-w-[16rem] flex-1">
            <label htmlFor={ids.q} className="text-xs font-medium text-text-secondary">Search case ID or title</label>
            <input id={ids.q} value={q} onChange={(e) => setQ(e.target.value)} className={field} placeholder="e.g. CASE-0001" />
          </div>
          <Button type="submit" variant="secondary" size="sm">Search</Button>
          <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={attention} onChange={(e) => { setOffset(0); setAttention(e.target.checked); }} /> Needs attention</label>
          <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={unstaffed} onChange={(e) => { setOffset(0); setUnstaffed(e.target.checked); }} /> No supporting members</label>
        </form>
        {error ? <ErrorState message={error} onRetry={load} />
        : rows === null ? <LoadingState label="Loading cases…" rows={5} />
        : rows.length === 0 ? <EmptyState title="No cases match" />
        : (
          <div className="overflow-x-auto rounded-lg border border-border-subtle">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-xs text-text-muted uppercase">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Case</th>
                  <th className="px-4 py-2 text-left font-medium">Primary investigator</th>
                  <th className="px-4 py-2 text-left font-medium">Team</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-right font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle bg-surface-1">
                {rows.map((c) => (
                  <tr key={c.case_id} className="hover:bg-surface-2 transition-colors">
                    <td className="px-4 py-2.5"><span className="font-mono text-xs whitespace-nowrap">{c.case_id}</span><span className="block text-xs text-text-secondary">{c.title} · {c.jurisdiction}</span></td>
                    <td className="px-4 py-2.5">{who(c.primary)}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{c.member_count} {c.member_count === 1 ? "person" : "people"}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {c.issues.filter((i) => i !== "NO_SUPPORTING_MEMBERS").length === 0 ? <Badge tone="emerald">OK</Badge> : null}
                        {c.issues.map((i) => <Badge key={i} tone={i === "NO_SUPPORTING_MEMBERS" ? "neutral" : "amber"}>{ISSUE_TEXT[i] ?? i}</Badge>)}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => setOpen(c.case_id)} aria-label={`Team for ${c.case_id}`}><Users className="h-3.5 w-3.5" aria-hidden="true" /> Team</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager offset={offset} limit={PAGE} total={total} onChange={setOffset} label="cases" />
      </PageBody>
      <TeamDialog caseId={openCase} onClose={() => setOpen(null)} onChanged={load} />
    </div>
  );
}

/** ADMIN and AUDITOR: every case's team. Only ADMIN changes it (the dialog hides the controls for AUDITOR). */
export function CaseAssignmentsPage() {
  const role = useAuthStore((s) => s.user?.role);
  if (!can(role, "viewCaseAssignments")) {
    return <div className="p-6"><DeniedState message={deniedReason(role, "view case assignments")} backTo="/command-center" backLabel="Back to Home" /></div>;
  }
  return <CaseAssignmentsContent />;
}
