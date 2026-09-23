import { Search, X, RotateCcw, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTimelineStore } from "@/stores/timelineStore";

export function TimelineFilterBar() {
  const {
    events,
    entityScope,
    filters,
    setEntityScope,
    setDateRange,
    setSearchQuery,
    resetFilters,
    getFilteredEvents,
  } = useTimelineStore();

  const filteredCount = getFilteredEvents().length;
  const totalCount = events.length;

  return (
    <div className="space-y-3 rounded-lg border border-border-subtle bg-surface-1/95 p-3 shadow-panel">
      {/* Top row: Search, Entity Scope, Reset */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 rounded-md border border-border-strong bg-surface-2 px-2.5 py-1 flex-1 min-w-56 max-w-md">
          <Search className="h-3.5 w-3.5 text-text-muted shrink-0" />
          <input
            type="text"
            value={filters.searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events, relationships, entities..."
            className="w-full bg-transparent text-xs text-text-primary placeholder:text-text-muted focus:outline-none font-sans"
            aria-label="Search timeline events"
          />
          {filters.searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-text-muted hover:text-text-primary text-xs"
              aria-label="Clear search"
            >
              &times;
            </button>
          )}
        </div>

        {entityScope && (
          <div className="flex items-center gap-1.5 rounded-md border border-electric-blue/40 bg-electric-blue/15 px-2 py-1 text-xs text-electric-blue-soft">
            <span className="font-mono text-micro font-semibold uppercase">
              Scoped:
            </span>
            <span className="font-mono font-semibold">{entityScope}</span>
            <button
              type="button"
              onClick={() => setEntityScope(null)}
              className="ml-1 rounded-full p-0.5 hover:bg-electric-blue/30 text-white"
              title="Clear entity scope (view all case events)"
              aria-label="Clear entity scope"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={resetFilters}
          className="h-7 text-xs gap-1 text-text-muted hover:text-text-primary"
        >
          <RotateCcw className="h-3 w-3" />
          <span>Reset Filters</span>
        </Button>
      </div>

      {/* Bottom row: Temporal extent */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-border-subtle/50 text-xs mt-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-3 w-3 text-text-muted" />
          <input
            type="date"
            value={filters.startDate || ""}
            onChange={(e) =>
              setDateRange(e.target.value || null, filters.endDate)
            }
            className="rounded border border-border-subtle bg-surface-2 px-1.5 py-0.5 text-micro font-mono text-text-primary focus:outline-none"
            title="Start Date"
            aria-label="Start Date"
          />
          <span className="text-text-muted text-micro">&rarr;</span>
          <input
            type="date"
            value={filters.endDate || ""}
            onChange={(e) =>
              setDateRange(filters.startDate, e.target.value || null)
            }
            className="rounded border border-border-subtle bg-surface-2 px-1.5 py-0.5 text-micro font-mono text-text-primary focus:outline-none"
            title="End Date"
            aria-label="End Date"
          />
        </div>

        <div className="font-mono text-micro text-text-muted ml-auto">
          Showing <span className="font-semibold text-text-primary">{filteredCount}</span> of {totalCount} events
        </div>
      </div>
    </div>
  );
}
