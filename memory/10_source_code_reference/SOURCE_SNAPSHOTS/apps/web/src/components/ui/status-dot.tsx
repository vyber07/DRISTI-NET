import { cn } from "@/lib/utils";

export type StatusTone =
  | "verified"
  | "processing"
  | "review-required"
  | "restricted"
  | "failed"
  | "quarantined"
  | "historical";

const toneClassMap: Record<StatusTone, string> = {
  verified: "bg-status-verified",
  processing: "bg-status-processing",
  "review-required": "bg-status-review-required",
  restricted: "bg-status-restricted",
  failed: "bg-status-failed",
  quarantined: "bg-status-quarantined",
  historical: "bg-status-historical",
};

interface StatusDotProps {
  tone: StatusTone;
  /** Pulses once on mount to draw attention to a state change — never continuous. */
  pulseOnce?: boolean;
  className?: string;
}

/**
 * Never used alone — status must always be communicated as icon/dot + text + color
 * (spec §32). This is the color+shape half; callers pair it with a text label.
 */
function StatusDot({ tone, pulseOnce, className }: StatusDotProps) {
  return (
    <span
      className={cn(
        "inline-block h-1.5 w-1.5 rounded-full shrink-0",
        toneClassMap[tone],
        pulseOnce && "animate-[pulse_600ms_ease-in-out_1]",
        className,
      )}
      aria-hidden="true"
    />
  );
}

export { StatusDot };
