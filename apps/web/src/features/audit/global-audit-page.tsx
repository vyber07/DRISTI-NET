import { useEffect, useState } from "react";
import { ShieldCheck, RefreshCw, AlertTriangle, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listGlobalAuditLogs } from "@/services/api/auditApi";
import { useAuthStore } from "@/stores/authStore";
import { can, deniedReason } from "@/lib/permissions";
import { DeniedState } from "@/components/layout/page";

const ACTION_TONES: Record<string, string> = {
  LOGIN: "blue", LOGOUT: "neutral",
  CASE_CREATE: "green", CASE_VIEW: "neutral", CASE_ASSIGN: "blue",
  EVIDENCE_UPLOAD: "blue", EVIDENCE_DOWNLOAD: "neutral",
  INTEGRITY_ANCHOR: "green", COURT_PDF_EXPORT: "amber",
  REVIEW_DECISION: "purple", UNMASK: "red",
  DEMO_TAMPER: "red", INTEGRITY_MISMATCH: "red",
  EXPORT: "amber", HASH_VERIFY: "neutral",
  GRAPH_VIEW: "neutral", AUDIT_VIEW: "neutral",
};

function GlobalAuditContent() {
  const { user } = useAuthStore();
  const [logs, setLogs] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const load = () => {
    setIsLoading(true);
    setError("");
    listGlobalAuditLogs(500)
      .then((r) => { setLogs(r.data || []); setFiltered(r.data || []); })
      .catch((e) => setError(e.message || "Failed to load audit logs"))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    let result = logs;
    if (actionFilter) result = result.filter((l) => l.action === actionFilter);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter((l) =>
        (l.action || "").toLowerCase().includes(s) ||
        (l.actor_id || "").toLowerCase().includes(s) ||
        (l.target_id || "").toLowerCase().includes(s) ||
        (l.case_id || "").toLowerCase().includes(s)
      );
    }
    setFiltered(result);
  }, [logs, search, actionFilter]);

  const uniqueActions = [...new Set(logs.map((l) => l.action))].sort();

  if (user?.role !== "AUDITOR" && user?.role !== "ADMIN") {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-2">
          <AlertTriangle className="h-10 w-10 text-red-400 mx-auto" />
          <p className="text-sm text-text-primary font-semibold">Access Denied</p>
          <p className="text-xs text-text-muted">Only AUDITOR and ADMIN roles can view the global audit trail.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-bg-base overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border-subtle bg-surface-1 px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-electric-blue-soft" />
          <h2 className="text-sm font-bold font-mono tracking-wide uppercase text-text-primary">Global Audit Trail</h2>
          {!isLoading && <span className="text-xs text-text-muted">· {filtered.length} / {logs.length} events</span>}
        </div>
        <Button variant="ghost" size="sm" className="text-xs gap-1.5" onClick={load} disabled={isLoading}>
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="shrink-0 border-b border-border-subtle bg-surface-2 px-5 py-2 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by action, actor, target, case…"
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface-1 border border-border-subtle rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:border-electric-blue"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-text-muted" />
          <select
            value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}
            className="text-xs bg-surface-1 border border-border-subtle rounded-md px-2 py-1.5 text-text-primary focus:outline-none"
          >
            <option value="">All Actions</option>
            {uniqueActions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        {(search || actionFilter) && (
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setSearch(""); setActionFilter(""); }}>
            Clear
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-electric-blue border-t-transparent" />
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-400/30 bg-red-400/5 p-4 text-xs text-red-400 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> {error}
          </div>
        )}
        {!isLoading && !error && filtered.length === 0 && (
          <div className="text-center py-16 text-xs text-text-muted">No audit events match your filters.</div>
        )}
        {!isLoading && !error && filtered.map((log: any) => (
          <div key={log.audit_id} className="rounded-lg border border-border-subtle bg-surface-1 px-4 py-3 flex items-center gap-4 flex-wrap hover:bg-surface-2 transition-colors">
            <Badge tone={(ACTION_TONES[log.action] || "neutral") as any} className="text-micro font-mono shrink-0 min-w-[120px] text-center">{log.action}</Badge>
            <span className="font-mono text-xs text-text-muted shrink-0">{log.created_at?.substring(0, 19).replace("T", " ")}</span>
            <span className="text-xs text-text-secondary shrink-0">
              <span className="font-semibold text-text-primary">{log.actor_id || "—"}</span>
            </span>
            <span className="text-xs text-text-muted shrink-0">→</span>
            <span className="font-mono text-xs text-text-secondary truncate flex-1 min-w-[80px]">{log.target_id || log.case_id || "—"}</span>
            {log.case_id && <span className="text-[10px] font-mono text-electric-blue shrink-0">{log.case_id}</span>}
            {log.outcome && log.outcome !== "OK" && (
              <Badge tone="red" className="text-micro shrink-0">{log.outcome}</Badge>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Global audit log (AUDITOR, ADMIN). The role check now happens before any request; the page used to fire
 * GET /audit (a guaranteed 403, itself audited as ACCESS_DENIED) for every other role before showing its notice.
 */
export function GlobalAuditPage() {
  const role = useAuthStore((s) => s.user?.role);
  if (!can(role, "globalAudit")) {
    return <div className="p-6"><DeniedState message={deniedReason(role, "view the audit log across all cases") + " Each case's own audit log is on its Audit log tab."} backTo="/command-center" backLabel="Back to Home" /></div>;
  }
  return <GlobalAuditContent />;
}
