import { Search, X, ArrowDownUp, RotateCcw, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuditStore } from "@/stores/auditStore";
import type { AuditActionType, AuditTargetType } from "@/types/audit";

const ACTION_OPTIONS: { value: AuditActionType | "ALL"; label: string }[] = [
  { value: "ALL", label: "All Actions" },
  { value: "VIEW_CASE", label: "Docket Opened" },
  { value: "VIEW_GRAPH", label: "Graph Loaded" },
  { value: "FILTER_GRAPH", label: "Graph Filtered" },
  { value: "EXPAND_NODE", label: "Node Expanded" },
  { value: "VIEW_EVIDENCE", label: "Evidence Inspected" },
  { value: "UPDATE_TIER", label: "Tier Elevated" },
  { value: "CREATE_NOTE", label: "Note Created" },
  { value: "UPDATE_NOTE", label: "Note Updated" },
  { value: "DELETE_NOTE", label: "Note Deleted" },
  { value: "REVEAL_PII_REQUESTED", label: "PII Requested" },
  { value: "REVEAL_PII_APPROVED", label: "PII Approved" },
  { value: "REVEAL_PII_DENIED", label: "PII Denied" },
  { value: "ARBITRATE_CONTRADICTION", label: "Contradiction Reviewed" },
  { value: "EXPORT_DOSSIER", label: "Dossier Exported" },
];

const TARGET_TYPE_OPTIONS: { value: AuditTargetType | "ALL"; label: string }[] = [
  { value: "ALL", label: "All Scopes" },
  { value: "CASE", label: "Case" },
  { value: "ENTITY", label: "Entity" },
  { value: "RELATIONSHIP", label: "Relationship" },
  { value: "EVIDENCE", label: "Evidence" },
  { value: "NOTE", label: "Note" },
  { value: "PII", label: "PII / Identity" },
  { value: "GRAPH", label: "Graph" },
];

export function AuditFilterBar() {
  const {
    logs,
    searchQuery,
    selectedAction,
    selectedTargetType,
    selectedActor,
    selectedTargetId,
    sortOrder,
    setSearchQuery,
    setActionFilter,
    setTargetTypeFilter,
    setActorFilter,
    setTargetIdFilter,
    setSortOrder,
    resetFilters,
  } = useAuditStore();

  // Extract unique actors from current logs for officer filter
  const uniqueActors = Array.from(
    new Map(
      logs.map((l) => [l.actorBadgeNumber, { badge: l.actorBadgeNumber, name: l.actorName }]),
    ).values(),
  );

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    selectedAction !== "ALL" ||
    selectedTargetType !== "ALL" ||
    selectedActor !== "ALL" ||
    selectedTargetId !== null;

  return (
    <div className="space-y-3 rounded-lg border border-border-subtle bg-surface-1 p-3 shadow-sm">
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
        {/* Search Query Input */}
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by block ID, officer name, badge, SHA-256 hash, or action description..."
            className="w-full rounded-md border border-border-subtle bg-surface-2 pl-8 pr-8 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:border-electric-blue focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Action Type Dropdown */}
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-text-muted shrink-0" />
          <select
            value={selectedAction}
            onChange={(e) => setActionFilter(e.target.value as AuditActionType | "ALL")}
            className="rounded-md border border-border-subtle bg-surface-2 px-2.5 py-1.5 text-xs text-text-primary focus:border-electric-blue focus:outline-none"
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Target Scope Dropdown */}
        <select
          value={selectedTargetType}
          onChange={(e) => setTargetTypeFilter(e.target.value as AuditTargetType | "ALL")}
          className="rounded-md border border-border-subtle bg-surface-2 px-2.5 py-1.5 text-xs text-text-primary focus:border-electric-blue focus:outline-none"
        >
          {TARGET_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              Scope: {opt.label}
            </option>
          ))}
        </select>

        {/* Officer Filter Dropdown */}
        <select
          value={selectedActor}
          onChange={(e) => setActorFilter(e.target.value)}
          className="rounded-md border border-border-subtle bg-surface-2 px-2.5 py-1.5 text-xs text-text-primary focus:border-electric-blue focus:outline-none"
        >
          <option value="ALL">All Officers</option>
          {uniqueActors.map((actor) => (
            <option key={actor.badge} value={actor.badge}>
              {actor.name} ({actor.badge})
            </option>
          ))}
        </select>

        {/* Sort Order Toggle */}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setSortOrder(sortOrder === "DESC" ? "ASC" : "DESC")}
          className="gap-1.5 text-xs shrink-0"
          title={sortOrder === "DESC" ? "Showing newest events first" : "Showing chronological block order"}
        >
          <ArrowDownUp className="h-3.5 w-3.5 text-text-muted" />
          <span>{sortOrder === "DESC" ? "Newest First" : "Block Sequence"}</span>
        </Button>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="gap-1 text-xs text-text-muted hover:text-text-primary shrink-0"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset</span>
          </Button>
        )}
      </div>

      {/* Deep-link target scope active pill */}
      {selectedTargetId && (
        <div className="flex items-center gap-2 pt-1 border-t border-border-subtle/40">
          <span className="text-micro text-text-muted uppercase font-semibold">Active Filter Scope:</span>
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-electric-blue/10 border border-electric-blue/30 text-xs font-mono text-electric-blue">
            <span>Target: {selectedTargetId}</span>
            <button
              type="button"
              onClick={() => setTargetIdFilter(null)}
              className="text-text-muted hover:text-critical-red ml-0.5"
              title="Clear target filter"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
