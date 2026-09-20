import { useState, useMemo } from "react";
import {
  X,
  ShieldCheck,
  FileText,
  Lock,
  Cpu,
  History,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PdfDocumentViewer } from "./PdfDocumentViewer";
import { EvidenceTierBadge } from "@/components/intelligence/evidence-tier-badge";
import { ConfidenceMeter } from "@/components/intelligence/confidence-meter";
import { useProvenanceStore } from "@/stores/provenanceStore";
import { formatCompactTimestamp } from "@/lib/formatters";
import { maskSensitiveText } from "@/lib/pii";

export function ProvenanceViewer() {
  const { isOpen, activeRecord, closeProvenance } = useProvenanceStore();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const record = useMemo(() => {
    if (!activeRecord) return null;
    return {
      ...activeRecord,
      documentTitle: maskSensitiveText(activeRecord.documentTitle),
      sourceAgency: maskSensitiveText(activeRecord.sourceAgency),
      extractedTextSnippet: maskSensitiveText(activeRecord.extractedTextSnippet),
      extractionModel: maskSensitiveText(activeRecord.extractionModel),
      boundingBoxes: activeRecord.boundingBoxes.map((box) => ({
        ...box,
        label: maskSensitiveText(box.label),
        extractedValue: maskSensitiveText(box.extractedValue),
      })),
      chainOfCustody: activeRecord.chainOfCustody.map((entry) => ({
        ...entry,
        actor: maskSensitiveText(entry.actor),
        action: maskSensitiveText(entry.action),
      })),
      analystSignoff: activeRecord.analystSignoff
        ? {
            ...activeRecord.analystSignoff,
            officerName: maskSensitiveText(activeRecord.analystSignoff.officerName),
            role: maskSensitiveText(activeRecord.analystSignoff.role),
            notes: maskSensitiveText(activeRecord.analystSignoff.notes || ""),
          }
        : undefined,
    };
  }, [activeRecord]);

  if (!isOpen || !record) return null;

  return (
    <div data-testid="provenance-viewer" className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-md">
      {/* Top Header Bar */}
      <header className="flex h-14 items-center justify-between border-b border-border-subtle bg-surface-1 px-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-teal-primary/10 border border-teal-primary/30 text-teal-primary">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-text-primary">
                Original Document Proof &amp; Forensic Verification
              </h1>
              <EvidenceTierBadge tier={record.evidenceTier} short className="text-micro" />
              <Badge tone="gray" className="text-micro font-mono">
                {record.documentType}
              </Badge>
              <Badge tone="red" className="text-micro font-mono">
                CONFIDENTIAL // LEA SENSITIVE
              </Badge>
            </div>
            <p className="text-micro font-mono text-text-muted mt-0.5">
              Record ID: {record.recordId} &bull; Case: DR-2026-00421 &bull; Source Type: {record.documentType} &bull; Doc:{" "}
              {record.documentId}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-text-secondary hover:text-text-primary"
            onClick={closeProvenance}
          >
            <X className="h-4 w-4" />
            <span>Close Viewer (Esc)</span>
          </Button>
        </div>
      </header>

      {/* Main Workspace: Left PDF Preview + Right Forensic Dossier */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Document Preview with SVG Bounding Box */}
        <div className="flex-1 min-w-0 h-full">
          <PdfDocumentViewer record={record} />
        </div>

        {/* Right: Provenance Inspector & Chain of Custody */}
        <div className="w-[440px] shrink-0 border-l border-border-subtle bg-surface-1 overflow-y-auto p-5 space-y-5 text-text-primary text-xs">
          {/* Ground truth policy banner */}
          <div className="rounded-lg border border-teal-primary/30 bg-teal-primary/5 p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-teal-primary font-semibold text-xs">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>Evidence Provenance Principle</span>
            </div>
            <p className="text-text-secondary text-micro leading-relaxed">
              Every clue on the Investigation Map links directly to the highlighted evidence snippet in this simulated source document.
            </p>
          </div>

          {/* Extracted Snippet */}
          <div className="space-y-2">
            <span className="text-micro font-semibold uppercase tracking-wider text-text-muted">
              Extracted Evidence Clue
            </span>
            <div className="rounded-md border border-border-subtle bg-surface-2 p-3 font-mono text-xs text-text-primary whitespace-pre-wrap leading-relaxed">
              {record.extractedTextSnippet}
            </div>
          </div>

          {/* Analyst Sign-off & Review Status */}
          {record.analystSignoff ? (
            <div className="rounded-md border border-border-strong bg-surface-2 p-3.5 space-y-2">
              <div className="flex items-center gap-1.5 text-teal-primary font-semibold">
                <CheckCircle2 className="h-4 w-4 text-verified-emerald" />
                <span>Analyst Sign-off &amp; Evidentiary Review</span>
              </div>
              <div className="space-y-1 text-micro text-text-secondary">
                <p>
                  Reviewing Officer:{" "}
                  <span className="font-semibold text-text-primary">
                    {record.analystSignoff.officerName}
                  </span>{" "}
                  ({record.analystSignoff.badgeNumber})
                </p>
                <p>Role: {record.analystSignoff.role}</p>
                {record.analystSignoff.notes && (
                  <p className="italic text-text-muted mt-1 border-l-2 border-teal-primary/40 pl-2">
                    &ldquo;{record.analystSignoff.notes}&rdquo;
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-amber/40 bg-amber/10 p-3 space-y-1">
              <p className="text-amber font-semibold text-xs">Machine-Extracted Candidate</p>
              <p className="text-text-secondary text-micro">
                This relationship was automatically indexed by an extraction pipeline and is awaiting formal investigator verification.
              </p>
            </div>
          )}

          {/* Progressive Disclosure: Collapsible Advanced Technical Details */}
          <div className="pt-2 border-t border-border-subtle">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between py-2 text-xs text-text-muted hover:text-text-primary transition-colors"
            >
              <span className="font-medium">
                {showAdvanced ? "Hide Technical Details" : "Show Advanced Evidence Details ▾"}
              </span>
              {showAdvanced ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-4 animate-in fade-in duration-200">
                {/* Model Extraction Pipeline */}
                <div className="space-y-2">
                  <span className="text-micro font-semibold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                    <Cpu className="h-3.5 w-3.5" /> Extraction Pipeline &amp; Confidence
                  </span>
                  <div className="rounded-md border border-border-subtle bg-surface-2 p-3 space-y-3">
                    <ConfidenceMeter confidence={record.extractionConfidence} label="Correlation Confidence" />
                    <div className="border-t border-border-subtle pt-2 space-y-1 text-micro">
                      <div className="flex justify-between text-text-muted">
                        <span>Model:</span>
                        <span className="font-mono text-text-primary text-right">
                          {record.extractionModel}
                        </span>
                      </div>
                      <div className="flex justify-between text-text-muted">
                        <span>Bounding Box:</span>
                        <span className="font-mono text-text-primary">
                          Page {record.boundingBoxes[0]?.page || 1} &bull;{" "}
                          {record.boundingBoxes[0]?.label}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Document Hashes & Raw Artifact Reference */}
                <div className="space-y-2">
                  <span className="text-micro font-semibold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" /> Cryptographic Integrity Hashes
                  </span>
                  <div className="rounded-md border border-border-subtle bg-surface-2 p-3 space-y-2.5 font-mono text-micro">
                    <div>
                      <span className="text-text-muted block text-[10px]">DOCUMENT SHA-256:</span>
                      <span className="text-text-primary break-all select-all">{record.sha256Hash}</span>
                    </div>
                    <div>
                      <span className="text-text-muted block text-[10px]">
                        TIER 1 RAW ARTIFACT HASH:
                      </span>
                      <span className="text-text-primary break-all select-all">
                        {record.rawArtifactSha256}
                      </span>
                      <span className="text-amber text-[9.5px] block mt-0.5">
                        &bull; Artifact ID: {record.rawArtifactId} (Unmodified Storage Stream)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Chain of Custody Timeline */}
                <div className="space-y-2">
                  <span className="text-micro font-semibold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                    <History className="h-3.5 w-3.5" /> Evidence Chain of Custody Log (Demo)
                  </span>
                  <div className="space-y-2">
                    {record.chainOfCustody.map((entry, idx) => (
                      <div
                        key={idx}
                        className="rounded-md border border-border-subtle bg-surface-2 p-2.5 space-y-1 text-micro"
                      >
                        <div className="flex items-center justify-between text-text-muted">
                          <span className="font-mono font-medium text-text-primary">{entry.actor}</span>
                          <span className="font-mono text-[10px] text-text-muted shrink-0">
                            {formatCompactTimestamp(entry.timestamp)}
                          </span>
                        </div>
                        <p className="text-text-secondary">{entry.action}</p>
                        <p className="font-mono text-[9px] text-text-muted break-all">
                          Verification: {entry.verificationHash.substring(0, 24)}...
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Legal Notice */}
          <p className="text-micro text-text-muted border-t border-border-subtle pt-3 italic">
            Notice: This viewer displays extracted evidentiary metadata and document snippets to assist
            investigative analysis. Demo records illustrate tamper-evident verification principles.
          </p>
        </div>
      </div>
    </div>
  );
}
