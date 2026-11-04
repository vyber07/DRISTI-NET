import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Hourglass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState, PageBody, PageHeader, Section } from "@/components/layout/page";
import { useAuthStore } from "@/stores/authStore";
import { can } from "@/lib/permissions";
import { listCases } from "@/services/api/casesApi";
import type { CaseSummary } from "@/types/case";
import { CaseTable } from "@/features/cases/case-table";

/**
 * Home: the signed-in officer's cases and the work waiting in them.
 * Every number comes from GET /cases (only cases this account may open). Removed: "SYSTEM ONLINE" (not derived
 * from anything) and duplicate per-case "Graph" buttons (the case tabs do that).
 */
export function CommandCenterPage() {
  const { user } = useAuthStore();
  const [cases, setCases] = useState<CaseSummary[] | null>(null);
  const [error, setError] = useState<{ message: string; trace?: string } | null>(null);

  const load = useCallback(() => {
    setError(null);
    setCases(null);
    listCases().then((r) => setCases(r.data)).catch((e) => setError({ message: e?.message || "Request failed", trace: e?.trace }));
  }, []);
  useEffect(load, [load]);

  const waiting = (cases ?? []).filter((c) => c.pending_reviews > 0);
  const totals = {
    cases: cases?.length ?? 0,
    evidence: (cases ?? []).reduce((s, c) => s + c.evidence_count, 0),
    pending: (cases ?? []).reduce((s, c) => s + c.pending_reviews, 0),
  };
  const decides = can(user?.role, "decide");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Home"
        description="Your cases and the work waiting in them."
        actions={can(user?.role, "globalAudit") ? <Button asChild variant="secondary" size="sm"><Link to="/audit">Audit log</Link></Button> : undefined}
      />
      <PageBody>
        {error ? <ErrorState message={error.message} trace={error.trace} onRetry={load} /> : cases === null ? <LoadingState label="Loading your cases…" /> : (
          <>
            <dl className="grid grid-cols-3 gap-3" aria-label="Summary">
              {[
                { label: "Cases you can open", value: totals.cases },
                { label: "Evidence items", value: totals.evidence },
                { label: "Candidates awaiting review", value: totals.pending },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-border-subtle bg-surface-1 px-4 py-3">
                  <dt className="text-xs font-medium text-text-secondary">{s.label}</dt>
                  <dd className="mt-1 text-2xl font-semibold tabular-nums text-text-primary">{s.value}</dd>
                </div>
              ))}
            </dl>

            <Section title="Waiting for review" id="waiting"
              description={decides ? "Candidate matches that need your decision." : "Candidate matches waiting for a reviewer. Your role can view them but not decide."}>
              {waiting.length === 0 ? (
                <p className="text-sm text-text-secondary">Nothing is waiting for review in your cases.</p>
              ) : (
                <ul className="divide-y divide-border-subtle" data-testid="waiting-for-review">
                  {waiting.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{c.title}</p>
                        <p className="text-xs text-text-secondary"><span className="font-mono">{c.id}</span> · {c.jurisdiction}</p>
                      </div>
                      <Button asChild variant={decides ? "primary" : "secondary"} size="sm" className="gap-1.5">
                        <Link to={`/cases/${encodeURIComponent(c.id)}/review`}>
                          <Hourglass className="h-3.5 w-3.5" aria-hidden="true" />
                          {c.pending_reviews} to review
                        </Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Your cases" id="your-cases"
              actions={<Link to="/cases" className="inline-flex items-center gap-1 text-sm text-electric-blue hover:underline">All cases <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>}>
              {cases.length === 0 ? (
                <EmptyState title="No cases assigned to you">Cases appear here once an administrator or case owner assigns you within your jurisdiction.</EmptyState>
              ) : (
                <CaseTable cases={cases.slice(0, 8)} caption="Your cases" />
              )}
              {cases.length > 8 && <p className="mt-2 text-xs text-text-secondary">Showing 8 of {cases.length}. <Link to="/cases" className="text-electric-blue hover:underline">See all</Link></p>}
            </Section>
          </>
        )}
      </PageBody>
    </div>
  );
}
