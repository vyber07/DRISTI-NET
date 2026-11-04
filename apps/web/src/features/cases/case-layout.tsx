import { NavLink, Outlet, useParams } from "react-router-dom";
import { Breadcrumbs, DeniedState, ErrorState, LoadingState } from "@/components/layout/page";
import { ProvenanceViewer } from "@/components/evidence/ProvenanceViewer";
import { CaseProvider, useCaseLoader } from "./case-context";
import { cn } from "@/lib/utils";

/** Case tabs. Order follows the officer workflow: understand → evidence → review → explore → report → audit. */
export const CASE_TABS = [
  { path: "", label: "Overview", end: true },
  { path: "evidence", label: "Evidence" },
  { path: "review", label: "Review queue", countKey: "pending_reviews" as const },
  { path: "graph", label: "Relationship graph" },
  { path: "timeline", label: "Timeline" },
  { path: "locations", label: "Locations" },
  { path: "analysis", label: "Patterns" },
  { path: "decisions", label: "Decisions" },
  { path: "reports", label: "Reports" },
  { path: "audit", label: "Audit log" },
];

/**
 * One layout for every case page (replaces the three separate layouts the graph, review and reports pages used).
 * Loads the case once; a refused case shows the server's reason and nothing else (DEF-078).
 */
export function CaseLayout() {
  const { caseId = "" } = useParams();
  const [load, reload] = useCaseLoader(caseId);

  if (load.state === "loading") {
    return <div className="p-6"><LoadingState label={`Loading case ${caseId}…`} rows={2} /></div>;
  }
  if (load.state === "denied") {
    return <div className="p-6"><DeniedState message={`Case ${caseId}: ${load.message}`} /></div>;
  }
  if (load.state === "error") {
    return <div className="p-6 max-w-3xl mx-auto"><ErrorState message={load.message} trace={load.trace} onRetry={reload} /></div>;
  }

  const c = load.caseData;
  const base = `/cases/${encodeURIComponent(caseId)}`;
  return (
    <CaseProvider caseId={caseId} caseData={c} reload={reload}>
      <div className="flex h-full min-h-0 flex-col">
        <header className="shrink-0 border-b border-border-subtle bg-surface-1 px-4 sm:px-6 pt-3">
          <Breadcrumbs items={[{ label: "Cases", to: "/cases" }, { label: c.id }]} />
          <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h1 className="text-xl font-semibold text-text-primary tracking-tight min-w-0" data-testid="case-title">
              {c.title} <span className="font-mono text-sm font-medium text-text-secondary whitespace-nowrap">{c.id}</span>
            </h1>
            <p className="text-xs text-text-secondary flex flex-wrap gap-x-3">
              <span>{c.jurisdiction}</span>
              <span>{c.evidence_count} evidence item{c.evidence_count === 1 ? "" : "s"}</span>
              <span>{c.pending_reviews} awaiting review</span>
            </p>
          </div>
          <nav aria-label="Case sections" className="mt-2 -mb-px overflow-x-auto">
            <ul className="flex min-w-max gap-1">
              {CASE_TABS.map((t) => (
                <li key={t.path}>
                  <NavLink
                    to={t.path ? `${base}/${t.path}` : base}
                    end={t.end}
                    className={({ isActive }) => cn(
                      "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors",
                      isActive ? "border-electric-blue text-electric-blue font-semibold" : "border-transparent text-text-secondary hover:text-text-primary hover:border-border-strong",
                    )}
                  >
                    {t.label}
                    {t.countKey && c[t.countKey] > 0 && (
                      <span className="rounded-full bg-amber/15 px-1.5 text-xs font-semibold text-amber-dim" aria-label={`${c[t.countKey]} awaiting review`}>
                        {c[t.countKey]}
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </header>
        <div className="flex-1 min-h-0 flex flex-col">
          <Outlet />
        </div>
      </div>
      <ProvenanceViewer />
    </CaseProvider>
  );
}

