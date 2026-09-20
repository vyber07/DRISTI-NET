import {
  Search,
  RotateCcw,
  Scale,
  X,
  LayoutGrid,
  List,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EVIDENCE_TIER_ORDER } from "@/constants/evidenceTiers";
import { useEvidenceStore } from "@/stores/evidenceStore";
import type { EvidenceSourceType } from "@/types/evidence";
import { cn } from "@/lib/utils";

const SOURCE_TYPE_LABELS: Record<EvidenceSourceType, string> = {
  TELECOM: "Telecom CDR",
  BANKING: "Banking",
  LAW_ENFORCEMENT: "Law Enf.",
  SPATIAL_ANPR: "ANPR",
  SURVEILLANCE: "Surveillance",
  CYBER_INTERCEPT: "Cyber",
};

interface EvidenceFilterBarProps {
  totalCount: number;
  filteredCount: number;
}

export function EvidenceFilterBar({
  totalCount,
  filteredCount,
}: EvidenceFilterBarProps) {
  const {
    filters,
    entityScope,
    viewMode,
    setEntityScope,
    setViewMode,
    setSearchQuery,
    toggleTier,
    selectAllTiers,
    clearTiers,
    toggleSourceType,
    selectAllSourceTypes,
    clearSourceTypes,
    setCourtAdmissibleOnly,
    resetFilters,
  } = useEvidenceStore();

  return (
    <div className="space-y-3 rounded-lg border border-border-subtle bg-surface-1/95 p-3 shadow-panel">
      {/* Top row: Search, Entity Scope, Court Admissible, View Switcher, Reset */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Search */}
        <div className="flex items-center gap-2 rounded-md border border-border-strong bg-surface-2 px-2.5 py-1 flex-1 min-w-44 sm:min-w-56 max-w-md">
          <Search className="h-3.5 w-3.5 text-text-muted shrink-0" />
          <input
            type="text"
            value={filters.searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents, agencies, SHA-256 hashes, entities..."
            className="w-full bg-transparent text-xs text-text-primary placeholder:text-text-muted focus:outline-none font-sans"
            aria-label="Search evidence records"
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
              Entity Scope:
            </span>
            <span className="font-mono font-semibold">{entityScope}</span>
            <button
              type="button"
              onClick={() => setEntityScope(null)}
              className="ml-1 rounded-full p-0.5 hover:bg-electric-blue/30 text-white"
              title="Clear entity scope (view all case evidence)"
              aria-label="Clear entity scope"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Verified Only (Demo) Toggle */}
        <button
          type="button"
          onClick={() => setCourtAdmissibleOnly(!filters.courtAdmissibleOnly)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium border transition-colors",
            filters.courtAdmissibleOnly
              ? "bg-purple-900/30 border-purple-500/60 text-purple-300 font-semibold"
              : "border-border-subtle bg-surface-2 text-text-secondary hover:text-text-primary hover:border-border-strong",
          )}
        >
          <Scale className="h-3.5 w-3.5 text-purple-400" />
          <span>Verified Only (Demo)</span>
        </button>

        {/* View Mode Toggle: Grid / Table */}
        <div className="flex items-center rounded-md border border-border-subtle bg-surface-2 p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={cn(
              "p-1 rounded text-xs transition-colors",
              viewMode === "grid"
                ? "bg-surface-3 text-text-primary shadow-xs"
                : "text-text-muted hover:text-text-primary",
            )}
            title="Grid view"
            aria-label="Grid view"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={cn(
              "p-1 rounded text-xs transition-colors",
              viewMode === "table"
                ? "bg-surface-3 text-text-primary shadow-xs"
                : "text-text-muted hover:text-text-primary",
            )}
            title="Table view"
            aria-label="Table view"
          >
            <List className="h-3.5 w-3.5" />
          </button>
        </div>

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

      {/* Middle row: Source Type Pills */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border-subtle/50 text-xs">
        <span className="text-micro font-semibold uppercase tracking-wider text-text-muted mr-1">
          Source Type:
        </span>
        {(Object.keys(SOURCE_TYPE_LABELS) as EvidenceSourceType[]).map((srcType) => {
          const isSelected = filters.sourceTypes.has(srcType);
          return (
            <button
              key={srcType}
              type="button"
              onClick={() => toggleSourceType(srcType)}
              className={cn(
                "rounded px-2 py-0.5 text-micro font-medium transition-colors border",
                isSelected
                  ? "bg-surface-3 text-text-primary border-border-strong"
                  : "bg-surface-2/40 text-text-disabled border-border-subtle hover:text-text-muted",
              )}
            >
              {SOURCE_TYPE_LABELS[srcType]}
            </button>
          );
        })}
        <div className="flex items-center gap-1 ml-auto text-micro">
          <button
            type="button"
            onClick={selectAllSourceTypes}
            className="text-electric-blue-soft hover:underline"
          >
            All
          </button>
          <span className="text-border-strong">&bull;</span>
          <button
            type="button"
            onClick={clearSourceTypes}
            className="text-text-muted hover:text-text-primary"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Bottom row: Evidence Tiers & Counters */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-border-subtle/50 text-xs">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span className="text-micro font-semibold uppercase tracking-wider text-text-muted shrink-0">
            Evidence Tiers:
          </span>
          <div className="flex flex-wrap items-center gap-1 min-w-0">
            {EVIDENCE_TIER_ORDER.map((tier) => {
              const isSelected = filters.tiers.has(tier);
              return (
                <button
                  key={tier}
                  type="button"
                  onClick={() => toggleTier(tier)}
                  className={cn(
                    "flex items-center gap-1 rounded px-2 py-0.5 text-micro font-mono border transition-colors",
                    isSelected
                      ? "bg-surface-3 text-text-primary border-border-strong font-semibold"
                      : "bg-surface-2/40 border-border-subtle text-text-disabled hover:text-text-muted",
                  )}
                >
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: `var(--tier-${tier}-color)` }}
                  />
                  <span>T{tier}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1 ml-2 text-micro">
            <button
              type="button"
              onClick={selectAllTiers}
              className="text-electric-blue-soft hover:underline"
            >
              All
            </button>
            <span className="text-border-strong">&bull;</span>
            <button
              type="button"
              onClick={clearTiers}
              className="text-text-muted hover:text-text-primary"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Counter */}
        <div className="font-mono text-micro text-text-muted ml-auto">
          Showing <span className="font-semibold text-text-primary">{filteredCount}</span> of {totalCount} artifacts
        </div>
      </div>
    </div>
  );
}
