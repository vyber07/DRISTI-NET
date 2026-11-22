import { useCallback, useEffect, useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderOpen, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, ErrorState, LoadingState, PageBody, PageHeader, Pager } from "@/components/layout/page";
import { createCase, searchCases } from "@/services/api/casesApi";
import { useAuthStore } from "@/stores/authStore";
import { can } from "@/lib/permissions";
import { useDebounced } from "@/lib/use-debounced";
import type { CaseSummary } from "@/types/case";
import { CaseTable } from "./case-table";

const PAGE_SIZE = 25;

/**
 * Cases: every case this account may open. Search and paging run on the server (GET /cases?q=&awaiting_review=&limit=&offset=),
 * so the page stays fast however many cases exist, and a search can only ever return cases the server authorizes.
 */
export function CasesDirectoryPage() {
  const role = useAuthStore((s) => s.user?.role);
  const [rows, setRows] = useState<CaseSummary[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<{ message: string; trace?: string } | null>(null);
  const [query, setQuery] = useState("");
  const [onlyWaiting, setOnlyWaiting] = useState(false);
  const [offset, setOffset] = useState(0);
  const [creating, setCreating] = useState(false);
  const q = useDebounced(query.trim(), 300);
  const searchId = useId();

  useEffect(() => { setOffset(0); }, [q, onlyWaiting]);
  const load = useCallback(() => {
    setError(null);
    searchCases({ q, awaitingReview: onlyWaiting, limit: PAGE_SIZE, offset })
      .then((r) => { setRows(r.items); setTotal(r.total); })
      .catch((e) => setError({ message: e?.message || "Request failed", trace: e?.trace }));
  }, [q, onlyWaiting, offset]);
  useEffect(load, [load]);

  const filtered = q !== "" || onlyWaiting;
  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <PageHeader icon={<FolderOpen className="h-5 w-5" />} title="Cases" description="Every case you are assigned to in your jurisdiction. Open a case to see its evidence, reviews, graph and reports."
        actions={can(role, "createCase") ? (
          <Button variant="primary" className="gap-1.5" onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden="true" /> New case</Button>
        ) : undefined} />
      <PageBody>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[16rem]">
            <label htmlFor={searchId} className="text-xs font-medium text-text-secondary">Search your cases</label>
            <div className="relative mt-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
              <input id={searchId} type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Case number, title, purpose, jurisdiction or authority reference"
                className="w-full rounded-md border border-border-strong bg-surface-1 py-2 pl-8 pr-8 text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-electric-blue-soft" />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-text-secondary hover:text-text-primary">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-text-primary pb-2">
            <input type="checkbox" checked={onlyWaiting} onChange={(e) => setOnlyWaiting(e.target.checked)} className="h-4 w-4 accent-[var(--electric-blue)]" />
            Only cases awaiting review
          </label>
        </div>

        {error ? <ErrorState message={error.message} trace={error.trace} onRetry={load} /> : rows === null ? <LoadingState label="Loading cases…" /> : (
          <>
            <p className="text-xs text-text-secondary" role="status" aria-live="polite">
              {total} case{total === 1 ? "" : "s"}{filtered ? " match" : ""}
            </p>
            {rows.length === 0 ? (
              filtered ? <EmptyState title="No cases match">Try a different search, or clear the filters.</EmptyState>
                : <EmptyState title="No cases assigned to you">Ask a case owner or administrator to assign you to a case in your jurisdiction.</EmptyState>
            ) : (
              <CaseTable cases={rows} caption="Cases" sortable={total <= PAGE_SIZE} />
            )}
            <Pager offset={offset} limit={PAGE_SIZE} total={total} onChange={setOffset} label="cases" />
          </>
        )}
      </PageBody>
      <NewCaseDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}

/** Create a case (POST /cases). The creator becomes the owner; jurisdiction is the creator's own unless an administrator. */
function NewCaseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const ids = { id: useId(), title: useId(), purpose: useId(), auth: useId(), jur: useId(), err: useId() };
  const empty = { case_id: "", title: "", purpose: "", authority_reference: "", jurisdiction: user?.jurisdiction ?? "" };
  const [f, setF] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setF({ ...empty, jurisdiction: user?.jurisdiction ?? "" }); setError(null); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async () => {
    const body = { ...f, case_id: f.case_id.trim().toUpperCase(), title: f.title.trim(), purpose: f.purpose.trim(), authority_reference: f.authority_reference.trim(), jurisdiction: f.jurisdiction.trim() };
    if (!/^[A-Z0-9-]{4,32}$/.test(body.case_id)) return setError("Case number: 4–32 characters, capital letters, digits and hyphens (e.g. CASE-0101).");
    if (body.title.length < 3 || body.purpose.length < 3 || body.authority_reference.length < 3) return setError("Title, purpose and authority reference are required (at least 3 characters each).");
    setBusy(true); setError(null);
    try {
      const c = await createCase(body);
      onOpenChange(false);
      navigate(`/cases/${encodeURIComponent(c.id)}`);
    } catch (e: any) {
      setError(e?.status === 409 ? "A case with this number already exists." : e?.status === 403 ? (e?.message || "You may not create this case.") : (e?.message || "The case was not created."));
    } finally { setBusy(false); }
  };
  const field = "mt-1 block w-full rounded-md border border-border-strong bg-surface-1 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-electric-blue-soft";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent data-testid="new-case-dialog">
        <DialogHeader>
          <DialogTitle>New case</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">You become the case owner and can then assign colleagues. Creation is recorded in the audit log.</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }} aria-describedby={error ? ids.err : undefined}>
          <div><label htmlFor={ids.id} className="text-sm font-medium">Case number</label>
            <input id={ids.id} value={f.case_id} onChange={set("case_id")} placeholder="CASE-0101" autoFocus className={`${field} font-mono uppercase`} /></div>
          <div><label htmlFor={ids.title} className="text-sm font-medium">Title</label>
            <input id={ids.title} value={f.title} onChange={set("title")} maxLength={200} className={field} /></div>
          <div><label htmlFor={ids.purpose} className="text-sm font-medium">Purpose</label>
            <textarea id={ids.purpose} value={f.purpose} onChange={set("purpose")} rows={2} maxLength={500} className={field} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label htmlFor={ids.auth} className="text-sm font-medium">Authority reference</label>
              <input id={ids.auth} value={f.authority_reference} onChange={set("authority_reference")} placeholder="e.g. FIR or order number" maxLength={120} className={field} /></div>
            <div><label htmlFor={ids.jur} className="text-sm font-medium">Jurisdiction</label>
              <input id={ids.jur} value={f.jurisdiction} onChange={set("jurisdiction")} readOnly={user?.role !== "ADMIN"} maxLength={120}
                className={`${field} read-only:bg-surface-2`} aria-describedby={`${ids.jur}-h`} />
              <span id={`${ids.jur}-h`} className="text-xs text-text-secondary">{user?.role === "ADMIN" ? "Administrators may choose." : "Your own jurisdiction."}</span></div>
          </div>
          {error && <p id={ids.err} role="alert" className="text-sm text-critical-red">{error}</p>}
          <DialogFooter className="gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={busy}>{busy ? "Creating…" : "Create case"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
