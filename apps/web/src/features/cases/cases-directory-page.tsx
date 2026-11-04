import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { EmptyState, ErrorState, LoadingState, PageBody, PageHeader } from "@/components/layout/page";
import { listCases } from "@/services/api/casesApi";
import type { CaseSummary } from "@/types/case";
import { CaseTable } from "./case-table";

/**
 * Cases: every case this account may open. GET /cases returns the complete authorized list (no server-side search
 * or paging exists), so filtering it here searches everything the officer can see — and nothing else.
 */
export function CasesDirectoryPage() {
  const [cases, setCases] = useState<CaseSummary[] | null>(null);
  const [error, setError] = useState<{ message: string; trace?: string } | null>(null);
  const [query, setQuery] = useState("");
  const [onlyWaiting, setOnlyWaiting] = useState(false);
  const searchId = useId();

  const load = useCallback(() => {
    setError(null); setCases(null);
    listCases().then((r) => setCases(r.data)).catch((e) => setError({ message: e?.message || "Request failed", trace: e?.trace }));
  }, []);
  useEffect(load, [load]);

  const filtered = useMemo(() => {
    const t = query.trim().toLowerCase();
    return (cases ?? []).filter((c) =>
      (!onlyWaiting || c.pending_reviews > 0) &&
      (!t || [c.id, c.title, c.purpose, c.jurisdiction, c.authority_reference].some((v) => (v || "").toLowerCase().includes(t))));
  }, [cases, query, onlyWaiting]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Cases" description="Every case you are assigned to in your jurisdiction. Open a case to see its evidence, reviews, graph and reports." />
      <PageBody>
        {error ? <ErrorState message={error.message} trace={error.trace} onRetry={load} /> : cases === null ? <LoadingState label="Loading cases…" /> : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[16rem]">
                <label htmlFor={searchId} className="text-xs font-medium text-text-secondary">Search your {cases.length} cases</label>
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
            <p className="text-xs text-text-secondary" role="status" aria-live="polite">
              {filtered.length === cases.length ? `${cases.length} case${cases.length === 1 ? "" : "s"}` : `${filtered.length} of ${cases.length} cases match`}
            </p>
            {cases.length === 0 ? (
              <EmptyState title="No cases assigned to you">Ask a case owner or administrator to assign you to a case in your jurisdiction.</EmptyState>
            ) : filtered.length === 0 ? (
              <EmptyState title="No cases match">Try a different search, or clear the filters.</EmptyState>
            ) : (
              <CaseTable cases={filtered} caption="Cases" />
            )}
          </>
        )}
      </PageBody>
    </div>
  );
}
