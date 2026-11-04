import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRevealStore } from "@/stores/revealStore";
import {
  ShieldAlert,
  ShieldCheck,
  Eye,
  Lock,
  AlertTriangle,
  Clock,
  RotateCcw,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";

const STATUTORY_JUSTIFICATION_PRESETS = [
  {
    label: "Case Evidence Corroboration",
    text: "Investigative verification to corroborate candidate relationship against primary case evidence records.",
  },
  {
    label: "Supervisor-Approved Subscriber Verification",
    text: "Authorized review of subscriber identifier to resolve candidate link with supervisor approval.",
  },
  {
    label: "Financial Transaction Reconciliation",
    text: "Verification of account identifier against case-filed synthetic bank statement to confirm transaction party.",
  },
  {
    label: "Contradiction Resolution",
    text: "Inspection of masked identifier to reconcile flagged contradictions between conflicting evidence claims.",
  },
];

export function RevealIdentityModal() {
  const {  isModalOpen, modalTarget, closeRevealModal } = useRevealStore();

  if (!modalTarget) return null;

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && closeRevealModal()}>
      {isModalOpen && (
        <RevealModalContent
          key={`${modalTarget.entityId}:${modalTarget.identifierType}`}
          modalTarget={modalTarget}
        />
      )}
    </Dialog>
  );
}

interface RevealModalContentProps {
  modalTarget: {
    entityId: string;
    entityLabel: string;
    identifierType: string;
    maskedValue: string;
    rawValue: string;
  };
}

