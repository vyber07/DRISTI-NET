import { AlertTriangle, ArrowLeftRight, MapPinned, Phone, ShieldHalf, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { RelationshipType } from "@/types/entity";
import { cn } from "@/lib/utils";

const RELATIONSHIP_TYPE_CONFIG: Record<RelationshipType, { label: string; icon: typeof Phone }> = {
  COMMUNICATED_WITH: { label: "Communicated With", icon: Phone },
  TRANSFERRED_FUNDS: { label: "Transferred Funds", icon: ArrowLeftRight },
  USED_DEVICE: { label: "Used Device", icon: ShieldHalf },
  USED_PHONE: { label: "Used Phone", icon: Phone },
  CO_LOCATED_AT: { label: "Co-Located At", icon: MapPinned },
  ASSOCIATED_IN_CASE: { label: "Associated In Case", icon: Users },
};

interface RelationshipBadgeProps {
  type: RelationshipType;
  /** Contradictions must always be visible, never silently resolved (spec §18/§10). */
  hasContradiction?: boolean;
  className?: string;
}

function RelationshipBadge({ type, hasContradiction = false, className }: RelationshipBadgeProps) {
  const config = RELATIONSHIP_TYPE_CONFIG[type];
  const Icon = config.icon;

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <Badge tone="neutral">
        <Icon className="h-3 w-3" aria-hidden="true" />
        {config.label}
      </Badge>
      {hasContradiction && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge tone="red" className="font-semibold">
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              Contradiction
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-64">
            <p className="text-text-secondary">
              Conflicting assertions exist for this relationship. Resolution status must be
              reviewed before this edge is treated as trustworthy.
            </p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

export { RelationshipBadge };
