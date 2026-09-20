import { Eye, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PIIFieldProps {
  label: string;
  /** True plaintext value. Only ever rendered when isMasked is false. */
  value: string;
  /** Pre-masked representation, e.g. "+91-98*****210" or "********6789". */
  maskedValue: string;
  isMasked: boolean;
  /**
   * Whether the current session is permitted to request a reveal at all.
   * When false, the action renders as policy-restricted rather than absent,
   * so the analyst understands *why* it's unavailable (spec: role-aware UI).
   */
  canRequestReveal?: boolean;
  restrictedReason?: string;
  /** Wired to the Reveal Identity modal + justification flow in a later phase. */
  onRequestReveal?: () => void;
  /** Wired to revoke reveal and revert to masked state. */
  onRevokeReveal?: () => void;
  className?: string;
}

/**
 * PII is masked by default (spec P4 / §19). This component never decides
 * masking on its own — the caller passes `isMasked` from the centralized
 * masking policy selector. A node/edge click alone must never flip this prop.
 */
function PIIField({
  label,
  value,
  maskedValue,
  isMasked,
  canRequestReveal = false,
  restrictedReason = "Restricted by clearance",
  onRequestReveal,
  onRevokeReveal,
  className,
}: PIIFieldProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <span className="text-micro uppercase tracking-wide text-text-muted">{label}</span>
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "font-mono text-sm",
            isMasked ? "text-text-secondary" : "text-text-primary",
          )}
        >
          {isMasked ? maskedValue : value}
        </span>

        {isMasked ? (
          canRequestReveal ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-text-muted hover:text-electric-blue-soft"
              onClick={onRequestReveal}
            >
              <Eye className="h-3.5 w-3.5" />
              Reveal identity
            </Button>
          ) : (
            <Button variant="restricted" size="sm" restrictedReason={restrictedReason}>
              Reveal identity
            </Button>
          )
        ) : (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-micro font-semibold uppercase tracking-wide text-verified-emerald">
              <ShieldCheck className="h-3.5 w-3.5" />
              Revealed
            </span>
            {onRevokeReveal && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-micro text-text-muted hover:text-critical-red"
                onClick={onRevokeReveal}
                title="Re-mask field and clear session disclosure"
              >
                Re-mask
              </Button>
            )}
          </div>
        )}
      </div>
      {isMasked && (
        <p className="flex items-center gap-1 text-micro text-text-disabled">
          <Lock className="h-3 w-3" />
          Masked by default — Data Minimization Policy
        </p>
      )}
    </div>
  );
}

export { PIIField };
