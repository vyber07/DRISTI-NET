import {
  SlidersHorizontal,
  X,
  RotateCcw,
  AlertTriangle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useGraphStore } from "@/stores/graphStore";
import { EntityTypeFilter } from "./EntityTypeFilter";
import { RelationshipTypeFilter } from "./RelationshipTypeFilter";
import { TierFilter } from "./TierFilter";
import { ConfidenceRangeFilter } from "./ConfidenceRangeFilter";
import { DateRangeFilter } from "./DateRangeFilter";
import { cn } from "@/lib/utils";

export function GraphFilterPanel() {
  const {
    isFilterPanelOpen,
    setFilterPanelOpen,
    resetFilters,
        activeTiers,
    activeEntityTypes,
    activeRelationshipTypes,
    minConfidence,
    nodes,
    edges,
  } = useGraphStore();

  if (!isFilterPanelOpen) return null;

  // Calculate active filter count
  let activeFilterCount = 0;
  if (activeTiers.size < 5) activeFilterCount++;
  if (activeEntityTypes.size < 6) activeFilterCount++;
  if (activeRelationshipTypes.size < 6) activeFilterCount++;
    if (minConfidence > 0) activeFilterCount++;

  return (
    <aside
      aria-label="Graph filter controls"
      className="absolute top-14 left-3 bottom-14 w-80 z-20 flex flex-col rounded-lg border border-border-strong bg-surface-1/95 backdrop-blur-md shadow-2xl overflow-hidden pointer-events-auto transition-all animate-in fade-in slide-in-from-left-2 duration-200"
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-border-subtle p-3 bg-surface-2/60">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-teal-primary" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
            Filter Map Clues
          </h2>
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-teal-primary/15 border border-teal-primary/30 px-1.5 py-0.5 text-micro font-mono font-semibold text-teal-primary">
              {activeFilterCount} active
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={resetFilters}
            className="h-6 w-6 text-text-muted hover:text-text-primary"
            title="Reset all filters"
            aria-label="Reset all filters"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setFilterPanelOpen(false)}
            className="h-6 w-6 text-text-muted hover:text-text-primary"
            title="Close filter panel"
            aria-label="Close filter panel"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Scrollable Filter Sections */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs divide-y divide-border-subtle/70">
        {/* Contradiction Flag Fast Filter */}
        <div className="pb-1">
          <label
            htmlFor="filter-contradictions-only"
            className={cn(
              "flex items-center justify-between p-2 rounded border cursor-pointer transition-colors",
              
            )}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle
                className={cn(
                  "h-3.5 w-3.5",
                  
                )}
              />
              <span className="font-medium text-xs">
                Conflicting Clues Only
              </span>
            </div>
          </label>
        </div>

        {/* Clue Categories */}
        <div className="pt-3">
          <EntityTypeFilter />
        </div>

        {/* Connection Types */}
        <div className="pt-3">
          <RelationshipTypeFilter />
        </div>

        {/* Proof Levels */}
        <div className="pt-3">
          <TierFilter />
        </div>

        {/* Connection Strength */}
        <div className="pt-3">
          <ConfidenceRangeFilter />
        </div>

        {/* Time Window */}
        <div className="pt-3">
          <DateRangeFilter />
        </div>
      </div>

      {/* Panel Footer */}
      <div className="border-t border-border-subtle p-2.5 bg-surface-2/40 space-y-1">
        <div className="flex items-center justify-between text-micro font-mono text-text-muted">
          <span>Current Map:</span>
          <span className="text-text-secondary font-medium">
            {nodes.length} clues &bull; {edges.length} connections
          </span>
        </div>
        <div className="flex items-center gap-1 text-micro text-text-muted">
          <Info className="h-3 w-3 shrink-0 text-text-disabled" />
          <span>Filters update the map instantly</span>
        </div>
      </div>
    </aside>
  );
}
