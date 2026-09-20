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
  Eye,
  ShieldCheck,
  ShieldAlert,
  Scale,
  Download,
  Link2,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { maskIpAddress, maskPhoneNumbersInText } from "@/lib/pii";
import { formatDetailedTimestamp } from "@/lib/formatters";
import type { AuditLogEntry, AuditActionType } from "@/types/audit";

interface AuditEventCardProps {
  log: AuditLogEntry;
  blockNumber: number;
  onInspect: (log: AuditLogEntry) => void;
}

function getActionConfig(action: AuditActionType): {
  label: string;
  tone: "neutral" | "blue" | "amber" | "orange" | "emerald" | "purple" | "red" | "gray";
  icon: typeof FileText;
} {
  switch (action) {
    case "VIEW_CASE":
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
    case "REVEAL_PII_REQUESTED":
      return { label: "PII Unmask Requested", tone: "amber", icon: Eye };
    case "REVEAL_PII_APPROVED":
      return { label: "PII Access Approved", tone: "emerald", icon: ShieldCheck };
    case "REVEAL_PII_DENIED":
      return { label: "PII Access Denied", tone: "red", icon: ShieldAlert };
    case "ARBITRATE_CONTRADICTION":
      return { label: "Contradiction Reviewed", tone: "orange", icon: Scale };
    case "EXPORT_DOSSIER":
      return { label: "Dossier Exported", tone: "blue", icon: Download };
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
    navigator.clipboard.writeText(log.hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const actionDescription =
    (log.details.actionDescription as string) ||
    `Recorded ${log.action} action on target ${log.targetId || log.targetType || "SYSTEM"}`;

  const maskedDescription = maskPhoneNumbersInText(actionDescription);

  // Cross-link resolution based on targetType
  const getTargetLink = () => {
    if (!log.targetId) return null;
    if (log.targetType === "ENTITY") {
      return `/cases/${log.caseId}/graph?entityId=${encodeURIComponent(log.targetId)}`;
    }
    if (log.targetType === "EVIDENCE") {
      return `/cases/${log.caseId}/evidence?evidenceId=${encodeURIComponent(log.targetId)}`;
    }
    if (log.targetType === "NOTE") {
      return `/cases/${log.caseId}/notes?targetId=${encodeURIComponent(log.targetId)}`;
    }
    if (log.targetType === "GRAPH" || log.targetType === "RELATIONSHIP") {
      return `/cases/${log.caseId}/graph`;
    }
    return null;
  };

  const targetLink = getTargetLink();

  return (
    <div
      onClick={() => onInspect(log)}
      className="group relative flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-1 p-3.5 hover:border-electric-blue/50 hover:bg-surface-2/60 transition-all cursor-pointer shadow-sm"
    >
      {/* Left Block Sequence & Timestamp */}
      <div className="flex items-start gap-3 min-w-[200px]">
        <div className="flex flex-col items-center">
          <span className="font-mono text-xs font-bold text-electric-blue bg-electric-blue/10 border border-electric-blue/20 rounded px-1.5 py-0.5">
            #{String(blockNumber).padStart(2, "0")}
          </span>
          <span className="font-mono text-[10px] text-text-muted mt-1">{log.id}</span>
        </div>

        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <ActionIcon className="h-3.5 w-3.5 text-text-muted shrink-0" />
            <Badge tone={actionConfig.tone} className="text-[10px] tracking-wider uppercase font-semibold">
              {actionConfig.label}
            </Badge>
          </div>
          <div className="text-micro font-mono text-text-muted">
            {formatDetailedTimestamp(log.timestamp)}
          </div>
        </div>
      </div>

      {/* Middle Description & Actor */}
      <div className="flex-1 space-y-1.5 md:px-3">
        <p className="text-xs text-text-primary leading-relaxed font-sans">
          {maskedDescription}
        </p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-micro text-text-muted font-mono">
          <span className="text-text-secondary font-medium">
            {log.actorName} ({log.actorBadgeNumber})
          </span>
          <span>•</span>
          <span>{log.actorRole}</span>
          <span>•</span>
          <span>IP: {maskIpAddress(log.ipAddress)}</span>

          {log.targetType && (
            <>
              <span>•</span>
              <span className="text-text-secondary">
                Scope: <span className="text-text-primary">{log.targetType}</span>
                {log.targetId && (
                  <>
                    {" "}
                    [
                    {targetLink ? (
                      <Link
                        to={targetLink}
                        onClick={(e) => e.stopPropagation()}
                        className="text-electric-blue hover:underline inline-flex items-center gap-0.5"
                        title={`Open ${log.targetId} in context`}
                      >
                        {log.targetId}
                        <ExternalLink className="h-2.5 w-2.5 inline" />
                      </Link>
                    ) : (
                      log.targetId
                    )}
                    ]
                  </>
                )}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Right Cryptographic Linkage & Inspect Trigger */}
      <div className="flex items-center justify-between md:justify-end gap-3 min-w-[220px] pt-2 md:pt-0 border-t md:border-t-0 border-border-subtle/50">
        <div className="space-y-1 text-right">
          {/* Current Block SHA-256 Digest */}
          <div className="flex items-center justify-end gap-1.5">
            <span className="text-[10px] uppercase font-mono text-text-muted">SHA-256:</span>
            <code className="text-[11px] font-mono text-text-secondary bg-surface-2 px-1.5 py-0.5 rounded border border-border-subtle">
              {log.hash.slice(0, 8)}...{log.hash.slice(-6)}
            </code>
            <button
              type="button"
              onClick={handleCopyHash}
              className="text-text-muted hover:text-electric-blue p-0.5"
              title="Copy 64-char SHA-256 Digest"
            >
              {copiedHash ? (
                <Check className="h-3 w-3 text-emerald-400" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </button>
          </div>

          {/* Previous Hash Linkage Indicator */}
          <div className="flex items-center justify-end gap-1 text-[10px] font-mono text-text-muted">
            <Link2 className="h-2.5 w-2.5 text-emerald-400 shrink-0" />
            <span>
              {log.previousHash ? (
                <span>Prev: {log.previousHash.slice(0, 6)}...</span>
              ) : (
                <span className="text-emerald-400">GENESIS BLOCK</span>
              )}
            </span>
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
