import { ShieldAlert, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { HITLTask, HITLTaskDecision } from "@/types/hitl";

interface HITLDecisionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  task: HITLTask;
  decision: HITLTaskDecision | null;
  isSubmitting?: boolean;
}

export function HITLDecisionDialog({
  isOpen,
  onClose,
  onConfirm,
  task,
  decision,
  isSubmitting = false,
}: HITLDecisionDialogProps) {
  if (!isOpen || !decision) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-lg border border-border-strong bg-surface-1 p-5 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-electric-blue/10 border border-electric-blue/30 text-electric-blue-soft">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                Confirm Evidentiary Arbitration &amp; Signoff
              </h3>
              <p className="text-micro font-mono text-text-muted">
                Task ID: {task.id} &bull; Case: {task.caseId}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-text-muted hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Details Summary */}
        <div className="space-y-3 rounded bg-surface-2 p-3 text-xs border border-border-subtle">
          <div className="flex items-center justify-between">
            <span className="text-text-muted">Resolution Action:</span>
            <Badge tone="blue" className="font-mono text-micro">
              {decision.action.replace(/_/g, " ")}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-muted">Signing Officer:</span>
            <span className="font-mono font-medium text-text-primary">
              {decision.officerName} ({decision.officerBadge})
            </span>
          </div>
          <div className="pt-2 border-t border-border-subtle/80">
            <span className="text-micro uppercase tracking-wider text-text-muted block mb-1">
              Recorded Statutory Rationale:
            </span>
            <p className="font-mono text-micro text-text-primary bg-surface-1 p-2 rounded leading-relaxed">
              {decision.justification}
            </p>
          </div>
        </div>

        {/* Compliance Warning */}
        <div className="rounded bg-critical-red/10 border border-critical-red/30 p-2.5 text-micro text-critical-red leading-relaxed">
          <strong>Mandatory Notice:</strong> This action permanently writes to the immutable cryptographic audit log under Indian Evidence Act guidelines. All timestamps, IP addresses, and officer credentials are cryptographically committed.
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
          <Button
            variant="ghost"
            size="sm"
            disabled={isSubmitting}
            onClick={onClose}
            className="text-xs text-text-secondary hover:text-text-primary font-mono"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={isSubmitting}
            onClick={onConfirm}
            className="text-xs font-semibold gap-1.5 font-mono"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{isSubmitting ? "Signing & Recording..." : "Confirm & Sign Off"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
