import { useEffect, useId, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { assignCase, listUsers, type UserSummary } from "@/services/api/casesApi";
import { roleLabel } from "@/lib/permissions";
import type { CaseDetail } from "@/types/case";

const PURPOSES = [
  { value: "investigation", label: "Investigation" },
  { value: "review", label: "Review of candidate matches" },
  { value: "analysis", label: "Analysis" },
  { value: "evidence handling", label: "Evidence handling" },
  { value: "audit", label: "Audit" },
];

/**
 * Assign a colleague to the case (POST /cases/{id}/assign; owner or administrator only — the server checks).
 * Lists users in the case's jurisdiction who are not yet assigned; people outside it would still be refused access.
 */
export function AssignPersonDialog({ caseData, open, onOpenChange, onAssigned }: {
  caseData: CaseDetail; open: boolean; onOpenChange: (o: boolean) => void; onAssigned: () => void;
}) {
  const ids = { user: useId(), purpose: useId(), err: useId() };
  const [users, setUsers] = useState<UserSummary[] | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [purpose, setPurpose] = useState(PURPOSES[0].value);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUsername(""); setPurpose(PURPOSES[0].value); setError(null); setUsers(null); setUsersError(null);
    listUsers().then(setUsers).catch((e) => setUsersError(e?.status === 403 ? "forbidden" : (e?.message || "unavailable")));
  }, [open]);

  const assigned = new Set(caseData.assigned);
  const candidates = (users ?? []).filter((u) => u.jurisdiction === caseData.jurisdiction && !assigned.has(u.user_id));

  const submit = async () => {
    if (!username.trim()) return setError("Choose a person.");
    setBusy(true); setError(null);
    try {
      await assignCase(caseData.id, username.trim(), purpose);
      onAssigned();
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.status === 404 ? "No user with that username." : e?.status === 403 ? (e?.message || "Only the case owner or an administrator may assign people.") : (e?.message || "The assignment was not recorded."));
    } finally { setBusy(false); }
  };
  const field = "mt-1 block w-full rounded-md border border-border-strong bg-surface-1 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-electric-blue-soft";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent data-testid="assign-dialog">
        <DialogHeader>
          <DialogTitle>Add a person to {caseData.id}</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            They will be able to open this case. People outside {caseData.jurisdiction} are refused by the server even if assigned. The assignment is recorded in the audit log.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <div>
            <label htmlFor={ids.user} className="text-sm font-medium">Person</label>
            {usersError ? (
              <>
                <input id={ids.user} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" className={field} autoFocus />
                <span className="text-xs text-text-secondary">The user list is not available to your role; enter the username.</span>
              </>
            ) : users === null ? (
              <p className="mt-1 text-sm text-text-secondary">Loading people…</p>
            ) : candidates.length === 0 ? (
              <p className="mt-1 text-sm text-text-secondary">Everyone in {caseData.jurisdiction} is already on this case.</p>
            ) : (
              <select id={ids.user} value={username} onChange={(e) => setUsername(e.target.value)} className={field} autoFocus>
                <option value="">Choose…</option>
                {candidates.map((u) => <option key={u.user_id} value={u.username}>{u.display_name} — {roleLabel(u.role)}</option>)}
              </select>
            )}
          </div>
          <div>
            <label htmlFor={ids.purpose} className="text-sm font-medium">Purpose</label>
            <select id={ids.purpose} value={purpose} onChange={(e) => setPurpose(e.target.value)} className={field}>
              {PURPOSES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          {error && <p id={ids.err} role="alert" className="text-sm text-critical-red">{error}</p>}
          <DialogFooter className="gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={busy}>{busy ? "Adding…" : "Add to case"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
