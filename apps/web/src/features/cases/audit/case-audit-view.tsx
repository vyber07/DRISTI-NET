import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { ShieldCheck, AlertCircle, RefreshCw, FileText } from "lucide-react";
import { useAuditStore } from "@/stores/auditStore";
import { AuditIntegrityHeader } from "./audit-integrity-header";
import { AuditFilterBar } from "./audit-filter-bar";
import { AuditEventCard } from "./audit-event-card";
import { AuditDetailDrawer } from "./audit-detail-drawer";
import { Button } from "@/components/ui/button";

interface CaseAuditViewProps {
  caseId: string;
}

export function CaseAuditView({ caseId }: CaseAuditViewProps) {
  const [searchParams] = useSearchParams();
  const { 
    logs,
    isLoading,
    error,
    loadLogs,
    openDrawer,
    setTargetIdFilter,
    getFilteredLogs,
    resetFilters,
  } = useAuditStore();

  // Load logs on mount or when caseId changes
  useEffect(() => {
    loadLogs(caseId);
  }, [caseId, loadLogs]);

  // Sync deep-linked targetId query parameter if present (e.g. ?targetId=E-PERS-01)
  useEffect(() => {
    const targetIdParam = searchParams.get("targetId");
    if (targetIdParam) {
      setTargetIdFilter(targetIdParam);
    }
  }, [searchParams, setTargetIdFilter]);

  const filteredLogs = getFilteredLogs();

  // Map chronological block numbers (1-indexed based on oldest timestamp)
  const blockNumberMap = useMemo(() => {
    const chronological = [...logs].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const map = new Map<string, number>();
    chronological.forEach((entry, idx) => {
      map.set(entry.audit_id, idx + 1);
    });
    return map;
  }, [logs]);

  return (
    <div className="flex flex-col h-full w-full max-w-full min-w-0 overflow-y-auto overflow-x-hidden bg-background p-4 sm:p-5 space-y-5 font-sans">
      {/* Integrity Header & Metrics */}
      <AuditIntegrityHeader caseId={caseId} />

      {/* Statutory Legal Governance Notice */}
      <div className="rounded-lg border border-border-subtle bg-surface-1 px-4 py-3 text-xs text-text-muted flex items-start gap-3 shadow-xs">
        <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5 leading-relaxed">
          <span className="font-semibold text-text-secondary">
            Statutory Tamper-Evident System Log (BSA §63 / IT Act §79A — Demo Policy Mapping):
          </span>{" "}
          All digital forensic interactions, note creations/edits, and evidentiary examinations are automatically recorded with SHA-256 cryptographic linkage. Demo entries illustrate permanent, tamper-evident audit logging principles.
        </div>
      </div>

      {/* Filter & Search Bar */}
      <AuditFilterBar />

      {/* Ledger Content Area */}
      <div className="space-y-2.5 flex-1">
        {/* Loading State */}
        {isLoading && (
          <div className="space-y-2.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <div
                key={n}
                className="h-20 rounded-lg border border-border-subtle bg-surface-1 animate-pulse p-4 flex items-center justify-between"
              >
                <div className="h-4 w-40 bg-surface-3 rounded" />
                <div className="h-4 w-64 bg-surface-3 rounded" />
                <div className="h-4 w-28 bg-surface-3 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="rounded-lg border border-critical-red/40 bg-critical-red/10 p-4 text-xs text-critical-red flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => loadLogs(caseId)}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry</span>
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredLogs.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border-subtle bg-surface-1/50 py-16 text-center">
            <FileText className="h-10 w-10 text-text-muted/50 mb-3" />
            <h3 className="text-sm font-semibold text-text-secondary">
              No matching audit events
            </h3>
            <p className="text-xs text-text-muted mt-1 max-w-sm">
              No ledger blocks match your search query or filter combination.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={resetFilters}
              className="mt-4 gap-1.5 text-xs"
            >
              <span>Reset All Filters</span>
            </Button>
          </div>
        )}

        {/* Ledger Event Cards List */}
        {!isLoading && !error && filteredLogs.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1 text-micro text-text-muted font-mono uppercase tracking-wider">
              <span>Displaying {filteredLogs.length} of {logs.length} Blocks</span>
              <span>Sequence Linked</span>
            </div>

            {filteredLogs.map((log) => {
              const blockNumber = blockNumberMap.get(log.audit_id) ?? 1;
              return (
                <AuditEventCard
                  key={log.audit_id}
                  log={log}
                  blockNumber={blockNumber}
                  onInspect={openDrawer}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Audit Detail Modal / Drawer */}
      <AuditDetailDrawer />
    </div>
  );
}
