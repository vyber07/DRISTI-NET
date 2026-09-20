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
import { useAuditStore } from "@/stores/auditStore";
import { maskIpAddress, maskPhoneNumbersInText } from "@/lib/pii";
import {
  ShieldCheck,
  Copy,
  Check,
  Hash,
  Link2,
  Lock,
  FileCode,
  Layers,
} from "lucide-react";

export function AuditDetailDrawer() {
  const { selectedLog, isDrawerOpen, closeDrawer } = useAuditStore();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"DETAILS" | "JSON">("DETAILS");

  if (!selectedLog) return null;

  const handleCopy = (text: string, fieldKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const actionDescription =
    (selectedLog.details.actionDescription as string) ||
    `Recorded ${selectedLog.action} action on target ${selectedLog.targetId || selectedLog.targetType || "SYSTEM"}`;

  const maskedDescription = maskPhoneNumbersInText(actionDescription);

  return (
    <Dialog open={isDrawerOpen} onOpenChange={(open) => !open && closeDrawer()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto font-sans">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 pr-6">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-electric-blue bg-electric-blue/10 border border-electric-blue/20 rounded px-2 py-0.5">
                {selectedLog.id}
              </span>
              <Badge tone="blue" className="text-xs uppercase font-mono tracking-wider">
                {selectedLog.action}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>SEALED RECORD</span>
            </div>
          </div>
          <DialogTitle className="text-base text-text-primary mt-1">
            Statutory Audit Block Inspection
          </DialogTitle>
          <DialogDescription className="text-xs text-text-muted">
            Tamper-evident record captured under BSA §63 digital evidence procedures (Demo Policy Mapping). Immutable system entry.
          </DialogDescription>
        </DialogHeader>

        {/* View mode toggle */}
        <div className="flex items-center gap-2 border-b border-border-subtle pb-2 pt-1 text-xs">
          <button
            type="button"
            onClick={() => setViewMode("DETAILS")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
              viewMode === "DETAILS"
                ? "bg-surface-3 text-text-primary font-semibold"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Forensic Properties</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("JSON")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
              viewMode === "JSON"
                ? "bg-surface-3 text-text-primary font-semibold"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <FileCode className="h-3.5 w-3.5" />
            <span>Canonical JSON Record</span>
          </button>
        </div>

        {viewMode === "DETAILS" ? (
          <div className="space-y-4 text-xs">
            {/* Action Summary */}
            <div className="rounded-lg border border-border-subtle bg-surface-2/60 p-3 space-y-1">
              <span className="text-micro font-semibold uppercase tracking-wider text-text-muted block">
                Recorded Action Context
              </span>
              <p className="text-xs text-text-primary leading-relaxed">
                {maskedDescription}
              </p>
            </div>

            {/* Officer & Workstation Properties */}
            <div className="rounded-lg border border-border-subtle bg-surface-2/40 p-3 space-y-2">
              <span className="text-micro font-semibold uppercase tracking-wider text-text-muted block">
                Officer &amp; Session Attestation
              </span>
              <div className="grid grid-cols-2 gap-3 font-mono">
                <div>
                  <span className="text-text-muted block text-micro">Officer / Actor:</span>
                  <span className="text-text-primary font-sans font-medium">
                    {selectedLog.actorName}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block text-micro">Badge Identifier:</span>
                  <span className="text-text-primary">{selectedLog.actorBadgeNumber}</span>
                </div>
                <div>
                  <span className="text-text-muted block text-micro">Authorized Role:</span>
                  <span className="text-text-primary font-sans">{selectedLog.actorRole}</span>
                </div>
                <div>
                  <span className="text-text-muted block text-micro">Source IP Address:</span>
                  <span className="text-text-primary">{maskIpAddress(selectedLog.ipAddress)}</span>
                </div>
              </div>
            </div>

            {/* Target & Docket Properties */}
            <div className="rounded-lg border border-border-subtle bg-surface-2/40 p-3 space-y-2">
              <span className="text-micro font-semibold uppercase tracking-wider text-text-muted block">
                Docket &amp; Scope Identifiers
              </span>
              <div className="grid grid-cols-3 gap-3 font-mono">
                <div>
                  <span className="text-text-muted block text-micro">Case ID:</span>
                  <span className="text-text-primary">{selectedLog.caseId}</span>
                </div>
                <div>
                  <span className="text-text-muted block text-micro">Target Scope:</span>
                  <span className="text-text-primary">{selectedLog.targetType || "SYSTEM"}</span>
                </div>
                <div>
                  <span className="text-text-muted block text-micro">Target Identifier:</span>
                  <span className="text-text-primary">{selectedLog.targetId || "N/A"}</span>
                </div>
              </div>
            </div>

            {/* Dynamic Event Details */}
            {Object.keys(selectedLog.details).length > 1 && (
              <div className="rounded-lg border border-border-subtle bg-surface-2/40 p-3 space-y-2">
                <span className="text-micro font-semibold uppercase tracking-wider text-text-muted block">
                  Structured Payload Attributes
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-micro">
                  {Object.entries(selectedLog.details)
                    .filter(([k]) => k !== "actionDescription")
                    .map(([key, value]) => (
                      <div key={key} className="rounded bg-surface-1/80 border border-border-subtle p-2">
                        <span className="font-mono text-text-muted block uppercase text-[10px]">{key}</span>
                        <span className="font-mono text-text-primary break-all">
                          {typeof value === "object" ? JSON.stringify(value) : String(value)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Cryptographic Linkage Block */}
            <div className="rounded-lg border border-electric-blue/30 bg-electric-blue/5 p-3.5 space-y-2.5 font-mono">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-electric-blue text-xs font-semibold">
                  <Hash className="h-4 w-4" />
                  <span>Cryptographic Hash Linkage</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-emerald-400">
                  <Lock className="h-3 w-3" />
                  <span>SHA-256 Validated</span>
                </div>
              </div>

              {/* Current Block Digest */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-text-muted">
                  <span>Current Block Digest (64 hex characters):</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(selectedLog.hash, "hash")}
                    className="flex items-center gap-1 text-electric-blue hover:underline"
                  >
                    {copiedField === "hash" ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <code className="block bg-surface-1 border border-border-subtle p-2 rounded text-[11px] text-text-primary break-all leading-tight select-all">
                  {selectedLog.hash}
                </code>
              </div>

              {/* Previous Block Digest */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-text-muted">
                  <span className="flex items-center gap-1">
                    <Link2 className="h-3 w-3 text-emerald-400" />
                    <span>Previous Block Linked Digest:</span>
                  </span>
                  {selectedLog.previousHash && (
                    <button
                      type="button"
                      onClick={() => handleCopy(selectedLog.previousHash!, "prevHash")}
                      className="flex items-center gap-1 text-electric-blue hover:underline"
                    >
                      {copiedField === "prevHash" ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                <code className="block bg-surface-1 border border-border-subtle p-2 rounded text-[11px] text-text-muted break-all leading-tight select-all">
                  {selectedLog.previousHash || "0000000000000000000000000000000000000000000000000000000000000000 (GENESIS)"}
                </code>
              </div>
            </div>
          </div>
        ) : (
          /* JSON Viewer Mode */
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>Canonical JSON Document</span>
              <button
                type="button"
                onClick={() => handleCopy(JSON.stringify(selectedLog, null, 2), "json")}
                className="flex items-center gap-1 text-electric-blue hover:underline text-xs"
              >
                {copiedField === "json" ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" />
                    <span className="text-emerald-400">JSON Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Copy JSON</span>
                  </>
                )}
              </button>
            </div>
            <pre className="bg-surface-2 border border-border-subtle p-3 rounded-md text-[11px] font-mono text-text-primary overflow-x-auto max-h-[50vh] leading-relaxed select-all">
              {JSON.stringify(selectedLog, null, 2)}
            </pre>
          </div>
        )}

        <DialogFooter className="border-t border-border-subtle/80 pt-3">
          <Button variant="ghost" onClick={closeDrawer} size="sm">
            Close Record
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleCopy(JSON.stringify(selectedLog, null, 2), "json-footer")}
            className="gap-1.5"
          >
            {copiedField === "json-footer" ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span>Copied to Clipboard</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-text-muted" />
                <span>Copy Canonical JSON</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
