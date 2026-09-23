import { Search, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEvidenceStore } from "@/stores/evidenceStore";

interface EvidenceFilterBarProps {
  totalCount: number;
  filteredCount: number;
}

export function EvidenceFilterBar({ totalCount, filteredCount }: EvidenceFilterBarProps) {
  const { filters, setSearchQuery, resetFilters } = useEvidenceStore();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-1 p-3 shadow-xs">
      <div className="flex items-center gap-2 rounded-md border border-border-strong bg-surface-2 px-2.5 py-1.5 flex-1 min-w-[280px] max-w-md">
        <Search className="h-3.5 w-3.5 text-text-muted shrink-0" />
        <input
          type="text"
          value={filters.searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by filename or SHA-256..."
          className="w-full bg-transparent text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span className="text-micro text-text-muted">
          Showing <span className="font-semibold text-text-primary">{filteredCount}</span> of {totalCount} records
        </span>
        <Button variant="ghost" size="sm" onClick={resetFilters} className="h-7 text-xs text-text-muted hover:text-text-primary px-2">
          <RotateCcw className="h-3 w-3 mr-1" />
          Reset
        </Button>
      </div>
    </div>
  );
}
