import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
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
  Link2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AuditLogEntry, AuditActionType } from "@/types/audit";

interface AuditEventCardProps {
  log: AuditLogEntry;
  blockNumber: number;
  onInspect: (log: AuditLogEntry) => void;
}

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
    })
  );
}

function getActionConfig(action: AuditActionType): {
  label: string;
  tone: "neutral" | "blue" | "amber" | "orange" | "emerald" | "purple" | "red" | "gray";
  icon: typeof FileText;
} {
  switch (action) {
    case "CASE_VIEW":
      return { label: "Docket Opened", tone: "neutral", icon: FileText };
    case "VIEW_GRAPH":
      return { label: "Graph Loaded", tone: "blue", icon: Network };
    case "FILTER_GRAPH":
      return { label: "Graph Filtered", tone: "blue", icon: Filter };
    case "EXPAND_NODE":
      return { label: "Node Expanded", tone: "blue", icon: GitBranch };
    case "VIEW_EVIDENCE":
      return { label: "Evidence Inspected", tone: "emerald", icon: FileCheck };
    case "UPDATE_TIER":
      return { label: "Tier Elevated", tone: "emerald", icon: Award };
    case "CREATE_NOTE":
      return { label: "Note Created", tone: "purple", icon: FilePlus };
    case "UPDATE_NOTE":
      return { label: "Note Updated", tone: "purple", icon: FileEdit };
    case "DELETE_NOTE":
      return { label: "Note Deleted", tone: "red", icon: Trash2 };
    case "UNMASK":
      return { label: "PII Unmasked", tone: "amber", icon: Eye };
    case "REVIEW_DECISION":
      return { label: "HITL Reviewed", tone: "orange", icon: Scale };
    case "EXPORT":
      return { label: "Dossier Exported", tone: "blue", icon: Download };
    case "LOGIN":
      return { label: "User Login", tone: "neutral", icon: ShieldCheck };
    case "ACCESS_DENIED":
      return { label: "Access Denied", tone: "red", icon: ShieldAlert };
    default:
      return { label: action, tone: "neutral", icon: FileText };
  }
}

export function AuditEventCard({
  log,
  blockNumber,
  onInspect,
}: AuditEventCardProps) {
  const [copiedHash, setCopiedHash] = useState(false);

  const actionConfig = getActionConfig(log.action);
  const ActionIcon = actionConfig.icon;

  const handleCopyHash = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(log.trace_id);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const actionDescription =
    (log.detail.actionDescription as string) ||
    `Recorded ${log.action} action on target ${log.target_id || log.target_kind || "SYSTEM"}`;

  const maskedDescription = maskPhoneNumbersInText(actionDescription);

  const getTargetLink = () => {
    if (!log.target_id) return null;
    if (log.target_kind === "ENTITY") {
      return `/cases/${log.case_id}/graph?entityId=${encodeURIComponent(log.target_id)}`;
    }
    if (log.target_kind === "EVIDENCE") {
      return `/cases/${log.case_id}/evidence?evidenceId=${encodeURIComponent(log.target_id)}`;
    }
    if (log.target_kind === "NOTE") {
      return `/cases/${log.case_id}/notes?targetId=${encodeURIComponent(log.target_id)}`;
    }
    if (log.target_kind === "GRAPH" || log.target_kind === "RELATIONSHIP") {
      return `/cases/${log.case_id}/graph`;
    }
    return null;
  };

  const targetLink = getTargetLink();
  const actorName = log.actor_id || "System";
  const actorRole = log.actor_id ? "USER" : "SYSTEM";
  const ipAddress = "(No IP Logged)";

  return (
    <div
      onClick={() => onInspect(log)}
      className="group relative flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-1 p-3.5 hover:border-electric-blue/50 hover:bg-surface-2/60 transition-all cursor-pointer shadow-sm"
    >
      <div className="flex items-start gap-3 min-w-[200px]">
        <div className="flex flex-col items-center">
          <span className="font-mono text-xs font-bold text-electric-blue bg-electric-blue/10 border border-electric-blue/20 rounded px-1.5 py-0.5">
            #{String(blockNumber).padStart(2, "0")}
          </span>
          <span className="font-mono text-[10px] text-text-muted mt-1">{log.audit_id}</span>
        </div>

        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <ActionIcon className="h-3.5 w-3.5 text-text-muted shrink-0" />
            <Badge tone={actionConfig.tone} className="text-[10px] tracking-wider uppercase font-semibold">
              {actionConfig.label}
            </Badge>
          </div>
          <div className="text-micro font-mono text-text-muted">
            {formatDetailedTimestamp(log.created_at)}
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-1.5 md:px-3">
        <p className="text-xs text-text-primary leading-relaxed font-sans">
          {maskedDescription}
        </p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-micro text-text-muted font-mono">
          <span className="text-text-secondary font-medium">
            {actorName}
          </span>
          <span>•</span>
          <span>{actorRole}</span>
          <span>•</span>
          <span>IP: {ipAddress}</span>

          {log.target_kind && (
            <>
              <span>•</span>
              <span className="text-text-secondary">
                Scope: <span className="text-text-primary">{log.target_kind}</span>
                {log.target_id && (
                  <>
                    {" "}
                    [
                    {targetLink ? (
                      <Link
                        to={targetLink}
                        onClick={(e) => e.stopPropagation()}
                        className="text-electric-blue hover:underline inline-flex items-center gap-0.5"
                        title={`Open ${log.target_id} in context`}
                      >
                        {log.target_id}
                        <ExternalLink className="h-2.5 w-2.5 inline" />
                      </Link>
                    ) : (
                      log.target_id
                    )}
                    ]
                  </>
                )}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between md:justify-end gap-3 min-w-[220px] pt-2 md:pt-0 border-t md:border-t-0 border-border-subtle/50">
        <div className="space-y-1 text-right">
          <div className="flex items-center justify-end gap-1.5">
            <span className="text-[10px] uppercase font-mono text-text-muted">Trace:</span>
            <code className="text-[11px] font-mono text-text-secondary bg-surface-2 px-1.5 py-0.5 rounded border border-border-subtle">
              {log.trace_id.slice(0, 8)}...
            </code>
            <button
              type="button"
              onClick={handleCopyHash}
              className="text-text-muted hover:text-electric-blue p-0.5"
            >
              {copiedHash ? (
                <Check className="h-3 w-3 text-emerald-400" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </button>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="text-text-muted group-hover:text-electric-blue group-hover:translate-x-0.5 transition-transform p-1 h-7 w-7"
          title="Inspect full audit record"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
