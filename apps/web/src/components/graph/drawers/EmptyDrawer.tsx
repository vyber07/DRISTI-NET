import { AlertTriangle, Info, PanelRightClose } from "lucide-react";
import { EVIDENCE_TIER_CONFIG, EVIDENCE_TIER_ORDER } from "@/constants/evidenceTiers";
import { useGraphStore } from "@/stores/graphStore";
import { Button } from "@/components/ui/button";

interface EmptyDrawerProps {
  onClose?: () => void;
}

export function EmptyDrawer({ onClose }: EmptyDrawerProps) {
  const { nodes, edges, caseId, caseTitle } = useGraphStore();

  const contradictionCount = edges.filter((e) => e.hasContradiction).length;

  const tierCounts: Record<number, number> = {};
  edges.forEach((e) => {
    tierCounts[e.evidenceTier] = (tierCounts[e.evidenceTier] || 0) + 1;
  });

  return (
    <div className="flex h-full flex-col bg-surface-1 text-text-primary p-4 space-y-5 overflow-y-auto overflow-x-hidden min-w-0 max-w-full">
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0 flex-1">
          <span className="text-micro font-semibold uppercase tracking-wider text-text-muted">
            Active Case Graph
          </span>
          <h2
            className="text-h3 font-semibold text-text-primary mt-1 tracking-tight line-clamp-2 break-words"
            title={caseTitle}
          >
            {caseTitle}
          </h2>
          <p className="text-xs font-mono text-electric-blue-soft mt-0.5">
            CASE #{caseId}
          </p>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-text-muted hover:text-text-primary shrink-0"
            onClick={onClose}
            aria-label="Collapse panel"
            title="Collapse Intelligence Panel"
          >
            <PanelRightClose className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Network Summary Cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md border border-border-subtle bg-surface-2 p-3 min-w-0">
          <span className="text-micro uppercase text-text-muted font-medium">Entities</span>
          <p className="text-xl font-bold font-mono text-text-primary mt-1">{nodes.length}</p>
          <span className="text-micro text-text-muted truncate block">6 POLE+ Types</span>
        </div>

        <div className="rounded-md border border-border-subtle bg-surface-2 p-3 min-w-0">
          <span className="text-micro uppercase text-text-muted font-medium">Relationships</span>
          <p className="text-xl font-bold font-mono text-text-primary mt-1">{edges.length}</p>
          <span className="text-micro text-text-muted truncate block">Tiers 2 through 6</span>
        </div>
      </div>

      {/* Contradictions notice */}
      {contradictionCount > 0 && (
        <div className="rounded-md border border-critical-red/40 bg-critical-red/10 p-3 flex items-start gap-2.5 min-w-0">
          <AlertTriangle className="h-4 w-4 text-critical-red shrink-0 mt-0.5" />
          <div className="text-xs space-y-1 min-w-0 flex-1">
            <p className="font-semibold text-critical-red truncate">
              {contradictionCount} Contradiction Detected
            </p>
            <p className="text-text-secondary text-micro leading-relaxed break-words">
              Conflicting spatial-temporal claims exist between Tower CDR and ANPR toll logs.
              Human investigator review is required.
            </p>
          </div>
        </div>
      )}

      {/* Tier Distribution */}
      <div className="space-y-2 min-w-0">
        <h3 className="text-micro font-semibold uppercase tracking-wider text-text-muted">
          Evidence Tier Distribution
        </h3>
        <div className="space-y-1.5 rounded-md border border-border-subtle bg-surface-2 p-3 text-xs min-w-0">
          {EVIDENCE_TIER_ORDER.map((tier) => {
            const cfg = EVIDENCE_TIER_CONFIG[tier];
            const count = tierCounts[tier] || 0;
            const pct = edges.length > 0 ? Math.round((count / edges.length) * 100) : 0;
            return (
              <div key={tier} className="space-y-1 min-w-0">
                <div className="flex items-center justify-between gap-2 text-micro font-mono min-w-0">
                  <span className="text-text-secondary truncate">
                    T{tier} &bull; {cfg.label}
                  </span>
                  <span className="text-text-primary font-semibold shrink-0 ml-1">
                    {count} ({pct}%)
                  </span>
                </div>
                <div className="h-1 w-full rounded-pill bg-surface-3 overflow-hidden">
                  <div
                    className="h-full rounded-pill"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: `var(--tier-${tier}-color)`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Guidance box */}
      <div className="mt-auto rounded-md border border-border-subtle bg-surface-2/40 p-3 text-xs text-text-muted space-y-2">
        <div className="flex items-center gap-1.5 text-text-secondary font-medium">
          <Info className="h-3.5 w-3.5 text-electric-blue-soft" />
          <span>Interactive Investigation</span>
        </div>
        <p className="text-micro leading-relaxed">
          Select any node or relationship in the WebGL canvas to inspect forensic properties,
          review confidence scores, and drill down to original source documents.
        </p>
      </div>
    </div>
  );
}
