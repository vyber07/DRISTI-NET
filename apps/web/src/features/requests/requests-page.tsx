import { useCallback, useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import { Inbox, Plus, RefreshCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, LoadingState, PageBody, PageHeader, Pager, Section } from "@/components/layout/page";
import { useAuthStore } from "@/stores/authStore";
import { can } from "@/lib/permissions";
import { useDebounced } from "@/lib/use-debounced";
import {
  type RequestMeta, type RequestStatus, type RequestSummary, type UserRequest, STATUS_LABEL, STATUS_TONE,
  getRequestMeta, getRequestSummary, listRequests,
} from "@/services/api/userRequestsApi";
import { NewRequestDialog } from "./new-request-dialog";

const PAGE_SIZE = 25;
const select = "rounded-md border border-border-strong bg-surface-1 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-electric-blue-soft";
const OPEN = "DRAFT,PENDING,UNDER_REVIEW,APPROVED";
const TABS: { key: string; label: string; statuses: string }[] = [
  { key: "open", label: "Open", statuses: OPEN },
  { key: "PENDING", label: "Pending", statuses: "PENDING" },
  { key: "UNDER_REVIEW", label: "Under review", statuses: "UNDER_REVIEW" },
  { key: "APPROVED", label: "Approved", statuses: "APPROVED" },
  { key: "closed", label: "Closed", statuses: "COMPLETED,REJECTED,CANCELLED" },
  { key: "all", label: "All", statuses: "" },
];

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function count(summary: RequestSummary | null, statuses: string): number | null {
  if (!summary) return null;
  if (!statuses) return Object.values(summary.by_status).reduce((a, b) => a + b, 0);
  return statuses.split(",").reduce((a, s) => a + (summary.by_status[s as RequestStatus] ?? 0), 0);
}

/**
 * Requests (GET /user-requests): your own requests, or, for administrators and auditors, everyone's. Filters, search
 * and paging run on the server; it decides what each account may see.
 */
export function RequestsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const mayViewAll = can(role, "viewAllUserRequests");
  const mayReview = can(role, "reviewUserRequests");
  const [scope, setScope] = useState<"mine" | "all">(mayReview ? "all" : "mine");
  const [tab, setTab] = useState(mayReview ? "PENDING" : "open");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const [assignedToMe, setAssignedToMe] = useState(false);
  const [query, setQuery] = useState("");
  const [requester, setRequester] = useState("");
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<UserRequest[] | null>(null);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<RequestSummary | null>(null);
  const [meta, setMeta] = useState<RequestMeta | null>(null);
  const [error, setError] = useState<{ message: string; trace?: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const q = useDebounced(query.trim(), 300);
  const who = useDebounced(requester.trim(), 300);
  const ids = { q: useId(), cat: useId(), prio: useId(), who: useId() };

  useEffect(() => { getRequestMeta().then(setMeta).catch(() => setMeta(null)); }, []);
  useEffect(() => { setOffset(0); }, [scope, tab, category, priority, assignedToMe, q, who]);

  const load = useCallback(() => {
    setRows(null); setError(null);
    const statuses = TABS.find((t) => t.key === tab)?.statuses ?? "";
    listRequests({ scope, status: statuses || undefined, category: category || undefined, priority: priority || undefined,
                   q: q || undefined, requester: scope === "all" ? who || undefined : undefined,
                   assigned_to_me: scope === "all" && assignedToMe, sort: tab === "PENDING" ? "created" : "-updated",
                   limit: PAGE_SIZE, offset })
      .then((p) => { setRows(p.items); setTotal(p.total); })
      .catch((e) => setError({ message: e?.message || "Requests could not be loaded.", trace: e?.trace }));
    getRequestSummary(scope).then(setSummary).catch(() => setSummary(null));
  }, [scope, tab, category, priority, assignedToMe, q, who, offset]);
  useEffect(load, [load]);

  const filtered = !!(category || priority || q || who || assignedToMe);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={<Inbox className="h-5 w-5" />}
        title="Requests"
        description={mayReview
          ? "Requests from officers for case access, role changes, temporary permissions, data corrections and support. Claim one to review it."
          : "Ask an administrator for case access, a role change, a temporary permission, a data correction or support, and follow its progress."}
        actions={<>
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={load}><RefreshCw className="h-4 w-4" /> Refresh</Button>
          {can(role, "createUserRequest") && <Button variant="primary" size="sm" className="gap-1.5" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New request</Button>}
        </>}
      />
      <PageBody>
        {mayViewAll && (
          <div className="flex gap-1.5" role="tablist" aria-label="Whose requests">
            {(["all", "mine"] as const).map((s) => (
              <Button key={s} role="tab" aria-selected={scope === s} size="sm" variant={scope === s ? "secondary" : "ghost"} onClick={() => setScope(s)}>
                {s === "all" ? "All requests" : "My requests"}
              </Button>
            ))}
          </div>
        )}
        <Section>
          <div className="space-y-3 p-4">
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by status">
              {TABS.map((t) => {
                const n = count(summary, t.statuses);
                return (
                  <Button key={t.key} role="tab" aria-selected={tab === t.key} size="sm" variant={tab === t.key ? "secondary" : "ghost"}
                    className="h-8 gap-1.5 text-xs" onClick={() => setTab(t.key)}>
                    {t.label}{n !== null && <span className="rounded bg-surface-2 px-1.5 text-xs text-text-secondary">{n}</span>}
                  </Button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1">
                <label htmlFor={ids.q} className="text-xs font-medium text-text-secondary">Search title, reason, case or reference</label>
                <div className="relative mt-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
                  <input id={ids.q} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. UR-000012"
                    className={`${select} w-full pl-8`} />
                  {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-text-secondary"><X className="h-4 w-4" /></button>}
                </div>
              </div>
              <div>
                <label htmlFor={ids.cat} className="block text-xs font-medium text-text-secondary">Type</label>
                <select id={ids.cat} value={category} onChange={(e) => setCategory(e.target.value)} className={`${select} mt-1`}>
                  <option value="">All types</option>
                  {meta?.categories.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor={ids.prio} className="block text-xs font-medium text-text-secondary">Priority</label>
                <select id={ids.prio} value={priority} onChange={(e) => setPriority(e.target.value)} className={`${select} mt-1`}>
                  <option value="">Any</option>
                  {(meta?.priorities ?? []).map((p) => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
                </select>
              </div>
              {scope === "all" && (
                <>
                  <div>
                    <label htmlFor={ids.who} className="block text-xs font-medium text-text-secondary">Requested by</label>
                    <input id={ids.who} value={requester} onChange={(e) => setRequester(e.target.value)} placeholder="name or username" className={`${select} mt-1`} />
                  </div>
                  {mayReview && (
                    <label className="flex items-center gap-2 pb-1.5 text-sm">
                      <input type="checkbox" checked={assignedToMe} onChange={(e) => setAssignedToMe(e.target.checked)} className="h-4 w-4" />
                      Claimed by me{summary?.assigned_to_me ? ` (${summary.assigned_to_me})` : ""}
                    </label>
                  )}
                </>
              )}
            </div>
          </div>
        </Section>

        {error ? <ErrorState message={error.message} trace={error.trace} onRetry={load} />
          : rows === null ? <LoadingState label="Loading requests…" />
          : rows.length === 0 ? (
            filtered ? <EmptyState title="No requests match">Try a different search, or clear the filters.</EmptyState>
              : <EmptyState title="No requests here" icon={Inbox}>{scope === "mine" ? "Requests you raise appear here with their status." : "Nothing is waiting in this list."}</EmptyState>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface-1">
              <table className="w-full text-sm" data-testid="requests-table">
                <thead className="bg-surface-2 text-xs uppercase text-text-muted">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Reference</th>
                    <th className="px-3 py-2 text-left font-medium">Request</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-left font-medium">Priority</th>
                    {scope === "all" && <th className="px-3 py-2 text-left font-medium">Requested by</th>}
                    <th className="px-3 py-2 text-left font-medium">Reviewer</th>
                    <th className="px-3 py-2 text-left font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {rows.map((r) => (
                    <tr key={r.request_id} className="align-top hover:bg-surface-2">
                      <td className="px-3 py-2.5 font-mono text-xs"><Link to={`/requests/${r.request_id}`} className="text-electric-blue hover:underline">{r.reference}</Link></td>
                      <td className="px-3 py-2.5">
                        <Link to={`/requests/${r.request_id}`} className="font-medium text-text-primary hover:underline">{r.title}</Link>
                        <div className="text-xs text-text-secondary">{r.category_label}{r.case_id ? ` · ${r.case_id}` : ""}</div>
                      </td>
                      <td className="px-3 py-2.5"><Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge></td>
                      <td className="px-3 py-2.5 text-xs">{r.priority === "URGENT" || r.priority === "HIGH" ? <Badge tone={r.priority === "URGENT" ? "red" : "orange"}>{r.priority.toLowerCase()}</Badge> : r.priority.toLowerCase()}</td>
                      {scope === "all" && <td className="px-3 py-2.5 text-xs">{r.requester.display_name || r.requester.username}</td>}
                      <td className="px-3 py-2.5 text-xs text-text-secondary">{r.reviewer ? r.reviewer.display_name || r.reviewer.username : "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-text-secondary whitespace-nowrap">{fmtTime(r.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        <Pager offset={offset} limit={PAGE_SIZE} total={total} onChange={setOffset} label="requests" />
      </PageBody>
      <NewRequestDialog open={creating} onOpenChange={setCreating} meta={meta} />
    </div>
  );
}
