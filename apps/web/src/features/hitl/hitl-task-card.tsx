import { GitMerge, UserCheck, CheckCircle2, ShieldCheck, Flag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ConfidenceMeter } from "@/components/intelligence/confidence-meter";
import { cn } from "@/lib/utils";
import type { HITLTask } from "@/types/hitl";

interface HITLTaskCardProps {
  task: HITLTask;
  isActive: boolean;
  onClick: () => void;
}

export function HITLTaskCard({ task, isActive, onClick }: HITLTaskCardProps) {
  const isResolved = task.status === "APPROVED" || task.status === "REJECTED";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-lg border p-3.5 transition-all relative overflow-hidden group hover:bg-surface-2",
        isActive
          ? "border-electric-blue bg-electric-blue/5 shadow-panel"
          : "border-border-subtle bg-surface-1",
        isResolved && !isActive && "opacity-60 hover:opacity-100",
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded",
              isActive ? "bg-electric-blue/20 text-electric-blue" : "bg-surface-3 text-text-muted",
              isResolved && "bg-verified-emerald/20 text-verified-emerald"
            )}
          >
            {isResolved ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <GitMerge className="h-3.5 w-3.5" />
            )}
          </div>
          <Badge
            tone={task.status === "PENDING" ? "blue" : (task.status === "APPROVED" ? "emerald" : "neutral")}
            className="text-[10px] font-mono px-1.5 py-0 uppercase"
          >
            {task.status.replace("_", " ")}
          </Badge>
          {task.flagManualReview && !isResolved && (
            <Badge tone="amber" className="text-[10px] font-mono px-1.5 py-0 uppercase flex items-center gap-1">
              <Flag className="h-2.5 w-2.5" />
              MANDATORY
            </Badge>
          )}
        </div>
        <div className="text-micro font-mono text-text-muted shrink-0 text-right">
           <span className="block">{new Date(task.createdAt).toLocaleDateString("en-IN")}</span>
        </div>
      </div>

      <div className="space-y-1 mb-3">
        <h3 className={cn(
          "text-sm font-semibold tracking-tight",
          isActive ? "text-electric-blue" : "text-text-primary"
        )}>
          {task.title}
        </h3>
        <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
          {task.description}
        </p>
      </div>

      <div className="flex items-end justify-between pt-2 border-t border-border-subtle/50">
        <div className="flex items-center gap-3 text-micro text-text-muted">
          {task.assignedAnalyst ? (
            <div className="flex items-center gap-1">
              <UserCheck className="h-3 w-3 text-electric-blue-soft" />
              <span>{task.assignedAnalyst.name}</span>
            </div>
          ) : (
            <span className="italic text-text-disabled">Unassigned</span>
          )}
        </div>
        
        <div className="w-24">
          <ConfidenceMeter confidence={task.confidence} flagManualReview={false} />
        </div>
      </div>
    </button>
  );
}
