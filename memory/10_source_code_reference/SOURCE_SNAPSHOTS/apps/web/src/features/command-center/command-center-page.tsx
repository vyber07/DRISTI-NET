import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, FileStack, FolderOpen, Hourglass, LayoutDashboard, PieChart, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState, PageBody, PageHeader, Section } from "@/components/layout/page";
import { BarList, EVIDENCE_GROUP_COLORS, EVIDENCE_GROUP_LABEL, SegmentedBar, StatTile, evidenceGroup } from "@/components/ui/charts";
import { useAuthStore } from "@/stores/authStore";
import { can, roleLabel } from "@/lib/permissions";
import { listCases } from "@/services/api/casesApi";
import { getEvidenceSummary } from "@/services/api/evidenceApi";
import type { CaseSummary } from "@/types/case";
import { CaseTable } from "@/features/cases/case-table";

/**
 * Home: the signed-in officer's cases, the work waiting in them, and where their evidence stands.
 * Every number comes from the API for cases this account may open (GET /cases, GET /cases/{id}/evidence/summary).
 */
export function CommandCenterPage() {
  const { user } = useAuthStore();
  const [cases, setCases] = useState<CaseSummary[] | null>(null);
  const [error, setError] = useState<{ message: string; trace?: string } | null>(null);
  const [byGroup, setByGroup] = useState<Record<string, number> | null>(null);

  const load = useCallback(() => {
    setError(null);
    setCases(null);
    setByGroup(null);
    listCases().then((r) => {
      setCases(r.data);
      // Evidence status across the officer's cases: only cases that have evidence, at most 20 requests.
      const withEvidence = r.data.filter((c) => c.evidence_count > 0).slice(0, 20);
      Promise.all(withEvidence.map((c) => getEvidenceSummary(c.id).catch(() => null))).then((sums) => {
        const g: Record<string, number> = {};
        for (const s of sums) if (s) for (const [st, n] of Object.entries(s.by_status)) g[evidenceGroup(st)] = (g[evidenceGroup(st)] || 0) + n;
        setByGroup(g);
      });
    }).catch((e) => setError({ message: e?.message || "Request failed", trace: e?.trace }));
  }, []);
  useEffect(load, [load]);

  const waiting = (cases ?? []).filter((c) => c.pending_reviews > 0).sort((a, b) => b.pending_reviews - a.pending_reviews);
  const totals = {
    cases: cases?.length ?? 0,
    evidence: (cases ?? []).reduce((s, c) => s + c.evidence_count, 0),
    pending: (cases ?? []).reduce((s, c) => s + c.pending_reviews, 0),
  };
  const decides = can(user?.role, "decide");
  const first = user?.display_name?.split(" ")[0] ?? "";

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <PageHeader
        icon={<LayoutDashboard className="h-5 w-5" />}
        title={`Welcome${first ? `, ${first}` : ""}`}
        description={`${roleLabel(user?.role)} · ${user?.jurisdiction ?? ""}. Your cases and the work waiting in them.`}
        actions={can(user?.role, "globalAudit") ? <Button asChild variant="secondary" size="sm" className="gap-1.5"><Link to="/audit"><ScrollText className="h-3.5 w-3.5" aria-hidden="true" />Audit log</Link></Button> : undefined}
      />
      <PageBody>
        {error ? <ErrorState message={error.message} trace={error.trace} onRetry={load} /> : cases === null ? <LoadingState label="Loading your cases…" /> : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Summary">
              <StatTile icon={<FolderOpen className="h-5 w-5" />} label="Cases you can open" value={totals.cases} tone="teal" />
              <StatTile icon={<FileStack className="h-5 w-5" />} label="Evidence items" value={totals.evidence} tone="blue" />
              <StatTile icon={<Hourglass className="h-5 w-5" />} label="Candidates awaiting review" value={totals.pending} tone="amber"
                hint={totals.pending ? `in ${waiting.length} case${waiting.length === 1 ? "" : "s"}` : "nothing waiting"} />
            </div>

            <div className="grid gap-4 lg:grid-cols-5">
              <Section className="lg:col-span-3" title="Waiting for review" id="waiting" icon={<Hourglass className="h-4 w-4" />}
                description={decides ? "Candidate matches that need your decision, per case." : "Candidate matches waiting for a reviewer. Your role can view them but not decide."}>
                {waiting.length === 0 ? (
                  <p className="text-sm text-text-secondary">Nothing is waiting for review in your cases.</p>
                ) : (
                  <div data-testid="waiting-for-review">
                    <BarList title="Candidates awaiting review by case" valueLabel="awaiting review" testId="waiting-chart"
                      items={waiting.slice(0, 8).map((c) => ({
                        key: c.id, text: `${c.title} (${c.id})`, value: c.pending_reviews,
                        label: <Link className="hover:underline" to={`/cases/${encodeURIComponent(c.id)}/review`}>{c.title} <span className="font-mono text-xs text-text-secondary">{c.id}</span></Link>,
                      }))}
                      render={(id) => (
                        <Button asChild variant={decides ? "primary" : "secondary"} size="sm" className="h-7 gap-1">
                          <Link to={`/cases/${encodeURIComponent(id)}/review`} aria-label={`Review candidates in ${id}`}>{decides ? "Review" : "View"}<ArrowRight className="h-3 w-3" aria-hidden="true" /></Link>
                        </Button>
                      )} />
                  </div>
                )}
              </Section>
              <Section className="lg:col-span-2" title="Evidence status" id="ev-status" icon={<PieChart className="h-4 w-4" />}
                description="Where the files in your cases stand in processing.">
                {byGroup === null ? <p className="text-sm text-text-secondary">Loading…</p> : (
                  <SegmentedBar title="Evidence by status across your cases" unit="files" testId="home-evidence-chart"
                    parts={(Object.keys(EVIDENCE_GROUP_COLORS) as (keyof typeof EVIDENCE_GROUP_COLORS)[]).map((k) => ({
                      key: k, label: EVIDENCE_GROUP_LABEL[k], value: byGroup[k] || 0, color: EVIDENCE_GROUP_COLORS[k],
                    }))} />
                )}
              </Section>
            </div>

            <Section title="Your cases" id="your-cases" icon={<FolderOpen className="h-4 w-4" />}
              actions={<Link to="/cases" className="inline-flex items-center gap-1 text-sm text-electric-blue hover:underline">All cases <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>}>
              {cases.length === 0 ? (
                <EmptyState title="No cases assigned to you">Cases appear here once an administrator or case owner assigns you within your jurisdiction.</EmptyState>
              ) : (
                <CaseTable cases={cases.slice(0, 8)} caption="Your cases" />
              )}
              {cases.length > 8 && <p className="mt-2 text-xs text-text-secondary">Showing 8 of {cases.length}. <Link to="/cases" className="text-electric-blue underline underline-offset-2">See all</Link></p>}
            </Section>
          </>
        )}
      </PageBody>
    </div>
  );
}
