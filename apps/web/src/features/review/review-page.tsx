import { useCallback, useEffect, useId, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, PauseCircle, RotateCcw, Search, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge, reviewStatusInfo } from "@/components/ui/status-badge";
import { ReasonDialog } from "@/components/ui/reason-dialog";
import { CaseTabBody, EmptyState, ErrorState, LoadingState, Pager, Section } from "@/components/layout/page";
import { useDebounced } from "@/lib/use-debounced";
import { useAuthStore } from "@/stores/authStore";
import { can, deniedReason } from "@/lib/permissions";
import { useCase } from "@/features/cases/case-context";
import { formatDateTime } from "@/features/cases/evidence/evidence-format";
import { candidatesSummary, decide, getCandidate, searchCandidates, type Candidate, type Decision, type RecordProfile, type Signal } from "./review-api";
import { SourcePane } from "./source-pane";

const FILTERS = [
  { id: "open", label: "Needs review", states: "REVIEW_REQUIRED" },
  { id: "deferred", label: "Deferred", states: "DEFER" },
  { id: "decided", label: "Decided", states: "APPROVE,REJECT" },
  { id: "all", label: "All", states: undefined },
] as const;
const PAGE_SIZE = 25;
type FilterId = (typeof FILTERS)[number]["id"];

const pct = (x: number) => `${Math.round(x * 100)}%`;
const pair = (c: Candidate) => `${c.left.label} ↔ ${c.right.label}`;

/**
 * Review queue: identity-match candidates that need a human decision (docs/context.md §6: "human review:
 * accept/reject/defer/reverse"). Works directly on the API's candidate shape; the previous screen converted it to an
 * invented task model (hard-coded "HIGH" priority, a 24-hour "SLA", reviewer IDs shown as officer names).
 */
export function ReviewQueuePage() {
  const { taskId } = useParams();
  return taskId ? <CandidateDetail candidateId={taskId} /> : <Queue />;
}

