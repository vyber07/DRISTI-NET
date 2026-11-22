import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EVIDENCE_TIER_CONFIG, type EvidenceTier } from "@/constants/evidenceTiers";
import { cn } from "@/lib/utils";

interface EvidenceTierBadgeProps {
  tier: EvidenceTier;
  /** Compact mode shows "T4" instead of "Tier 4 — Analyst Validated". Used in dense tables/lists. */
  compact?: boolean;
  /** Short mode shows "Tier 4" instead of "Tier 4 — Analyst Validated". Ideal for compact entity cards. */
  short?: boolean;
  className?: string;
}

/**
 * Renders evidence tier using color + label together — line-style/width are
 * additionally applied by the graph engine in Phase 2 for edges. A badge is a
 * point element, so it carries the color + text channel; the graph carries
 * the full color + line-style + width channel set (spec §10).
 */
function EvidenceTierBadge({ tier, compact = false, short = false, className }: EvidenceTierBadgeProps) {
  const config = EVIDENCE_TIER_CONFIG[tier];
  const labelText = compact ? `T${tier}` : short ? config.shortLabel : `${config.shortLabel} \u2014 ${config.label}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          tone={config.tone}
          className={cn(
            "font-semibold uppercase tracking-wide inline-flex items-center gap-1.5 min-w-0 max-w-full truncate",
            className,
          )}
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
            style={{ backgroundColor: `var(--tier-${tier}-color)` }}
            aria-hidden="true"
          />
          <span className="truncate min-w-0">{labelText}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-72">
        <p className="font-semibold text-text-primary text-xs mb-0.5">
          {config.shortLabel} &mdash; {config.label}
        </p>
        <p className="text-micro font-mono text-text-muted mb-1">
          {config.code.replaceAll("_", " ")}
        </p>
        <p className="text-text-secondary text-xs leading-relaxed">{config.description}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export { EvidenceTierBadge };
