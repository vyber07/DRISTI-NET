import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Generic badge shell. Intelligence-specific badges (EvidenceTierBadge,
 * EntityBadge, RelationshipBadge) compose this rather than reimplementing
 * padding/radius/typography — keeping one visual contract for all "tag"
 * style elements in the workstation.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium leading-4 whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-surface-2 border-border-subtle text-text-secondary",
        blue: "bg-electric-blue/10 border-electric-blue/30 text-electric-blue",
        amber: "bg-amber/10 border-amber/30 text-amber",
        orange: "bg-orange/10 border-orange/30 text-orange",
        emerald: "bg-verified-emerald/10 border-verified-emerald/30 text-verified-emerald",
        purple: "bg-court-purple/10 border-court-purple/30 text-court-purple",
        red: "bg-critical-red/10 border-critical-red/30 text-critical-red",
        gray: "bg-surface-2 border-border-subtle text-text-muted",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

// forwardRef is required here even though Badge has no interactive behavior
// of its own: it is frequently composed as `<TooltipTrigger asChild><Badge/></TooltipTrigger>`,
// and Radix's Slot needs to attach a ref to whatever element it wraps.
const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, tone, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ tone, className }))} {...props} />
  ),
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
