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

        {/* Supporting claims, each with its exact source locator (constitution §19 Evidence gate) */}
        <div data-testid="edge-claims" className="rounded-md border border-border-subtle bg-surface-2 p-3 space-y-2.5">
          <span className="text-micro font-semibold uppercase tracking-wider text-text-muted">
            Supporting Claims &amp; Source Locations
          </span>
          <p className="text-xs text-text-secondary">
            Candidate relationship supported by {rel.count} claim(s) from {rel.evidenceIds?.length ?? 0} source
            document(s). Extracted claims are candidates for review, not established facts.
          </p>
          {rel.claims === undefined && <p className="text-xs text-text-muted">Loading provenance…</p>}
          {rel.claimsError && (
            <p role="alert" className="text-xs text-red-500">Provenance could not be loaded: {rel.claimsError}</p>
          )}
          {rel.claims && rel.claims.length === 0 && !rel.claimsError && (
            <p role="alert" className="text-xs text-amber-500">
              No supporting claims were returned for this edge. Treat it as unverified and report the discrepancy.
            </p>
          )}
          {rel.claims?.map((c) => {
            const prov = c.provenance?.[0];
            const loc = prov?.locator ?? {};
            const where = loc.json_path
              ? `record ${loc.json_path}`
              : [loc.page != null && `page ${loc.page}`, loc.line != null && `line ${loc.line}`, loc.row != null && `row ${loc.row}`]
                  .filter(Boolean)
                  .join(", ") || "location not recorded";
            return (
              <div key={c.claim_id} data-testid="edge-claim" className="rounded border border-border-subtle bg-surface-1 p-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono text-text-primary truncate" title={c.evidence.evidence_id}>
                    {c.evidence.filename} · {c.evidence.evidence_id}
                  </span>
                  <Badge tone="neutral">{Math.round(c.confidence * 100)}%</Badge>
                </div>
                <p className="text-[11px] text-text-muted">
                  {c.method} v{c.method_version} · {where} · {c.state}
                </p>
                {prov?.snippet && <p className="text-[11px] text-text-secondary italic break-words">“{prov.snippet}”</p>}
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full justify-center text-xs gap-2"
                  onClick={() => openProvenanceForRecord(c.evidence.evidence_id, loc)}
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Open source at {where}</span>
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
