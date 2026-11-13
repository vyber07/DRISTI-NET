import { useState } from "react";
import { ChevronDown, ChevronUp, Layers } from "lucide-react";
import { ENTITY_COLORS } from "@/components/graph/engine/GraphEngine";
import type { EntityType } from "@/types/entity";

const LEGEND_ITEMS: { type: EntityType; label: string }[] = [
  { type: "PERSON", label: "Person" },
  { type: "ORGANIZATION", label: "Organisation" },
  { type: "LOCATION", label: "Location" },
  { type: "EVENT", label: "Event" },
  { type: "FINANCIAL", label: "Bank account" },
  { type: "CYBER", label: "Phone / device" },
];
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
        <span className="font-semibold text-text-primary text-xs tracking-wide">Legend</span>
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
          <span>Legend</span>
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
        {/* Entity types — colours come from the engine's own map */}
        <div>
          <p className="text-xs font-semibold text-text-secondary mb-1.5">Entity types (circles)</p>
          <ul className="grid grid-cols-2 gap-1.5 text-xs">
            {LEGEND_ITEMS.map(({ type, label }) => (
              <li key={type} className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ENTITY_COLORS[type] }} aria-hidden="true" />
                <span className="text-text-secondary">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Contradiction indicator */}
        <div className="flex items-center justify-between border-t border-border-subtle pt-2 text-micro">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-critical-red text-xs font-bold text-white">
              !
            </span>
            <span className="text-critical-red font-medium">Conflicting entities</span>
          </div>
          <span className="text-text-muted">Sources disagree</span>
        </div>

        <p className="text-xs text-text-secondary border-t border-border-subtle pt-2">
          Each line is a candidate relationship built from one or more source-linked claims. Select a line to see its claims and open each source.
        </p>
      </div>
    </div>
    );
  }
