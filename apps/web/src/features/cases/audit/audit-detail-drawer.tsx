import { useState } from "react";
import { Link } from "react-router-dom";
import {
  X,
  FileText,
  Network,
  Filter,
  GitBranch,
  FileCheck,
  Award,
  FilePlus,
  FileEdit,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  Scale,
  Eye,
  Download,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  Database,
  User,
  MapPin,
  Clock,
  Code,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuditStore } from "@/stores/auditStore";
import { cn } from "@/lib/utils";

function maskIpAddress(ip: string): string {
  if (!ip || ip.includes("No IP")) return "(No IP Logged)";
  const parts = ip.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.***.***`;
  }
  return "***.***.***.***";
}

function maskPhoneNumbersInText(text: string): string {
  if (!text) return text;
  return text.replace(/\b(\+?91[\s-]?)?([6-9]\d{2})[\s-]?(\d{3})[\s-]?(\d{4})\b/g, "$1$2-***-****");
}

function formatDetailedTimestamp(isoStr: string) {
  const d = new Date(isoStr);
  return (
    d.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }) +
    " " +
    d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }) +
    " IST"
  );
}

export function AuditDetailDrawer() {
  const { selectedLog, isDrawerOpen, closeDrawer } = useAuditStore();
  const [copiedState, setCopiedState] = useState<Record<string, boolean>>({});

  if (!selectedLog) return null;

  const actionDescription =
    (selectedLog.detail?.actionDescription as string) ||
    `Recorded ${selectedLog.action} action on target ${selectedLog.target_id || selectedLog.target_kind || "SYSTEM"}`;

  const maskedDescription = maskPhoneNumbersInText(actionDescription);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedState((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setCopiedState((prev) => ({ ...prev, [id]: false }));
    }, 2000);
  };

  const actorName = selectedLog.actor_id || "System";
  const actorRole = selectedLog.actor_id ? "USER" : "SYSTEM";
  const ipAddress = "(No IP Logged)";

  return (
    <>
      {isDrawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/50 backdrop-blur-sm transition-opacity"
          onClick={closeDrawer}
        />
      )}

      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-full max-w-md bg-surface-1 shadow-2xl transition-transform duration-300 ease-in-out border-l border-border-subtle flex flex-col font-sans",
          isDrawerOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3 shrink-0 bg-surface-2/50">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-text-primary tracking-tight">
              Audit Record Inspection
            </h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={closeDrawer}
            className="h-8 w-8 p-0 text-text-muted hover:text-text-primary rounded-full hover:bg-surface-3"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-6">
            <div className="space-y-4 border-b border-border-subtle pb-6">
              <div className="flex items-center justify-between">
                <Badge tone="neutral" className="text-xs font-mono uppercase px-2 py-0.5">
                  {selectedLog.action}
                </Badge>
                <div className="flex items-center gap-1.5 text-text-muted text-xs font-mono bg-surface-2 px-2 py-0.5 rounded border border-border-subtle">
                  <Clock className="h-3 w-3" />
                  {formatDetailedTimestamp(selectedLog.created_at)}
                </div>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-lg font-semibold text-text-primary leading-tight">
                  {maskedDescription}
                </h3>
                <div className="flex items-center gap-2 text-xs font-mono text-text-muted">
                  <span>Record ID:</span>
                  <code className="text-text-secondary">{selectedLog.audit_id}</code>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wider flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-electric-blue" />
                Actor Identity Context
              </h4>
              <div className="bg-surface-2 rounded-md border border-border-subtle p-3 space-y-2 text-xs">
                <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
                  <span className="text-text-muted font-mono uppercase tracking-wider">Name:</span>
                  <span className="text-text-primary font-medium">{actorName}</span>
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
                  <span className="text-text-muted font-mono uppercase tracking-wider">Badge/ID:</span>
                  <span className="text-text-primary font-mono">{actorName}</span>
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
                  <span className="text-text-muted font-mono uppercase tracking-wider">Role Assumed:</span>
                  <span className="text-text-primary font-sans">{actorRole}</span>
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
                  <span className="text-text-muted font-mono uppercase tracking-wider">Source IP:</span>
                  <span className="text-text-primary font-mono">{ipAddress}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wider flex items-center gap-2">
                <Database className="h-3.5 w-3.5 text-amber" />
                Target Resource Scope
              </h4>
              <div className="bg-surface-2 rounded-md border border-border-subtle p-3 space-y-2 text-xs">
                <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
                  <span className="text-text-muted font-mono uppercase tracking-wider">Case Docket:</span>
                  <span className="text-text-primary font-mono">{selectedLog.case_id}</span>
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
                  <span className="text-text-muted font-mono uppercase tracking-wider">Target Domain:</span>
                  <span className="text-text-primary font-mono">{selectedLog.target_kind || "SYSTEM"}</span>
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
                  <span className="text-text-muted font-mono uppercase tracking-wider">Target ID:</span>
                  <span className="text-text-primary font-mono">{selectedLog.target_id || "N/A"}</span>
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
                  <span className="text-text-muted font-mono uppercase tracking-wider">Outcome:</span>
                  <span className="text-text-primary font-mono">{selectedLog.outcome}</span>
                </div>
              </div>
            </div>

            {selectedLog.detail && Object.keys(selectedLog.detail).length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wider flex items-center gap-2">
                  <Code className="h-3.5 w-3.5 text-purple-400" />
                  Telemetry &amp; State Diff
                </h4>
                <div className="bg-surface-2 rounded-md border border-border-subtle p-3 text-xs overflow-x-auto">
                  <pre className="font-mono text-[10px] text-text-secondary leading-relaxed">
                    {JSON.stringify(selectedLog.detail, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                Trace Reference
              </h4>
              <div className="bg-surface-2 rounded-md border border-emerald-500/30 p-3 space-y-3 shadow-[0_0_10px_rgba(16,185,129,0.05)_inset]">
                <div className="space-y-1">
                  <span className="text-micro font-mono text-text-muted uppercase tracking-wider">
                    Trace ID (Session/Context)
                  </span>
                  <div className="flex items-center justify-between gap-2 bg-background border border-border-subtle rounded px-2 py-1.5">
                    <code className="text-[10px] font-mono text-text-secondary truncate">
                      {selectedLog.trace_id}
                    </code>
                    <button
                      onClick={() => handleCopy(selectedLog.trace_id, "trace")}
                      className="text-text-muted hover:text-electric-blue shrink-0"
                    >
                      {copiedState["trace"] ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border-subtle p-4 bg-surface-1 shrink-0 flex justify-end">
          <Button variant="secondary" onClick={closeDrawer} className="text-xs">
            Close Inspection
          </Button>
        </div>
      </div>
    </>
  );
}
