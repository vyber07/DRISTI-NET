import { Building2, CalendarClock, Landmark, MapPin, ShieldHalf, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { EntityType } from "@/types/entity";
import { cn } from "@/lib/utils";

/**
 * Icon is the primary semantic channel for entity type (matches the graph's
 * shape-as-primary-channel rule in Phase 2 — Person=circle, Org=rounded-rect,
 * Location=pin, Event=diamond, Financial=hexagon, Cyber=shield). Color stays
 * a secondary, muted channel here so this reads correctly for color-blind users.
 */
const ENTITY_TYPE_CONFIG: Record<
  EntityType,
  { label: string; icon: typeof User; tone: "blue" | "neutral" | "amber" | "emerald" | "purple" }
> = {
  PERSON: { label: "Person", icon: User, tone: "blue" },
  ORGANIZATION: { label: "Organization", icon: Building2, tone: "neutral" },
  LOCATION: { label: "Location", icon: MapPin, tone: "amber" },
  EVENT: { label: "Event", icon: CalendarClock, tone: "neutral" },
  FINANCIAL: { label: "Financial Asset", icon: Landmark, tone: "emerald" },
  CYBER: { label: "Cyber Asset", icon: ShieldHalf, tone: "purple" },
};

interface EntityBadgeProps {
  type: EntityType;
  className?: string;
}

function EntityBadge({ type, className }: EntityBadgeProps) {
  const config = ENTITY_TYPE_CONFIG[type];
  const Icon = config.icon;

  return (
    <Badge tone={config.tone} className={cn(className)}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {config.label}
    </Badge>
  );
}

export { EntityBadge, ENTITY_TYPE_CONFIG };
