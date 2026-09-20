import {
  Search,
  RotateCcw,
  AlertOctagon,
  X,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EVIDENCE_TIER_ORDER } from "@/constants/evidenceTiers";
import { useTimelineStore } from "@/stores/timelineStore";
import type { TimelineEventType } from "@/types/timeline";
import { cn } from "@/lib/utils";

const EVENT_TYPE_LABELS: Record<TimelineEventType, string> = {
  COMMUNICATION: "Communication",
  FINANCIAL_TRANSACTION: "Financial",
  PHYSICAL_MOVEMENT: "Movement",
  INCIDENT: "Incident",
  SURVEILLANCE: "Surveillance",
  FORENSIC_INGESTION: "Forensic",
  CONTRADICTION_FLAGGED: "Contradiction",
  PROCEDURAL_ACTION: "Procedural",
};

interface TimelineFilterBarProps {
  totalCount: number;
  filteredCount: number;
}

export function TimelineFilterBar({
  totalCount,
  filteredCount,
}: TimelineFilterBarProps) {
  const {
    filters,
    entityScope,
    setEntityScope,
    setSearchQuery,
    toggleType,
    selectAllTypes,
    clearTypes,
    setMinTier,
    setOnlyContradictions,
    setDateRange,
    resetFilters,
  } = useTimelineStore();

  return (
    <div className="space-y-3 rounded-lg border border-border-subtle bg-surface-1/95 p-3 shadow-panel">
      {/* Top row: Search, Entity Scope, Contradictions, Reset */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Search */}
        <div className="flex items-center gap-2 rounded-md border border-border-strong bg-surface-2 px-2.5 py-1 flex-1 min-w-56 max-w-md">
          <Search className="h-3.5 w-3.5 text-text-muted shrink-0" />
          <input
            type="text"
            value={filters.searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events, descriptions, entities, locations..."
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

        {/* Entity Scope Active Chip */}
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

        {/* Contradictions Toggle */}
        <button
          type="button"
          onClick={() => setOnlyContradictions(!filters.onlyContradictions)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium border transition-colors",
            filters.onlyContradictions
              ? "bg-critical-red/20 border-critical-red text-critical-red font-semibold"
              : "border-border-subtle bg-surface-2 text-text-secondary hover:text-text-primary hover:border-border-strong",
          )}
        >
          <AlertOctagon className="h-3.5 w-3.5 text-critical-red" />
          <span>Contradictions Only</span>
        </button>

        {/* Reset Filters */}
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

      {/* Middle row: Event Type Pills */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border-subtle/50 text-xs">
        <span className="text-micro font-semibold uppercase tracking-wider text-text-muted mr-1">
          Event Types:
        </span>
        {(Object.keys(EVENT_TYPE_LABELS) as TimelineEventType[]).map((type) => {
          const isSelected = filters.activeTypes.has(type);
          return (
            <button
              key={type}
              type="button"
              onClick={() => toggleType(type)}
              className={cn(
                "rounded px-2 py-0.5 text-micro font-medium transition-colors border",
                isSelected
                  ? "bg-surface-3 text-text-primary border-border-strong"
                  : "bg-surface-2/40 text-text-disabled border-border-subtle hover:text-text-muted",
              )}
            >
              {EVENT_TYPE_LABELS[type]}
            </button>
          );
        })}
        <div className="flex items-center gap-1 ml-auto text-micro">
          <button
            type="button"
            onClick={selectAllTypes}
            className="text-electric-blue-soft hover:underline"
          >
            All
          </button>
          <span className="text-border-strong">&bull;</span>
          <button
            type="button"
            onClick={clearTypes}
            className="text-text-muted hover:text-text-primary"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Bottom row: Evidence Tier Filter & Date Range & Counters */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-border-subtle/50 text-xs">
        {/* Evidence Tiers */}
        <div className="flex items-center gap-1.5">
          <span className="text-micro font-semibold uppercase tracking-wider text-text-muted">
            Min Tier:
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMinTier(null)}
              className={cn(
                "rounded px-1.5 py-0.5 text-micro font-mono border transition-colors",
                filters.minTier === null
                  ? "bg-electric-blue/20 border-electric-blue text-electric-blue-soft font-semibold"
                  : "bg-surface-2 border-border-subtle text-text-muted hover:text-text-primary",
              )}
            >
              All
            </button>
            {EVIDENCE_TIER_ORDER.map((tier) => {
              const isSelected = filters.minTier === tier;
              return (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setMinTier(isSelected ? null : tier)}
                  className={cn(
                    "flex items-center gap-1 rounded px-1.5 py-0.5 text-micro font-mono border transition-colors",
                    isSelected
                      ? "bg-surface-3 text-text-primary border-border-strong font-semibold"
                      : "bg-surface-2/60 border-border-subtle text-text-muted hover:text-text-primary",
                  )}
                >
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: `var(--tier-${tier}-color)` }}
                  />
                  <span>T{tier}+</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Temporal extent */}
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

        {/* Counter */}
        <div className="font-mono text-micro text-text-muted ml-auto">
          Showing <span className="font-semibold text-text-primary">{filteredCount}</span> of {totalCount} events
        </div>
      </div>
    </div>
  );
}
