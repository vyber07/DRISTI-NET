import { Checkbox } from "@/components/ui/checkbox";
import { RelationshipBadge } from "@/components/intelligence/relationship-badge";
import { useGraphStore } from "@/stores/graphStore";
import type { RelationshipType } from "@/types/entity";

const RELATIONSHIP_TYPES: RelationshipType[] = [
  "COMMUNICATED_WITH",
  "TRANSFERRED_FUNDS",
  "USED_DEVICE",
  "USED_PHONE",
  "CO_LOCATED_AT",
  "ASSOCIATED_IN_CASE",
];

export function RelationshipTypeFilter() {
  const {
    activeRelationshipTypes,
    toggleRelationshipType,
    selectAllRelationshipTypes,
    clearRelationshipTypes,
    edges,
  } = useGraphStore();

  const getEdgeCountByType = (type: RelationshipType) => {
    return edges.filter((e) => e.relationshipType === type).length;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-micro font-semibold uppercase tracking-wider text-text-muted">
          Connection Types
        </span>
        <div className="flex items-center gap-2 text-micro">
          <button
            type="button"
            onClick={selectAllRelationshipTypes}
            className="text-teal-primary hover:underline font-medium"
          >
            All
          </button>
          <span className="text-border-strong">&bull;</span>
          <button
            type="button"
            onClick={clearRelationshipTypes}
            className="text-text-muted hover:text-text-primary"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        {RELATIONSHIP_TYPES.map((type) => {
          const isChecked = activeRelationshipTypes.has(type);
          const count = getEdgeCountByType(type);

          return (
            <label
              key={type}
              htmlFor={`rel-filter-${type}`}
              className="flex items-center justify-between gap-2 p-1.5 rounded hover:bg-surface-2 cursor-pointer transition-colors text-xs"
            >
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`rel-filter-${type}`}
                  checked={isChecked}
                  onCheckedChange={() => toggleRelationshipType(type)}
                  aria-label={`Filter by ${type}`}
                />
                <RelationshipBadge type={type} />
              </div>
              <span className="font-mono text-micro text-text-muted">
                {count}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
