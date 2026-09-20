import { useState } from "react";
import {
  X,
  FileText,
  AlertTriangle,
  Clock,
  Radio,
  ShieldCheck,
  ListChecks,
  ChevronDown,
  ChevronUp,
  CreditCard,
  PhoneCall,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RelationshipBadge } from "@/components/intelligence/relationship-badge";
import { EvidenceTierBadge } from "@/components/intelligence/evidence-tier-badge";
import { ConfidenceMeter } from "@/components/intelligence/confidence-meter";
import { useGraphStore } from "@/stores/graphStore";
import { useProvenanceStore } from "@/stores/provenanceStore";
import { maskSensitiveText } from "@/lib/pii";
import { formatCompactTimestamp } from "@/lib/formatters";
import type { RelationshipDetail } from "@/types/entity";

function getPlainExplanation(rel: RelationshipDetail): string {
  const s = maskSensitiveText(rel.sourceLabel);
  const t = maskSensitiveText(rel.targetLabel);

  switch (rel.type) {
    case "TRANSFERRED_FUNDS":
      return `${s} transferred ${rel.amount ? `₹${rel.amount.toLocaleString("en-IN")}` : "funds"} directly to ${t}.`;
    case "COMMUNICATED_WITH":
      return `${s} and ${t} were in direct telecommunication contact.`;
    case "USED_PHONE":
      return `${s} was documented utilizing phone line ${t}.`;
    case "USED_DEVICE":
      return `${s} was identified operating device ${t}.`;
    case "CO_LOCATED_AT":
      return `${s} and ${t} were recorded at the same physical location.`;
    case "ASSOCIATED_IN_CASE":
      return `${s} and ${t} are documented associates in this investigation.`;
    default:
      return `A verified relationship connects ${s} with ${t}.`;
  }
}

