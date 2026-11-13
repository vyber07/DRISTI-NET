import { useEffect, useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listGlobalAuditLogs } from "@/services/api/auditApi";
import { useAuthStore } from "@/stores/authStore";
import { can, deniedReason, roleLabel } from "@/lib/permissions";
import { DeniedState, EmptyState, ErrorState, LoadingState, PageBody, PageHeader, Section } from "@/components/layout/page";

interface AuditRow {
  audit_id: string;
  action: string;
  outcome: string;
  failure_reason?: string | null;
  actor_id: string | null;
  actor_username?: string | null;
  actor_role?: string | null;
  office_id?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
  target_id?: string | null;
  case_id?: string | null;
  created_at: string;
  occurred_at_local?: string;
  display_timezone?: string;
  request_id?: string;
}

/** Outcome as words plus a tone; red only for a refused or failed action (design system §1: status is never colour alone). */
function OutcomeBadge({ outcome }: { outcome: string }) {
  if (outcome === "OK") return <Badge tone="emerald">Allowed</Badge>;
  if (outcome === "DENIED") return <Badge tone="red">Denied</Badge>;
  if (outcome === "ERROR") return <Badge tone="red">Error</Badge>;
  return <Badge tone="amber">{outcome.charAt(0) + outcome.slice(1).toLowerCase()}</Badge>;
}

function when(r: AuditRow): string {
  return (r.occurred_at_local || r.created_at || "").replace("T", " ").slice(0, 19);
}

/**
 * Global audit log (AUDITOR, ADMIN), on the shared page layout (P2.1): a page heading, labelled filters, a semantic
 * table that names people by username and role (not by internal USR- key), outcome as words, and the shared loading,
 * error and empty states. Each case's own audit log (with signatures and full detail) stays on its Audit log tab.
 */
