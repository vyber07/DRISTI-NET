import {
  Search,
  RotateCcw,
  Plus,
  X,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotesStore } from "@/stores/notesStore";
import type { NoteCategory, NoteTargetType } from "@/types/note";
import { cn } from "@/lib/utils";
import { maskSensitiveText } from "@/lib/pii";

const CATEGORY_LABELS: Record<NoteCategory, string> = {
  HYPOTHESIS: "Hypothesis",
  EVIDENCE_ASSESSMENT: "Evidence Assess.",
  OPERATIONAL: "Operational",
  LEGAL_PROCEDURAL: "Legal / Procedural",
};

const TARGET_TYPE_LABELS: Record<NoteTargetType, string> = {
  CASE: "Case",
  ENTITY: "Entity",
  RELATIONSHIP: "Relationship",
  EVIDENCE: "Evidence",
};

interface NoteFilterBarProps {
  totalCount: number;
  filteredCount: number;
}

export function NoteFilterBar({
  totalCount,
  filteredCount,
}: NoteFilterBarProps) {
  const {
    filters,
    targetScope,
    setTargetScope,
    setSearchQuery,
    toggleCategory,
    selectAllCategories,
    clearCategories,
    toggleTargetType,
    selectAllTargetTypes,
    clearTargetTypes,
    resetFilters,
    openComposer,
  } = useNotesStore();

  return (
    <div className="space-y-3 rounded-lg border border-border-subtle bg-surface-1/95 p-3 shadow-panel">
      {/* Top row: Search, Scope indicator, New Note button, Reset */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Search */}
        <div className="flex items-center gap-2 rounded-md border border-border-strong bg-surface-2 px-2.5 py-1 flex-1 min-w-56 max-w-md">
          <Search className="h-3.5 w-3.5 text-text-muted shrink-0" />
          <input
            type="text"
            value={filters.searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes, hypotheses, tags, investigators..."
            className="w-full bg-transparent text-xs text-text-primary placeholder:text-text-muted focus:outline-none font-sans"
            aria-label="Search analyst notes"
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

        {/* Target Scope Active Chip */}
        {targetScope && (
          <div className="flex items-center gap-1.5 rounded-md border border-electric-blue/40 bg-electric-blue/15 px-2 py-1 text-xs text-electric-blue-soft">
            <Tag className="h-3 w-3" />
            <span className="font-mono text-micro font-semibold uppercase">
              Scoped:
            </span>
            <span className="font-mono font-semibold">
              {maskSensitiveText(targetScope.label || targetScope.id || targetScope.type || "")}
            </span>
            <button
              type="button"
              onClick={() => setTargetScope(null)}
              className="ml-1 rounded-full p-0.5 hover:bg-electric-blue/30 text-white"
              title="Clear target scope (view all case notes)"
              aria-label="Clear target scope"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {/* New Note Button */}
          <Button
            variant="primary"
            size="sm"
            onClick={() => openComposer()}
            className="h-7 text-xs gap-1.5 font-medium shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Author Note</span>
          </Button>

          {/* Reset Filters */}
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="h-7 text-xs gap-1 text-text-muted hover:text-text-primary"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset</span>
          </Button>
        </div>
      </div>

      {/* Middle row: Category Filters */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border-subtle/50 text-xs">
        <span className="text-micro font-semibold uppercase tracking-wider text-text-muted mr-1">
          Category:
        </span>
        {(Object.keys(CATEGORY_LABELS) as NoteCategory[]).map((cat) => {
          const isSelected = filters.categories.has(cat);
          return (
            <button
              key={cat}
              type="button"
              onClick={() => toggleCategory(cat)}
              className={cn(
                "rounded px-2 py-0.5 text-micro font-medium transition-colors border",
                isSelected
                  ? "bg-surface-3 text-text-primary border-border-strong font-semibold"
                  : "bg-surface-2/40 text-text-disabled border-border-subtle hover:text-text-muted",
              )}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          );
        })}
        <div className="flex items-center gap-1 ml-auto text-micro">
          <button
            type="button"
            onClick={selectAllCategories}
            className="text-electric-blue-soft hover:underline"
          >
            All
          </button>
          <span className="text-border-strong">&bull;</span>
          <button
            type="button"
            onClick={clearCategories}
            className="text-text-muted hover:text-text-primary"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Bottom row: Target Type Filters & Counters */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-border-subtle/50 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-micro font-semibold uppercase tracking-wider text-text-muted">
            Target Type:
          </span>
          <div className="flex items-center gap-1">
            {(Object.keys(TARGET_TYPE_LABELS) as NoteTargetType[]).map((type) => {
              const isSelected = filters.targetTypes.has(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleTargetType(type)}
                  className={cn(
                    "rounded px-2 py-0.5 text-micro font-mono border transition-colors",
                    isSelected
                      ? "bg-surface-3 text-text-primary border-border-strong font-semibold"
                      : "bg-surface-2/40 border-border-subtle text-text-disabled hover:text-text-muted",
                  )}
                >
                  {TARGET_TYPE_LABELS[type]}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1 ml-2 text-micro">
            <button
              type="button"
              onClick={selectAllTargetTypes}
              className="text-electric-blue-soft hover:underline"
            >
              All
            </button>
            <span className="text-border-strong">&bull;</span>
            <button
              type="button"
              onClick={clearTargetTypes}
              className="text-text-muted hover:text-text-primary"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Counter */}
        <div className="font-mono text-micro text-text-muted ml-auto">
          Showing <span className="font-semibold text-text-primary">{filteredCount}</span> of {totalCount} notes
        </div>
      </div>
    </div>
  );
}