function Queue() {
  const { caseId } = useCase();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Candidate[] | null>(null);
  const [total, setTotal] = useState(0);
  const [byState, setByState] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<{ message: string; trace?: string } | null>(null);
  const [filter, setFilter] = useState<FilterId>("open");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const q = useDebounced(query.trim(), 300);
  const searchId = useId();

  useEffect(() => { setOffset(0); }, [q, filter]);
  // Filter, search and paging run on the server; counts come from GET /cases/{id}/candidates/summary.
  const load = useCallback(() => {
    setError(null);
    const f = FILTERS.find((x) => x.id === filter)!;
    searchCandidates(caseId, { state: f.states, q, limit: PAGE_SIZE, offset })
      .then((r) => { setRows(r.items); setTotal(r.total); })
      .catch((e) => setError({ message: e?.message || "Request failed", trace: e?.trace }));
    candidatesSummary(caseId).then((r) => setByState(r.by_state)).catch(() => setByState(null));
  }, [caseId, filter, q, offset]);
  useEffect(load, [load]);

  const count = (id: FilterId) => {
    if (!byState) return null;
    const f = FILTERS.find((x) => x.id === id)!;
    return f.states ? f.states.split(",").reduce((n, st) => n + (byState[st] || 0), 0) : Object.values(byState).reduce((a, b) => a + b, 0);
  };
  const base = `/cases/${encodeURIComponent(caseId)}/review`;

  return (
    <CaseTabBody title="Review queue" description="Possible matches between records. A shared name, phone or organisation is a candidate, not proof that two records are the same person — nothing is merged without a recorded human decision.">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div role="tablist" aria-label="Filter candidates" className="inline-flex flex-wrap gap-1 rounded-lg bg-surface-2 p-1">
          {FILTERS.map((f) => (
            <button key={f.id} role="tab" type="button" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}
              className={`rounded-md px-3 py-1.5 text-sm ${filter === f.id ? "bg-surface-1 font-semibold text-text-primary shadow-xs" : "text-text-secondary hover:text-text-primary"}`}>
              {f.label}{count(f.id) !== null && <span className="tabular-nums text-text-secondary"> ({count(f.id)})</span>}
            </button>
          ))}
        </div>
        <div className="min-w-[14rem]">
          <label htmlFor={searchId} className="sr-only">Search candidates by name</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <input id={searchId} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search names"
              className="w-full rounded-md border border-border-strong bg-surface-1 py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-electric-blue-soft" />
          </div>
        </div>
      </div>
      {error ? <ErrorState message={error.message} trace={error.trace} onRetry={load} /> : rows === null ? <LoadingState label="Loading candidates…" /> : rows.length === 0 ? (
        <EmptyState title={filter === "open" && !q ? "Nothing waits for review" : "No candidates here"} icon={CheckCircle2}>
          {filter === "open" && !q ? "Every candidate in this case has a decision." : "Choose another filter or clear the search."}
        </EmptyState>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border-subtle bg-surface-1">
            <table className="w-full text-sm" data-testid="review-queue">
              <caption className="sr-only">Candidates — {FILTERS.find((x) => x.id === filter)!.label}</caption>
              <thead className="bg-surface-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                <tr>
                  <th scope="col" className="px-3 py-2">Records</th>
                  <th scope="col" className="px-3 py-2 text-right">Matcher score</th>
                  <th scope="col" className="px-3 py-2 hidden md:table-cell">Why suggested</th>
                  <th scope="col" className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {rows.map((c) => (
                  <tr key={c.candidate_id} className="cursor-pointer hover:bg-surface-2/60" onClick={() => navigate(`${base}/${c.candidate_id}`)}>
                    <td className="px-3 py-2.5">
                      <Link to={`${base}/${c.candidate_id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-electric-blue hover:underline">{pair(c)}</Link>
                      {c.conflicts?.length > 0 && <span className="ml-2 text-xs text-orange-dim">{c.conflicts.length} conflict{c.conflicts.length === 1 ? "" : "s"}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{pct(c.confidence)}</td>
                    <td className="px-3 py-2.5 hidden md:table-cell text-text-secondary">{(c.positive_signals || []).map((s) => (s.signal || "").replace(/_/g, " ")).filter(Boolean).join(", ") || "—"}</td>
                    <td className="px-3 py-2.5"><StatusBadge kind="review" code={c.state} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager offset={offset} limit={PAGE_SIZE} total={total} onChange={setOffset} label="candidates" />
        </>
      )}
      <p className="text-xs text-text-secondary">The matcher score orders the queue; it is not a probability that the records are the same person.</p>
    </CaseTabBody>
  );
}

const ACTIONS: Record<Decision, { label: string; title: string; icon: typeof CheckCircle2; help: string; destructive?: boolean }> = {
  APPROVE: { label: "Same person — approve match", title: "Approve: these records describe the same person", icon: CheckCircle2, help: "The two records will be shown as one person in the graph. You can reverse this later." },
  REJECT: { label: "Different people — reject", title: "Reject: these records describe different people", icon: XCircle, help: "The records stay separate. You can reverse this later." },
  DEFER: { label: "Defer — needs more information", title: "Defer: not enough information to decide", icon: PauseCircle, help: "The candidate stays out of the graph and is listed under Deferred." },
  REVERSE: { label: "Reverse decision", title: "Reverse the last decision", icon: RotateCcw, help: "The candidate returns to “Needs review”. The earlier decision stays in the history, superseded by this one.", destructive: true },
};

function CandidateDetail({ candidateId }: { candidateId: string }) {
  const { caseId, personName, reload: reloadCase } = useCase();
  const role = useAuthStore((s) => s.user?.role);
  const navigate = useNavigate();
  const [c, setC] = useState<Candidate | null>(null);
  const [error, setError] = useState<{ message: string; trace?: string; status?: number } | null>(null);
  const [pending, setPending] = useState<Decision | null>(null);
  const [done, setDone] = useState<{ decision: Decision; next: string | null } | null>(null);
  const base = `/cases/${encodeURIComponent(caseId)}/review`;

  const load = useCallback(() => {
    setError(null);
    getCandidate(candidateId).then(setC).catch((e) => setError({ message: e?.message || "Request failed", trace: e?.trace, status: e?.status }));
  }, [candidateId]);
  useEffect(() => { setC(null); setDone(null); load(); }, [load]);

  const submit = async (reason: string): Promise<string | null> => {
    if (!pending) return null;
    try {
      const updated = await decide(candidateId, pending, reason);
      setC(updated);
      const next = (await searchCandidates(caseId, { state: "REVIEW_REQUIRED", limit: 2 }).catch(() => ({ items: [] as Candidate[], total: 0 })))
        .items.find((x) => x.candidate_id !== candidateId);
      setDone({ decision: pending, next: next?.candidate_id ?? null });
      reloadCase();
      return null;
    } catch (e: any) {
      return e?.status === 403 ? deniedReason(role, "record review decisions") : (e?.message || "The decision was not recorded.");
    }
  };

  const back = <Button asChild variant="ghost" size="sm" className="gap-1.5 -ml-2"><Link to={base}><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to queue</Link></Button>;
  if (error) return <CaseTabBody title="Candidate" actions={back}>{error.status === 404 ? <EmptyState title="Candidate not found">It may belong to another case.</EmptyState> : <ErrorState message={error.message} trace={error.trace} onRetry={load} />}</CaseTabBody>;
  if (!c) return <CaseTabBody title="Candidate" actions={back}><LoadingState label="Loading candidate…" /></CaseTabBody>;

  const open = c.state === "REVIEW_REQUIRED" || c.state === "DEFER";
  const decided = c.reviews.length > 0 && c.reviews[c.reviews.length - 1].decision !== "REVERSE";
  const mayDecide = can(role, "decide");

  return (
    <CaseTabBody wide title={pair(c)} actions={back}
      description={<>Matcher score {pct(c.confidence)} · <StatusBadge kind="review" code={c.state} /> · <span className="font-mono text-xs">{c.candidate_id}</span></>}>
      {done && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-verified-emerald/40 bg-verified-emerald/10 px-4 py-3" data-testid="decision-recorded">
          <p className="text-sm text-text-primary"><strong>Recorded:</strong> {reviewStatusInfo(done.decision).label}. The decision and your reason are in the case audit log.</p>
          <div className="flex gap-2">
            {done.next && <Button asChild variant="primary" size="sm"><Link to={`${base}/${done.next}`}>Next candidate</Link></Button>}
            <Button asChild variant="secondary" size="sm"><Link to={base}>Back to queue</Link></Button>
          </div>
        </div>
      )}
      {!!c.new_evidence_since_snapshot?.length && (
        <p className="rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-text-primary">
          {c.new_evidence_since_snapshot.length} evidence item(s) about these records arrived after the signals below were computed. Check the source before deciding.
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-4 min-w-0">
          <Section title="The two records side by side" description="What each record says. Differences are highlighted.">
            <CompareTable a={c.left} b={c.right} />
          </Section>
          <Section title="Why this is a candidate" description="Matcher output. A shared identifier is a candidate relationship, not proof of identity.">
            <SignalList title="Supporting signals" items={c.positive_signals} empty="None returned." />
            <SignalList title="Counter-evidence" items={c.counter_evidence} empty="None found." />
            <SignalList title="Conflicts" items={c.conflicts} empty="None found." />
            <div className="mt-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Missing information</h4>
              {c.missing?.length ? (
                <ul className="mt-1 list-disc pl-5 text-sm text-text-primary">
                  {c.missing.map((m, i) => <li key={i}>{m.attribute}{m.missing_on?.length ? ` — missing on the ${m.missing_on.join(" and ")} record` : ""}</li>)}
                </ul>
              ) : <p className="mt-1 text-sm text-text-secondary">Nothing reported missing.</p>}
            </div>
          </Section>

          <Section title="Decision" id="decision">
            {!mayDecide ? <p className="text-sm text-text-secondary">{deniedReason(role, "record review decisions")} You can read everything on this page.</p> : (
              <div className="space-y-3">
                {open && (
                  <div className="flex flex-wrap gap-2">
                    {(["APPROVE", "REJECT", "DEFER"] as Decision[]).map((d) => {
                      const A = ACTIONS[d]; const Icon = A.icon;
                      return <Button key={d} variant={d === "APPROVE" ? "primary" : "secondary"} className="gap-1.5" onClick={() => setPending(d)}><Icon className="h-4 w-4" aria-hidden="true" />{A.label}</Button>;
                    })}
                  </div>
                )}
                {decided && (
                  <Button variant="destructive" className="gap-1.5" onClick={() => setPending("REVERSE")}><RotateCcw className="h-4 w-4" aria-hidden="true" />Reverse decision</Button>
                )}
                <p className="text-xs text-text-secondary">Every decision needs a reason in your own words. It is recorded with your name and time, and can be reversed later.</p>
              </div>
            )}
            {c.reviews.length > 0 && (
              <div className="mt-4">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">History</h4>
                <ol className="mt-1 divide-y divide-border-subtle" data-testid="decision-history">
                  {[...c.reviews].reverse().map((r) => (
                    <li key={r.review_id} className="py-2 text-sm">
                      <div className="flex flex-wrap items-center gap-2"><StatusBadge kind="review" code={r.decision} /><span className="text-text-secondary text-xs">{personName(r.reviewer_id)} · {formatDateTime(r.created_at)}</span></div>
                      <p className="mt-1 text-text-primary">{r.reason}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </Section>
        </div>
        <SourcePane evidenceIds={c.evidence_ids} />
      </div>

      <ReasonDialog open={!!pending} onOpenChange={(o) => { if (!o) setPending(null); }}
        title={pending ? ACTIONS[pending].title : ""} description={pending ? <>{pair(c)}. {ACTIONS[pending].help}</> : ""}
        confirmLabel={pending === "REVERSE" ? "Reverse decision" : "Record decision"} destructive={pending === "REVERSE"} minLength={10}
        onConfirm={submit} placeholder="What in the evidence supports this decision?" />
    </CaseTabBody>
  );
}

function CompareTable({ a, b }: { a: RecordProfile; b: RecordProfile }) {
  const rows: { label: string; key: keyof RecordProfile }[] = [
    { label: "Names", key: "names" }, { label: "Aliases", key: "aliases" }, { label: "Date of birth", key: "dob" },
    { label: "Address", key: "address" }, { label: "Phones", key: "phones" }, { label: "Accounts", key: "accounts" },
    { label: "Organisations", key: "orgs" }, { label: "Evidence files", key: "evidence_ids" },
  ];
  const fmt = (v: unknown) => (Array.isArray(v) && v.length ? v.join(", ") : "—");
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" data-testid="compare-table">
        <caption className="sr-only">Record comparison</caption>
        <thead className="text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
          <tr><th scope="col" className="py-1.5 pr-3 w-32"><span className="sr-only">Attribute</span></th><th scope="col" className="py-1.5 pr-3">Record A: {a.label}</th><th scope="col" className="py-1.5">Record B: {b.label}</th></tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {rows.map(({ label, key }) => {
            const x = fmt(a[key]), y = fmt(b[key]);
            const differs = x !== "—" && y !== "—" && x !== y;
            return (
              <tr key={label} className={differs ? "bg-amber/10" : undefined}>
                <th scope="row" className="py-1.5 pr-3 text-left text-xs font-medium text-text-secondary align-top">{label}{differs && <span className="sr-only"> (differs)</span>}</th>
                <td className="py-1.5 pr-3 align-top break-words">{x}</td>
                <td className="py-1.5 align-top break-words">{y}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SignalList({ title, items, empty }: { title: string; items: Signal[]; empty: string }) {
  const text = (s: Signal) => [String(s.signal || s.attribute || s.kind || "").replace(/_/g, " "), s.detail || (s as any).value || (s as any).note].filter(Boolean).join(": ") || JSON.stringify(s);
  return (
    <div className="mt-3 first:mt-0">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{title}</h4>
      {items?.length ? (
        <ul className="mt-1 space-y-1 text-sm">
          {items.map((s, i) => (
            <li key={i} className="text-text-primary">
              {text(s)}{typeof s.weight === "number" && <span className="text-text-secondary"> (weight {s.weight})</span>}
              {s.caveat && <span className="block text-xs text-amber-dim">Note: {s.caveat}</span>}
            </li>
          ))}
        </ul>
      ) : <p className="mt-1 text-sm text-text-secondary">{empty}</p>}
    </div>
  );
}

