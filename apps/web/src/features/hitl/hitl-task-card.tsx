import {
  AlertTriangle,
  GitMerge,
  ShieldAlert,
  ArrowUpRight,
  Clock,
  UserCheck,
  FileCheck2,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfidenceMeter } from "@/components/intelligence/confidence-meter";
import { maskPhoneNumbersInText } from "@/lib/pii";
import type { HITLTask } from "@/types/hitl";
import { cn } from "@/lib/utils";

interface HITLTaskCardProps {
  task: HITLTask;
  isSelected?: boolean;
  onSelect: (taskId: string) => void;
  compact?: boolean;
}

export function HITLTaskCard({
  task,
  isSelected = false,
  onSelect,
  compact = false,
}: HITLTaskCardProps) {
  const getPriorityTone = (priority: HITLTask["priority"]) => {
    switch (priority) {
      case "CRITICAL":
        return "red" as const;
      case "HIGH":
        return "amber" as const;
      case "MEDIUM":
        return "blue" as const;
      default:
        return "neutral" as const;
    }
  };

  const getStatusTone = (status: HITLTask["status"]) => {
    switch (status) {
      case "APPROVED":
        return "emerald" as const;
      case "REJECTED":
        return "red" as const;
      case "ESCALATED":
        return "amber" as const;
      case "IN_REVIEW":
        return "blue" as const;
      default:
        return "neutral" as const;
    }
  };

  const getTypeIcon = (type: HITLTask["type"]) => {
    switch (type) {
      case "CONTRADICTION_RESOLUTION":
        return <AlertTriangle className="h-3.5 w-3.5 text-critical-red" />;
      case "ENTITY_MERGE":
        return <GitMerge className="h-3.5 w-3.5 text-electric-blue-soft" />;
      case "TIER_ELEVATION":
        return <ArrowUpRight className="h-3.5 w-3.5 text-verified-emerald" />;
      default:
        return <ShieldAlert className="h-3.5 w-3.5 text-amber" />;
    }
  };

  const isResolved = task.status === "APPROVED" || task.status === "REJECTED";

  return (
    <div
      onClick={() => onSelect(task.id)}
      className={cn(
        "group relative rounded-md border text-left transition-all duration-150 cursor-pointer",
        isSelected
          ? "border-electric-blue bg-surface-2 ring-1 ring-electric-blue/40 shadow-panel"
          : "border-border-subtle bg-surface-1 hover:border-border-strong hover:bg-surface-2/60",
        task.priority === "CRITICAL" && !isResolved && "border-l-4 border-l-critical-red",
        compact ? "p-3 space-y-2" : "p-4 space-y-3",
      )}
    >
      {/* Top Header Strip */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs font-semibold text-text-primary">
            {task.id}
          </span>
          <Badge tone={getPriorityTone(task.priority)} className="text-micro font-mono">
            {task.priority}
          </Badge>
          <Badge tone={getStatusTone(task.status)} className="text-micro font-mono">
            {task.status.replace(/_/g, " ")}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5 text-micro font-mono text-text-muted">
          <Clock className="h-3 w-3" />
          <span>SLA: {new Date(task.slaDeadline).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</span>
        </div>
      </div>

      {/* Title & Type */}
      <div>
        <div className="flex items-center gap-1.5 text-xs text-text-secondary font-mono mb-1">
          {getTypeIcon(task.type)}
          <span className="uppercase font-medium tracking-wide">
            {task.type.replace(/_/g, " ")}
          </span>
          <span className="text-text-muted">&bull;</span>
          <span className="text-text-muted">{task.caseId}</span>
        </div>
        <h3 className="text-sm font-medium text-text-primary group-hover:text-electric-blue-soft transition-colors line-clamp-1">
          {maskPhoneNumbersInText(task.title)}
        </h3>
      </div>

      {/* Target Entity / Entities Display */}
      <div className="flex items-center justify-between gap-2 rounded bg-surface-2/70 p-2 border border-border-subtle/60 text-xs">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="font-mono text-text-secondary truncate">
            {maskPhoneNumbersInText(task.entityAName)}
          </span>
          {task.entityBName && (
            <>
              <span className="text-text-muted text-micro font-mono">&harr;</span>
              <span className="font-mono text-electric-blue-soft truncate">
                {maskPhoneNumbersInText(task.entityBName)}
              </span>
            </>
          )}
        </div>

        {task.relationshipId && (
          <span className="font-mono text-micro text-text-muted shrink-0 bg-surface-3 px-1.5 py-0.5 rounded">
            {task.relationshipId}
          </span>
        )}
      </div>

      {/* Contradiction Alert Badge if Present */}
      {task.hasContradiction && (
        <div className="flex items-center gap-2 rounded bg-critical-red/10 border border-critical-red/30 px-2.5 py-1 text-micro text-critical-red font-medium">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            {task.contradictionType === "SPATIAL_TEMPORAL"
              ? "⚠ SPATIO-TEMPORAL CONTRADICTION DETECTED"
              : "⚠ EVIDENTIARY CONTRADICTION DETECTED"}
          </span>
        </div>
      )}

      {/* Confidence Meter & Action Row */}
      <div className="space-y-2 pt-1 border-t border-border-subtle/60">
        <ConfidenceMeter
          confidence={task.confidence}
          flagManualReview={task.flagManualReview && !isResolved}
          className="text-xs"
        />

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2 text-micro text-text-muted font-mono">
            {task.assignedAnalyst ? (
              <span className="flex items-center gap-1 text-text-secondary">
                <UserCheck className="h-3 w-3 text-electric-blue-soft" />
                {task.assignedAnalyst.name}
              </span>
            ) : (
              <span className="text-amber">Unassigned</span>
            )}
            <span>&bull;</span>
            <span className="flex items-center gap-1">
              <FileCheck2 className="h-3 w-3" />
              {task.evidenceIds.length} doc{task.evidenceIds.length > 1 ? "s" : ""}
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-electric-blue-soft hover:text-text-primary px-2 font-mono gap-1"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(task.id);
            }}
          >
            <span>Review</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
