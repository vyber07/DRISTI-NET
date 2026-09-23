import { Checkbox } from "@/components/ui/checkbox";
import { EntityBadge } from "@/components/intelligence/entity-badge";
import { useGraphStore } from "@/stores/graphStore";
import type { EntityType } from "@/types/entity";

const POLE_TYPES: EntityType[] = [
  "PERSON",
  "ORGANIZATION",
  "LOCATION",
  "EVENT",
  "FINANCIAL",
  "CYBER",
];

export function EntityTypeFilter() {
  const { 
    activeEntityTypes,
    toggleEntityType,
    selectAllEntityTypes,
    clearEntityTypes,
    nodes,
  } = useGraphStore();

  const getNodeCountByType = (type: EntityType) => {
    return nodes.filter((n) => n.entityType === type).length;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-micro font-semibold uppercase tracking-wider text-text-muted">
          Clue Categories
        </span>
        <div className="flex items-center gap-2 text-micro">
          <button
            type="button"
            onClick={selectAllEntityTypes}
            className="text-teal-primary hover:underline font-medium"
          >
            All
          </button>
          <span className="text-border-strong">&bull;</span>
          <button
            type="button"
            onClick={clearEntityTypes}
            className="text-text-muted hover:text-text-primary"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        {POLE_TYPES.map((type) => {
          const isChecked = activeEntityTypes.has(type);
          const count = getNodeCountByType(type);

          return (
            <label
              key={type}
              htmlFor={`entity-filter-${type}`}
              className="flex items-center justify-between gap-2 p-1.5 rounded hover:bg-surface-2 cursor-pointer transition-colors text-xs"
            >
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`entity-filter-${type}`}
                  checked={isChecked}
                  onCheckedChange={() => toggleEntityType(type)}
                  aria-label={`Filter by ${type}`}
                />
                <EntityBadge type={type} />
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
