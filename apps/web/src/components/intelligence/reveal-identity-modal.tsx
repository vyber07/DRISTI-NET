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
    label: "BNSS §91 / NAFIS Requisition",
    text: "Requisition under BNSS §91 for cross-matching suspect biometric data against National Automated Fingerprint Identification System (NAFIS).",
  },
  {
    label: "BNSS §35 / Suspect Apprehension",
    text: "Notice under BNSS §35 for immediate suspect apprehension and flight risk mitigation following interstate syndicate movement.",
  },
  {
    label: "BNSS §107 / Account Freezing",
    text: "Financial tracking requisition under BNSS §107 to initiate freezing orders on illicit mule accounts and hawala routing nodes.",
  },
  {
    label: "CDR / CAF Subscriber Verification",
    text: "Verification of CDR subscriber identity against Airtel/Jio CAF application forms to corroborate fraudulent KYC activation.",
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
    officerClearance,
    officerName,
    officerRole,
    closeRevealModal,
    setOfficerClearance,
    submitRevealRequest,
  } = useRevealStore();

  const [justification, setJustification] = useState("");
  const [certifiedAcknowledgment, setCertifiedAcknowledgment] = useState(false);
  const [emergencyBypass, setEmergencyBypass] = useState(false);
  const [localValidation, setLocalValidation] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalValidation(null);

    if (justification.trim().length < 15) {
      setLocalValidation("Legal justification must be at least 15 characters explaining official nexus.");
      return;
    }

    if (!certifiedAcknowledgment && !emergencyBypass) {
      setLocalValidation("You must certify under official duty that this requisition is authorized.");
      return;
    }

    try {
      await submitRevealRequest(justification, emergencyBypass);
    } catch {
      // Error handled in store
    }
  };

  const handleRevoke = async () => {
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
                Statutory Identity Unmasking Gateway
              </DialogTitle>
            </div>
            <Badge tone="amber" className="text-[10px] font-mono tracking-wider uppercase">
              BNSS §91 Gate
            </Badge>
          </div>
          <DialogDescription className="text-xs text-text-muted mt-1 leading-relaxed">
            Personally Identifiable Information (PII) is masked by default under Law Enforcement Data Minimization principles. Unmasking is an audited police action.
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
                    <Clock className="h-3 w-3" /> Expires in 15 mins
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
                <span>Revoke &amp; Re-mask Field</span>
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
                <span className="font-semibold uppercase tracking-wider">Target Suspect &amp; Identifier</span>
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

            {/* Officer Clearance Selector (for testing authorization thresholds) */}
            <div className="space-y-1.5 rounded-lg border border-border-subtle bg-surface-2/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-micro font-semibold uppercase tracking-wider text-text-muted">
                  Officer Requisition Clearance
                </span>
                <span className="text-micro font-mono text-text-secondary">
                  {officerName} () &bull; {officerRole}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  { level: 1, label: "Level 1: Observer", desc: "Unauthorized / Denied" },
                  { level: 2, label: "Level 2: Investigator", desc: "Authorized (IO)" },
                  { level: 3, label: "Level 3: Supervisor", desc: "Supervisory DySP" },
                ].map((c) => (
                  <button
                    key={c.level}
                    type="button"
                    onClick={() => setOfficerClearance(c.level)}
                    className={`p-2 rounded border text-left transition-colors ${
                      officerClearance === c.level
                        ? "border-electric-blue bg-surface-3 text-text-primary"
                        : "border-border-subtle bg-surface-1 text-text-muted hover:text-text-secondary"
                    }`}
                  >
                    <span className="block font-semibold text-xs">{c.label}</span>
                    <span className="block text-micro text-text-muted mt-0.5">{c.desc}</span>
                  </button>
                ))}
              </div>
              {officerClearance < 2 && (
                <p className="text-micro text-critical-red flex items-center gap-1 mt-1">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  Clearance Level 1 lacks unmasking authority. Submitting will result in a logged audit denial.
                </p>
              )}
            </div>

            {/* Denied / Error Alert */}
            {isDenied && (
              <div className="rounded-md border border-critical-red/40 bg-critical-red/10 p-3 text-critical-red flex items-start gap-2.5">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-semibold block">Statutory Access Requisition Denied</span>
                  <span className="text-micro block text-critical-red/90 leading-relaxed">
                    {submissionError || lastResult?.denialReason}
                  </span>
                  <span className="text-micro font-mono block text-text-muted pt-1">
                    Denial logged permanently to case audit ledger under Officer.
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

            {/* Statutory Justification Input */}
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
                placeholder="Specify exact statutory ground, case nexus, or requisition reference (e.g. Notice issued under BNSS §91 to Airtel/Bank)..."
                className="w-full rounded-md border border-border-subtle bg-surface-2 p-2.5 text-xs text-text-primary placeholder:text-text-muted focus:border-electric-blue focus:outline-none leading-relaxed"
              />
            </div>

            {/* Acknowledgment & Emergency toggle */}
            <div className="space-y-2 pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={certifiedAcknowledgment}
                  onChange={(e) => setCertifiedAcknowledgment(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 rounded border-border-subtle bg-surface-2 text-electric-blue focus:ring-0"
                />
                <span className="text-micro text-text-secondary leading-normal">
                  I certify that this identity unmasking requisition is necessary for official investigation under the current Case. I acknowledge this transaction is permanently recorded in the tamper-evident audit ledger under Officer Officer.
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none text-micro text-text-muted">
                <input
                  type="checkbox"
                  checked={emergencyBypass}
                  onChange={(e) => setEmergencyBypass(e.target.checked)}
                  className="h-3 w-3 rounded border-border-subtle bg-surface-2 text-amber-500 focus:ring-0"
                />
                <span>Exigent Circumstances / Emergency Bypass Protocol (Immediate threat to life)</span>
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