function RevealModalContent({ modalTarget }: RevealModalContentProps) {
  const { 
    isSubmitting,
    submissionError,
    lastResult,
    officerName,
    officerRole,
    closeRevealModal,
    remask,
    submitRevealRequest,
  } = useRevealStore();

  const [justification, setJustification] = useState("");
  const [certifiedAcknowledgment, setCertifiedAcknowledgment] = useState(false);
  const [localValidation, setLocalValidation] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalValidation(null);

    if (justification.trim().length < 15) {
      setLocalValidation("Legal justification must be at least 15 characters explaining official nexus.");
      return;
    }

    if (!certifiedAcknowledgment) {
      setLocalValidation("You must certify under official duty that this requisition is authorized.");
      return;
    }

    try {
      await submitRevealRequest(justification);
    } catch {
      // Error handled in store
    }
  };

  const handleRevoke = async () => {
    // FE-011: this only closed the dialog. It now hides the value again in this browser.
    if (modalTarget) remask(modalTarget.entityId, modalTarget.identifierType);
    closeRevealModal();
  };

  const isApproved = lastResult?.status === "APPROVED";
  const isDenied = lastResult?.status === "DENIED" || Boolean(submissionError);

  return (
    <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto font-sans">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-6">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <Lock className="h-4 w-4" />
              </div>
              <DialogTitle className="text-base text-text-primary">
                Reveal a masked value
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-xs text-text-muted mt-1 leading-relaxed">
            Phone and account numbers are masked by default. Revealing one needs a reason and is recorded in the audit log.
          </DialogDescription>
        </DialogHeader>

        {/* Successful Reveal State */}
        {isApproved && lastResult && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Identity Attribute Successfully Unmasked</span>
              </div>

              <div className="space-y-1 bg-surface-1/90 border border-emerald-500/20 rounded p-3">
                <div className="flex items-center justify-between text-micro text-text-muted">
                  <span className="uppercase font-mono">{lastResult.identifierType} Plaintext:</span>
                  <span className="text-emerald-400 font-mono flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Shown for this session view only
                  </span>
                </div>
                <div className="font-mono text-base font-bold text-text-primary tracking-wider select-all pt-1">
                  {lastResult.unmaskedValue}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-micro text-text-muted font-mono pt-1">
                <div>
                  <span className="text-text-muted block">Authorized By:</span>
                  <span className="text-text-secondary">{lastResult.authorizedBy}</span>
                </div>
                <div>
                  <span className="text-text-muted block">Audit Reference:</span>
                  <span className="text-text-secondary">{lastResult.auditId}</span>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-border-subtle bg-surface-2 p-3 text-xs text-text-muted flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <span className="font-semibold text-text-secondary">Session-Only Disclosure:</span> Plaintext is active in your current browser memory and will not be persisted across reloads. You may revoke access immediately below.
              </p>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRevoke}
                className="gap-1.5 text-xs text-critical-red hover:text-critical-red"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Hide value again</span>
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={closeRevealModal}
                className="gap-1.5 text-xs"
              >
                <span>Continue Investigation</span>
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Form State (when not yet approved) */}
        {!isApproved && (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Target Value Box: clear masked representation */}
            <div className="rounded-lg border border-border-subtle bg-surface-2/60 p-3 space-y-2">
              <div className="flex items-center justify-between text-micro text-text-muted">
                <span className="font-semibold uppercase tracking-wider">Entity &amp; identifier</span>
                <span className="font-mono">{modalTarget.entityId}</span>
              </div>
              <div className="flex items-center justify-between bg-surface-1 p-2.5 rounded border border-border-subtle">
                <div>
                  <span className="text-micro text-text-muted block">{modalTarget.entityLabel}</span>
                  <span className="font-mono text-sm font-semibold text-text-primary">
                    {modalTarget.maskedValue}
                  </span>
                </div>
                <Badge tone="gray" className="font-mono text-micro uppercase">
                  {modalTarget.identifierType}
                </Badge>
              </div>

              {/* Masking Examples Notice */}
              <div className="text-[11px] text-text-muted flex items-center gap-1.5 pt-0.5">
                <HelpCircle className="h-3 w-3 text-text-muted shrink-0" />
                <span>
                  Masked formats: <code className="text-text-secondary font-mono">+91-98*****210</code>, <code className="text-text-secondary font-mono">********6789</code>, <code className="text-text-secondary font-mono">3589******102</code>
                </span>
              </div>
            </div>

            <p className="rounded-lg border border-border-subtle bg-surface-2/40 p-3 text-xs text-text-secondary">
              Requested by <strong className="text-text-primary">{officerName || "you"}</strong>{officerRole ? ` (${officerRole})` : ""}.
              The server decides by your role and case assignment; every attempt, granted or refused, is written to the audit log.
            </p>

            {/* Denied / Error Alert */}
            {isDenied && (
              <div className="rounded-md border border-critical-red/40 bg-critical-red/10 p-3 text-critical-red flex items-start gap-2.5">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-semibold block">Reveal refused</span>
                  <span className="text-micro block text-critical-red/90 leading-relaxed">
                    {submissionError || lastResult?.denialReason}
                  </span>
                  <span className="text-micro font-mono block text-text-muted pt-1">
                    The refused attempt was recorded in the audit log.
                  </span>
                </div>
              </div>
            )}

            {/* Local Validation Error */}
            {localValidation && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-amber-400 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>{localValidation}</span>
              </div>
            )}

            {/* Reason input */}
            <div className="space-y-1.5">
              <label
                htmlFor="reveal-justification-input"
                className="text-micro font-semibold uppercase tracking-wider text-text-muted block"
              >
                Mandatory Legal Justification / Nexus (BNSS §91)
              </label>

              {/* Preset buttons */}
              <div className="flex flex-wrap gap-1.5 pb-1">
                {STATUTORY_JUSTIFICATION_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setJustification(preset.text)}
                    className="rounded bg-surface-2 hover:bg-surface-3 border border-border-subtle px-2 py-0.5 text-micro text-text-secondary hover:text-text-primary transition-colors"
                  >
                    + {preset.label}
                  </button>
                ))}
              </div>

              <textarea
                id="reveal-justification-input"
                rows={3}
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Why you need the unmasked value for this case, in your own words"
                className="w-full rounded-md border border-border-subtle bg-surface-2 p-2.5 text-xs text-text-primary placeholder:text-text-muted focus:border-electric-blue focus:outline-none leading-relaxed"
              />
            </div>

            {/* Acknowledgment (no client-side bypass: the server requires case_id + reason for every reveal) */}
            <div className="space-y-2 pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={certifiedAcknowledgment}
                  onChange={(e) => setCertifiedAcknowledgment(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 rounded border-border-subtle bg-surface-2 text-electric-blue focus:ring-0"
                />
                <span className="text-micro text-text-secondary leading-normal">
                  I confirm that this identity unmasking requisition is required for authorized investigation under the current Case. I acknowledge this action is recorded in the tamper-evident audit trail.
                </span>
              </label>
            </div>

            <DialogFooter className="gap-2 pt-2 border-t border-border-subtle/80">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={closeRevealModal}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isSubmitting}
                className="gap-1.5"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>{isSubmitting ? "Attesting Requisition..." : "Submit Requisition & Unmask"}</span>
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
  );
}

