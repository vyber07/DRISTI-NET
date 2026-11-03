import { Search, X, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HITLFilter, HITLTaskStatus } from "@/types/hitl";

interface HITLQueueFiltersProps {
  filter: HITLFilter;
  onFilterChange: (patch: Partial<HITLFilter>) => void;
  onReset: () => void;
  totalResults: number;
}

export function HITLQueueFilters({
  filter,
  onFilterChange,
  onReset,
  totalResults,
}: HITLQueueFiltersProps) {
  const isFiltered =
    Boolean(filter.searchQuery) ||
    (filter.status ?? "ALL") !== "ALL";

  return (
    <div className="space-y-3 rounded-md border border-border-subtle bg-surface-1 p-3">
      {/* Search Bar & Quick Counters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search by Task ID, entity name, phone, or relationship..."
            value={filter.searchQuery || ""}
            onChange={(e) => onFilterChange({ searchQuery: e.target.value })}
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-surface-2 border border-border-subtle rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:border-electric-blue font-mono"
          />
          {filter.searchQuery && (
            <button
              onClick={() => onFilterChange({ searchQuery: "" })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-micro font-mono text-text-muted shrink-0">
          <Filter className="h-3.5 w-3.5 text-electric-blue-soft" />
          <span>Showing {totalResults} task{totalResults !== 1 ? "s" : ""}</span>
        </div>

        {isFiltered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-7 text-micro text-text-muted hover:text-text-primary px-2 gap-1 font-mono"
          >
            <X className="h-3 w-3" />
            <span>Reset</span>
          </Button>
        )}
      </div>

      {/* Filter Row: Type, Status, Priority */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border-subtle/60 text-xs">
        {/* DEF-097: Type and Priority selectors removed -- every candidate is an entity merge and the API assigns no
            priority, so they filtered nothing (or, for a fixed value, everything). */}
        {/* Status Selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-micro font-mono uppercase text-text-muted">Status:</span>
          <select
            value={filter.status || "ALL"}
            onChange={(e) => onFilterChange({ status: e.target.value as HITLTaskStatus | "ALL" })}
            className="bg-surface-2 border border-border-subtle rounded px-2 py-1 text-micro font-mono text-text-primary focus:outline-none focus:border-electric-blue"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending (Action Required)</option>
            <option value="APPROVED">Approved / Resolved</option>
            <option value="REJECTED">Rejected</option>
            <option value="ESCALATED">Escalated</option>
          </select>
        </div>

      </div>
    </div>
  );
}
