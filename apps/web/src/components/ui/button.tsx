import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Button hierarchy per DRISTI-NET frontend spec §31:
 * - primary: most important action (View Source, Approve, Save, Open Case)
 * - secondary: supporting actions (Filter, Expand, Export, Add Note)
 * - destructive: requires confirmation elsewhere (Reject, Delete, Revoke)
 * - restricted: policy-denied action — shows a lock, communicates *why*
 *   unavailable rather than just disabling silently.
 * - ghost: low-emphasis chrome action (toolbar icons, nav)
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium " +
    "transition-colors duration-[var(--motion-fast)] ease-[var(--motion-ease)] " +
    "disabled:pointer-events-none disabled:opacity-50 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue-soft focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        primary:
          "bg-electric-blue text-white hover:bg-electric-blue-dim border border-transparent shadow-xs font-medium",
        secondary:
          "bg-surface-1 text-text-primary border border-border-strong hover:bg-surface-2 shadow-xs font-medium",
        destructive:
          "bg-critical-red/10 text-critical-red border border-critical-red/30 hover:bg-critical-red/20 font-medium",
        restricted:
          "bg-surface-2 text-text-disabled border border-border-subtle cursor-not-allowed",
        ghost:
          "bg-transparent text-text-secondary hover:bg-surface-2 hover:text-text-primary border border-transparent font-medium",
      },
      size: {
        sm: "h-7 px-2.5 text-xs",
        md: "h-9 px-3.5 text-sm",
        lg: "h-10 px-5 text-sm",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** For variant="restricted" — one-line explanation shown via title/aria-label. */
  restrictedReason?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, restrictedReason, children, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    const isRestricted = variant === "restricted";

    // Radix Slot requires exactly one React element child. When `asChild` is
    // used (e.g. Button wrapping a router Link), we must pass `children`
    // through untouched rather than inserting a sibling Lock icon — that
    // combination isn't used together in this codebase (restricted buttons
    // are never asChild), but guarding here keeps the component honest.
    const content = asChild ? (
      children
    ) : (
      <>
        {isRestricted && <Lock className="h-3.5 w-3.5" aria-hidden="true" />}
        {children}
      </>
    );

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isRestricted || props.disabled}
        aria-label={isRestricted ? restrictedReason : props["aria-label"]}
        title={isRestricted ? restrictedReason : props.title}
        {...props}
      >
        {content}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