function GlobalAuditContent() {
  const ids = { q: useId(), action: useId(), outcome: useId() };
  const [logs, setLogs] = useState<AuditRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [outcome, setOutcome] = useState("");

  const load = () => {
    setLoading(true);
    setError(null);
    listGlobalAuditLogs(500)
      .then((r) => setLogs((r.data || []) as AuditRow[]))
      .catch((e) => setError(e?.message || "The audit log could not be loaded."))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const actions = useMemo(() => [...new Set((logs ?? []).map((l) => l.action))].sort(), [logs]);
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (logs ?? []).filter((l) =>
      (!action || l.action === action) && (!outcome || l.outcome === outcome) &&
      (!s || [l.action, l.actor_username, l.actor_id, l.target_id, l.resource_id, l.case_id, l.office_id]
        .some((v) => (v || "").toLowerCase().includes(s))));
  }, [logs, search, action, outcome]);
  const tz = logs?.[0]?.display_timezone;
  const field = "mt-1 block w-full rounded-md border border-border-strong bg-surface-1 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-electric-blue-soft";

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <PageHeader icon={<ScrollText className="h-5 w-5" />} title="Audit log"
        description="Every recorded action across all cases, newest first (the latest 500). Each case's Audit log tab has the full record, including signatures."
        actions={<Button variant="secondary" size="sm" className="gap-1.5" onClick={load} disabled={loading}>
          <RefreshCw className={loading ? "h-3.5 w-3.5 motion-safe:animate-spin" : "h-3.5 w-3.5"} aria-hidden="true" /> Refresh
        </Button>} />
      <PageBody wide>
        <form className="grid gap-3 sm:grid-cols-[1fr_14rem_10rem_auto] sm:items-end" role="search" onSubmit={(e) => e.preventDefault()}>
          <div>
            <label htmlFor={ids.q} className="text-xs font-medium text-text-secondary">Search</label>
            <input id={ids.q} type="search" value={search} onChange={(e) => setSearch(e.target.value)} className={field}
              placeholder="Action, person, office, target or case" />
          </div>
          <div>
            <label htmlFor={ids.action} className="text-xs font-medium text-text-secondary">Action</label>
            <select id={ids.action} value={action} onChange={(e) => setAction(e.target.value)} className={field}>
              <option value="">All actions</option>
              {actions.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={ids.outcome} className="text-xs font-medium text-text-secondary">Outcome</label>
            <select id={ids.outcome} value={outcome} onChange={(e) => setOutcome(e.target.value)} className={field}>
              <option value="">Any outcome</option>
              <option value="OK">Allowed</option>
              <option value="DENIED">Denied</option>
              <option value="ERROR">Error</option>
            </select>
          </div>
          {(search || action || outcome) && (
            <Button type="button" variant="ghost" size="sm" onClick={() => { setSearch(""); setAction(""); setOutcome(""); }}>Clear filters</Button>
          )}
        </form>

        {error ? <ErrorState message={error} onRetry={load} />
          : logs === null ? <LoadingState label="Loading the audit log…" rows={6} />
          : filtered.length === 0 ? <EmptyState title={logs.length ? "No events match these filters" : "No audit events yet"} />
          : (
            <Section title={`${filtered.length} of ${logs.length} events`} description={tz ? `Times in ${tz}.` : undefined}>
              <div className="-m-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Audit events</caption>
                  <thead className="sticky top-0 bg-surface-2 text-xs text-text-secondary">
                    <tr>
                      <th scope="col" className="px-4 py-2 text-left font-medium whitespace-nowrap">Time</th>
                      <th scope="col" className="px-4 py-2 text-left font-medium">Action</th>
                      <th scope="col" className="px-4 py-2 text-left font-medium">Outcome</th>
                      <th scope="col" className="px-4 py-2 text-left font-medium">Who</th>
                      <th scope="col" className="px-4 py-2 text-left font-medium">Target</th>
                      <th scope="col" className="px-4 py-2 text-left font-medium">Case</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {filtered.map((l) => (
                      <tr key={l.audit_id} className="align-top hover:bg-surface-2">
                        <td className="px-4 py-2 font-mono text-xs text-text-secondary whitespace-nowrap">{when(l)}</td>
                        <td className="px-4 py-2 font-mono text-xs text-text-primary">{l.action}</td>
                        <td className="px-4 py-2">
                          <OutcomeBadge outcome={l.outcome} />
                          {l.failure_reason && <span className="block mt-0.5 text-xs text-text-secondary">{l.failure_reason}</span>}
                        </td>
                        <td className="px-4 py-2">
                          {l.actor_username || l.actor_id
                            ? <>{l.actor_username || l.actor_id}<span className="block text-xs text-text-secondary">{[l.actor_role && roleLabel(l.actor_role), l.office_id].filter(Boolean).join(" · ")}</span></>
                            : <span className="text-text-secondary">Not signed in</span>}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-text-secondary break-all">
                          {l.resource_type && <span className="font-sans">{l.resource_type.toLowerCase()} </span>}{l.resource_id || l.target_id || "—"}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {l.case_id ? <Link to={`/cases/${encodeURIComponent(l.case_id)}/audit`} className="font-mono text-xs text-electric-blue underline underline-offset-2">{l.case_id}</Link> : <span className="text-text-secondary">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}
      </PageBody>
    </div>
  );
}

/**
 * Global audit log (AUDITOR, ADMIN). The role check happens before any request; the page used to fire GET /audit (a
 * guaranteed 403, itself audited as ACCESS_DENIED) for every other role before showing its notice.
 */
export function GlobalAuditPage() {
  const role = useAuthStore((s) => s.user?.role);
  if (!can(role, "globalAudit")) {
    return <div className="p-6"><DeniedState message={deniedReason(role, "view the audit log across all cases") + " Each case's own audit log is on its Audit log tab."} backTo="/command-center" backLabel="Back to Home" /></div>;
  }
  return <GlobalAuditContent />;
}
