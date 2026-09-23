import { Checkbox } from "@/components/ui/checkbox";
import {
  EVIDENCE_TIER_CONFIG,
  EVIDENCE_TIER_ORDER,
  type EvidenceTier,
} from "@/constants/evidenceTiers";
import { useGraphStore } from "@/stores/graphStore";

export function TierFilter() {
  const {  activeTiers, toggleTier, selectAllTiers, clearTiers, edges } =
    useGraphStore();

  const getEdgeCountByTier = (tier: EvidenceTier) => {
    return edges.filter((e) => e.evidenceTier === tier).length;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-micro font-semibold uppercase tracking-wider text-text-muted">
          Proof Levels
        </span>
        <div className="flex items-center gap-2 text-micro">
          <button
            type="button"
            onClick={selectAllTiers}
            className="text-teal-primary hover:underline font-medium"
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

      <div className="space-y-1.5">
        {EVIDENCE_TIER_ORDER.map((tier) => {
          const config = EVIDENCE_TIER_CONFIG[tier];
          const isChecked = activeTiers.has(tier);
          const count = getEdgeCountByTier(tier);

          return (
            <label
              key={tier}
              htmlFor={`tier-filter-${tier}`}
              className="flex items-center justify-between gap-2 p-1.5 rounded hover:bg-surface-2 cursor-pointer transition-colors text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Checkbox
                  id={`tier-filter-${tier}`}
                  checked={isChecked}
                  onCheckedChange={() => toggleTier(tier)}
                  aria-label={`Filter by ${config.shortLabel} ${config.label}`}
                />
                <span
                  className="inline-block h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: `var(--tier-${tier}-color)` }}
                  aria-hidden="true"
                />
                <div className="min-w-0 truncate">
                  <span className="font-mono font-medium text-text-primary">
                    {config.shortLabel}
                  </span>
                  <span className="text-text-secondary ml-1.5 truncate">
                    &bull; {config.label}
                  </span>
                </div>
              </div>
              <span className="font-mono text-micro text-text-muted shrink-0">
                {count}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
