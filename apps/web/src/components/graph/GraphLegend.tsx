import { useState } from "react";
import { ChevronDown, ChevronUp, Layers } from "lucide-react";
import { EVIDENCE_TIER_CONFIG, EVIDENCE_TIER_ORDER } from "@/constants/evidenceTiers";
import { cn } from "@/lib/utils";

export function GraphLegend({ className }: { className?: string }) {
  const [collapsed, setCollapsed] = useState(true);

  if (collapsed) {
    return (
      <button
        type="button"
        data-testid="graph-legend"
        onClick={() => setCollapsed(false)}
        className={cn(
          "absolute bottom-3 left-3 z-20 flex items-center gap-2 rounded-md border border-border-strong bg-surface-1/95 px-3 py-1.5 backdrop-blur shadow-panel text-xs text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-all pointer-events-auto h-8",
          className,
        )}
        title="Expand Workstation Legend"
      >
        <Layers className="h-4 w-4 text-electric-blue-soft shrink-0" />
        <span className="font-semibold text-text-primary text-xs tracking-wide">Map Legend</span>
        <ChevronUp className="h-3.5 w-3.5 text-text-muted shrink-0 ml-0.5" />
      </button>
    );
  }

  return (
    <div
      data-testid="graph-legend"
      className={cn(
        "absolute bottom-3 left-3 z-20 rounded-lg border border-border-strong bg-surface-1/95 p-3 backdrop-blur shadow-card text-xs w-64 max-h-[320px] overflow-y-auto transition-all pointer-events-auto",
        className,
      )}
    >
      <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
        <div className="flex items-center gap-2 text-text-primary font-semibold text-xs">
          <Layers className="h-4 w-4 text-teal-primary" />
          <span>Map Legend</span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="text-text-muted hover:text-text-primary p-0.5"
          aria-label="Collapse legend"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2 space-y-3">
        {/* Clue Types */}
        <div>
          <p className="text-micro font-semibold uppercase tracking-wider text-text-muted mb-1.5">
            Clue Types (Nodes)
          </p>
          <div className="grid grid-cols-2 gap-1.5 text-micro">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#17324D]" />
              <span className="text-text-secondary">Person</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-xs bg-[#526273]" />
              <span className="text-text-secondary">Organization</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#B9822B]" />
              <span className="text-text-secondary">Location</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rotate-45 bg-[#6B5B95]" />
              <span className="text-text-secondary">Event</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-xs bg-[#3F7D5A]" />
              <span className="text-text-secondary">Bank / Finance</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-xs bg-[#287C7A]" />
              <span className="text-text-secondary">Digital / Cyber</span>
            </div>
          </div>
        </div>

        {/* Verification Levels */}
        <div>
          <p className="text-micro font-semibold uppercase tracking-wider text-text-muted mb-1.5">
            How Connections Are Verified
          </p>
          <div className="space-y-1.5 text-micro">
            {EVIDENCE_TIER_ORDER.map((tier) => {
              const cfg = EVIDENCE_TIER_CONFIG[tier];
              const friendlyLabels: Record<number, string> = {
                5: "T5 — Court-Ready Proof (BSA)",
                4: "T4 — Verified Records (Bank/CDR)",
                3: "T3 — Strong Pattern Match",
                2: "T2 — Extracted Clue Mention",
              };
              return (
                <div key={tier} className="flex items-center justify-between gap-2">
                  <span className="text-text-secondary truncate">
                    {friendlyLabels[tier] || `T${tier} — ${cfg.label}`}
                  </span>
                  <span
                    className="inline-block w-10 shrink-0 border-t"
                    style={{
                      borderTopColor: `var(--tier-${tier}-color)`,
                      borderTopWidth: `${cfg.lineWidth}px`,
                      borderTopStyle:
                        cfg.lineStyle === "solid-glow" ? "solid" : cfg.lineStyle,
                      opacity: cfg.opacity,
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Contradiction indicator */}
        <div className="flex items-center justify-between border-t border-border-subtle pt-2 text-micro">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-critical-red text-[9px] font-bold text-white">
              !
            </span>
            <span className="text-critical-red font-medium">Conflicting Clues</span>
          </div>
          <span className="text-text-muted">Sources disagree</span>
        </div>

        {/* Legal ground truth note */}
        <p className="text-micro text-text-muted border-t border-border-subtle pt-2 italic">
          Every connection is verified against original evidence records.
        </p>
      </div>
    </div>
    );
  }
