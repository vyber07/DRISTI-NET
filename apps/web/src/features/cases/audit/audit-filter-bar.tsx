import { useMemo } from "react";
import { Search, FilterX, Clock, ShieldCheck, Database, SlidersHorizontal, User } from "lucide-react";
import { useAuditStore } from "@/stores/auditStore";
import type { AuditActionType } from "@/types/audit";
import { Badge } from "@/components/ui/badge";

export function AuditFilterBar() {
  const {
    logs,
    searchQuery,
    selectedAction,
    selectedTargetType,
    selectedActor,
    sortOrder,
    setSearchQuery,
    setActionFilter,
    setTargetTypeFilter,
    setActorFilter,
    setSortOrder,
    resetFilters,
  } = useAuditStore();

  const uniqueActions = useMemo(() => Array.from(new Set(logs.map((l) => l.action))).sort(), [logs]);
  const uniqueTargetTypes = useMemo(() => Array.from(new Set(logs.map((l) => l.target_kind).filter(Boolean))).sort(), [logs]);
  const uniqueActors = useMemo(() => Array.from(new Set(logs.map((l) => l.actor_id).filter(Boolean))).sort(), [logs]);

  const activeFilterCount =
    (selectedAction !== "ALL" ? 1 : 0) +
    (selectedTargetType !== "ALL" ? 1 : 0) +
    (selectedActor !== "ALL" ? 1 : 0) +
    (searchQuery ? 1 : 0);

  return (
    <div className="flex flex-col space-y-3 p-4 bg-surface-1 border border-border-subtle rounded-lg shadow-sm">
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search audit trail..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-surface-2 border border-border-subtle rounded-md focus:outline-none focus:ring-1 focus:ring-electric-blue text-text-primary placeholder:text-text-muted transition-shadow"
          />
        </div>

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={resetFilters}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-2 rounded-md transition-colors"
          >
            <FilterX className="h-4 w-4" />
            Clear Filters
            <Badge tone="neutral" className="ml-1 text-[10px] font-mono px-1.5 py-0 h-4">
              {activeFilterCount}
            </Badge>
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Database className="h-3.5 w-3.5 text-text-muted shrink-0" />
          <select
            value={selectedAction}
            onChange={(e) => setActionFilter(e.target.value as AuditActionType | "ALL")}
            className="text-xs bg-surface-2 border border-border-subtle rounded px-2 py-1.5 text-text-primary focus:outline-none focus:ring-1 focus:ring-electric-blue max-w-[160px] truncate"
          >
            <option value="ALL">All Actions</option>
            {uniqueActions.map((action) => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-3.5 w-3.5 text-text-muted shrink-0" />
          <select
            value={selectedTargetType}
            onChange={(e) => setTargetTypeFilter(e.target.value)}
            className="text-xs bg-surface-2 border border-border-subtle rounded px-2 py-1.5 text-text-primary focus:outline-none focus:ring-1 focus:ring-electric-blue max-w-[140px] truncate"
          >
            <option value="ALL">All Domains</option>
            {uniqueTargetTypes.map((type) => (
              <option key={type} value={type as string}>{type}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <User className="h-3.5 w-3.5 text-text-muted shrink-0" />
          <select
            value={selectedActor}
            onChange={(e) => setActorFilter(e.target.value)}
            className="text-xs bg-surface-2 border border-border-subtle rounded px-2 py-1.5 text-text-primary focus:outline-none focus:ring-1 focus:ring-electric-blue max-w-[160px] truncate"
          >
            <option value="ALL">All Actors</option>
            {uniqueActors.map((actor) => (
              <option key={actor} value={actor as string}>{actor}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Clock className="h-3.5 w-3.5 text-text-muted shrink-0" />
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as "DESC" | "ASC")}
            className="text-xs bg-surface-2 border border-border-subtle rounded px-2 py-1.5 text-text-primary focus:outline-none focus:ring-1 focus:ring-electric-blue"
          >
            <option value="DESC">Newest First</option>
            <option value="ASC">Oldest First (Genesis)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
