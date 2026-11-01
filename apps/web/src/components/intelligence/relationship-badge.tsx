import { AlertTriangle, ArrowLeftRight, Car, Landmark, Link2, MapPinned, Phone, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { RelationshipType } from "@/types/entity";
import { cn } from "@/lib/utils";

const RELATIONSHIP_TYPE_CONFIG: Record<RelationshipType, { label: string; icon: typeof Phone }> = {
  CALLED: { label: "Called", icon: Phone },
  OBSERVED_AT: { label: "Observed At", icon: MapPinned },
  TRANSFERRED_TO: { label: "Transferred To", icon: ArrowLeftRight },
  USES_PHONE: { label: "Uses Phone", icon: Phone },
  HOLDS_ACCOUNT: { label: "Holds Account", icon: Landmark },
  MEMBER_OF: { label: "Member Of", icon: Users },
  OWNS_VEHICLE: { label: "Owns Vehicle", icon: Car },
};

interface RelationshipBadgeProps {
  type: RelationshipType;
  /** Contradictions must always be visible, never silently resolved (spec §18/§10). */
  hasContradiction?: boolean;
  className?: string;
}

function RelationshipBadge({ type, hasContradiction = false, className }: RelationshipBadgeProps) {
  // Unknown backend rel_types render generically instead of crashing.
  const config = RELATIONSHIP_TYPE_CONFIG[type] ?? { label: String(type).replace(/_/g, " "), icon: Link2 };
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