export function EdgeDrawer() {
  const {
    selectedRelationshipDetail,
    clearSelection,
    selectNode,
  } = useGraphStore();

  const { openProvenanceForRelationship } = useProvenanceStore();
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (!selectedRelationshipDetail) return null;

  const rel = selectedRelationshipDetail;
  const plainText = getPlainExplanation(rel);

  return (
    <div className="flex h-full flex-col bg-surface-1 text-text-primary">
      {/* Header */}
      <div className="border-b border-border-subtle p-4 space-y-3 bg-surface-2/40">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-micro font-semibold uppercase tracking-wider text-teal-primary font-mono">
              Connection Details
            </span>
            <h2 className="text-sm font-semibold text-text-primary">
              Why are these connected?
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-text-muted hover:text-text-primary"
            onClick={clearSelection}
            aria-label="Close relationship drawer"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Source -> Target Nodes */}
        <div className="rounded-md border border-border-subtle bg-surface-1 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-muted text-micro">FROM:</span>
            <button
              type="button"
              onClick={() => selectNode(rel.sourceEntityId)}
              className="font-medium text-teal-primary hover:underline flex items-center gap-1 font-mono text-right truncate max-w-[200px]"
            >
              {maskSensitiveText(rel.sourceLabel)}
            </button>
          </div>
          <div className="flex items-center justify-center text-text-muted gap-2 text-micro font-medium">
            <div className="h-px flex-1 bg-border-subtle" />
            <RelationshipBadge
              type={rel.type}
              hasContradiction={rel.hasContradiction}
            />
            <div className="h-px flex-1 bg-border-subtle" />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-muted text-micro">TO:</span>
            <button
              type="button"
              onClick={() => selectNode(rel.targetEntityId)}
              className="font-medium text-teal-primary hover:underline flex items-center gap-1 font-mono text-right truncate max-w-[200px]"
            >
              {maskSensitiveText(rel.targetLabel)}
            </button>
          </div>
        </div>
      </div>

      {/* Main Drawer Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Plain Language Summary Box */}
        <div className="rounded-lg border border-teal-primary/30 bg-teal-primary/5 p-3.5 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-primary">
            <Sparkles className="h-4 w-4 shrink-0" />
            <span>Connection Summary</span>
          </div>
          <p className="text-xs text-text-primary leading-relaxed">
            {plainText}
          </p>
        </div>

        {/* Key Highlights Card */}
        <div className="rounded-md border border-border-subtle bg-surface-2 p-3 space-y-2">
          <span className="text-micro font-semibold uppercase tracking-wider text-text-muted">
            Key Clue Details
          </span>
          <div className="space-y-1.5 text-xs">
            {rel.amount !== undefined && (
              <div className="flex items-center justify-between py-1 border-b border-border-subtle">
                <span className="text-text-secondary flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5 text-verified-emerald" />
                  Transferred Value:
                </span>
                <span className="font-semibold text-verified-emerald font-mono">
                  ₹{rel.amount.toLocaleString("en-IN")} {rel.currency}
                </span>
              </div>
            )}
            {rel.frequency !== undefined && (
              <div className="flex items-center justify-between py-1 border-b border-border-subtle">
                <span className="text-text-secondary flex items-center gap-1.5">
                  <PhoneCall className="h-3.5 w-3.5 text-teal-primary" />
                  Total Interactions:
                </span>
                <span className="font-semibold font-mono text-text-primary">
                  {rel.frequency} times
                </span>
              </div>
            )}
            {rel.durationSeconds !== undefined && (
              <div className="flex items-center justify-between py-1 border-b border-border-subtle">
                <span className="text-text-secondary">Call Duration:</span>
                <span className="font-mono text-text-primary">
                  {Math.round(rel.durationSeconds / 60)} min ({rel.durationSeconds}s)
                </span>
              </div>
            )}
            <div className="flex items-center justify-between py-1">
              <span className="text-text-secondary flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-text-muted" />
                Date &amp; Time:
              </span>
              <span className="font-mono text-text-primary">
                {formatCompactTimestamp(rel.timestamp)}
              </span>
            </div>
          </div>
        </div>

        {/* Supporting Evidence Card */}
        <div className="rounded-md border border-border-subtle bg-surface-2 p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-micro font-semibold uppercase tracking-wider text-text-muted">
              Source Evidence
            </span>
            <EvidenceTierBadge tier={rel.evidenceTier} short className="text-micro" />
          </div>
          <p className="text-xs text-text-secondary">
            This connection was extracted directly from verified case documents. You can inspect the exact page and highlight.
          </p>
          <Button
            variant="primary"
            size="md"
            className="w-full justify-center text-xs font-semibold gap-2 py-2 shadow-sm"
            onClick={() => openProvenanceForRelationship(rel.id)}
          >
            <FileText className="h-4 w-4" />
            <span>VIEW ORIGINAL EVIDENCE PROOF</span>
          </Button>
        </div>

        {/* Progressive Disclosure: Collapsible Advanced Technical Details */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between py-2 px-1 text-xs text-text-muted hover:text-text-primary transition-colors border-t border-border-subtle"
          >
            <span className="font-medium">
              {showAdvanced ? "Hide Advanced Evidence Details" : "Show Advanced Evidence Details ▾"}
            </span>
            {showAdvanced ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>

          {showAdvanced && (
            <div className="mt-2 space-y-3 animate-in fade-in duration-200">
              {/* Confidence Meter */}
              <div className="rounded-md border border-border-subtle bg-surface-2 p-3 space-y-2">
                <ConfidenceMeter confidence={rel.confidence} flagManualReview label="Algorithmic Confidence" />
              </div>

              {/* Contradiction Warning Panel */}
              {rel.hasContradiction && rel.contradictionDetails && (
                <div className="rounded-md border border-critical-red/50 bg-critical-red/10 p-3 space-y-2.5">
                  <div className="flex items-center gap-2 text-critical-red font-semibold text-xs">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Conflicting Statements Detected</span>
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {maskSensitiveText(rel.contradictionDetails.arbitrationNotes)}
                  </p>

                  <div className="space-y-1.5 pt-1">
                    <span className="text-micro font-semibold uppercase tracking-wide text-text-muted">
                      Conflicting Records:
                    </span>
                    {rel.contradictionDetails.conflictingSources.map((src) => (
                      <div
                        key={src.sourceId}
                        className="rounded border border-border-subtle bg-surface-1 p-2 text-micro space-y-1"
                      >
                        <div className="flex items-center justify-between text-text-muted">
                          <span className="font-mono">{src.sourceId}</span>
                          <span>{src.agency}</span>
                        </div>
                        <p className="text-text-primary">{maskSensitiveText(src.claim)}</p>
                      </div>
                    ))}
                  </div>

                  <div className="pt-1">
                    <Link to="/hitl/HITL-2026-001">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full justify-center text-micro font-mono gap-1.5 border-amber/40 text-amber hover:bg-amber/10"
                      >
                        <ListChecks className="h-3.5 w-3.5" />
                        <span>Arbitrate in Verification Workspace</span>
                      </Button>
                    </Link>
                  </div>
                </div>
              )}

              {/* Technical Channel & Custody */}
              <div className="rounded-md border border-border-subtle bg-surface-2 p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between text-micro">
                  <span className="text-text-muted flex items-center gap-1.5">
                    <Radio className="h-3.5 w-3.5 text-text-muted" /> Channel:
                  </span>
                  <Badge tone="neutral" className="font-mono text-micro">
                    {rel.channel}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-micro font-mono">
                  <span className="text-text-muted">Relationship ID:</span>
                  <span className="text-text-secondary">{rel.id}</span>
                </div>
              </div>

              {/* Chain of Custody */}
              <div className="rounded-md border border-border-subtle bg-surface-2/40 p-3 text-micro text-text-muted space-y-1">
                <p className="font-semibold text-text-secondary flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-verified-emerald" />
                  Evidence Integrity &amp; Provenance
                </p>
                <p className="leading-relaxed">
                  Every connection is an algorithmic index pointing to simulated source documents.
                  Original evidence must be verified prior to judicial submission.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
