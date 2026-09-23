import { X, Network, Link as LinkIcon, FileText, ChevronDown, ChevronUp, Lock, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useGraphStore } from "@/stores/graphStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProvenanceStore } from "@/stores/provenanceStore";

export function EdgeDrawer() {
  const { selectedRelationshipDetail: rel, clearSelection } = useGraphStore();
  const { openProvenanceForRecord } = useProvenanceStore();
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (!rel) return null;

  return (
    <div
      data-testid="edge-drawer"
      className="absolute top-0 right-0 h-full w-[400px] border-l border-border-subtle bg-surface-1 shadow-panel flex flex-col z-10 animate-in slide-in-from-right duration-300"
    >
      <header className="flex h-14 items-center justify-between border-b border-border-subtle px-4 shrink-0 bg-surface-2/40">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-electric-blue/10 text-electric-blue">
            <LinkIcon className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-primary tracking-tight">
              Relationship Detail
            </h2>
            <p className="text-xs text-text-muted font-mono">{rel.id}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={clearSelection}
          className="rounded-full p-1.5 text-text-muted hover:bg-surface-3 hover:text-text-primary transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Connection Summary Node -> Node */}
        <div className="flex items-center justify-between gap-3 bg-surface-2 p-3 rounded-lg border border-border-subtle">
          <div className="flex-1 min-w-0 text-center">
            <p className="text-[10px] font-mono text-text-muted uppercase mb-1">Source</p>
            <p className="text-sm font-semibold text-text-primary truncate" title={rel.sourceLabel}>
              {rel.sourceLabel}
            </p>
          </div>
          <div className="flex flex-col items-center gap-1 shrink-0 px-2">
            <Badge tone="blue" className="text-micro">
              {rel.label}
            </Badge>
            <Network className="h-4 w-4 text-border-strong" />
          </div>
          <div className="flex-1 min-w-0 text-center">
            <p className="text-[10px] font-mono text-text-muted uppercase mb-1">Target</p>
            <p className="text-sm font-semibold text-text-primary truncate" title={rel.targetLabel}>
              {rel.targetLabel}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Relationship Evidence Metrics
          </h3>
          <div className="rounded-md border border-border-subtle bg-surface-1 divide-y divide-border-subtle text-sm">
            <div className="flex items-center justify-between p-3">
              <span className="text-text-secondary">Claim Count</span>
              <span className="font-semibold text-text-primary">{rel.count}</span>
            </div>
            <div className="flex items-center justify-between p-3">
              <span className="text-text-secondary">Composite Weight</span>
              <span className="font-semibold text-text-primary">{rel.weight}</span>
            </div>
            <div className="flex items-center justify-between p-3">
              <span className="text-text-secondary">Relevance</span>
              <Badge tone="neutral">{rel.relevance}</Badge>
            </div>
          </div>
        </div>

        {/* Supporting Evidence Card */}
        {rel.evidenceIds && rel.evidenceIds.length > 0 && (
          <div className="rounded-md border border-border-subtle bg-surface-2 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-micro font-semibold uppercase tracking-wider text-text-muted">
                Source Evidence
              </span>
            </div>
            <p className="text-xs text-text-secondary">
              This connection was extracted from {rel.evidenceIds.length} verified case document(s).
            </p>
            <Button
              variant="primary"
              size="md"
              className="w-full justify-center text-xs font-semibold gap-2 py-2 shadow-sm"
              onClick={() => openProvenanceForRecord(rel.evidenceIds[0])}
            >
              <FileText className="h-4 w-4" />
              <span>INSPECT PROVENANCE FOR PRIMARY DOCUMENT</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
