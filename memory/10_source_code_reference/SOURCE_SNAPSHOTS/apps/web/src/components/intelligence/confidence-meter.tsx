import { cn } from "@/lib/utils";

interface ConfidenceMeterProps {
  /** 0.0 - 1.0 */
  confidence: number;
  /** Show "MANUAL REVIEW REQUIRED" when confidence sits in the HITL arbitration
   * band (0.60-0.95, per technical spec §18 Stage 4) and hasn't been human-validated. */
  flagManualReview?: boolean;
  label?: string;
  className?: string;
}

function confidenceTone(confidence: number) {
  if (confidence >= 0.95) return "bg-verified-emerald";
  if (confidence >= 0.85) return "bg-electric-blue";
  if (confidence >= 0.6) return "bg-amber";
  return "bg-critical-red";
}

/**
 * Confidence is never hidden behind a generic "AI result" label (spec P3).
 * Always renders the exact numeric percentage alongside the bar.
 */
function ConfidenceMeter({
  confidence,
  flagManualReview = false,
  label = "Confidence",
  className,
}: ConfidenceMeterProps) {
  const pct = Math.round(confidence * 100);
  const inArbitrationBand = confidence >= 0.6 && confidence < 0.95;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between">
        <span className="text-micro uppercase tracking-wide text-text-muted">{label}</span>
        <span className="text-sm font-semibold text-text-primary tabular-nums">
          {pct.toFixed(0)}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="h-1.5 w-full rounded-pill bg-surface-3 overflow-hidden"
      >
        <div
          className={cn("h-full rounded-pill transition-[width] duration-[var(--motion-base)]", confidenceTone(confidence))}
          style={{ width: `${pct}%` }}
        />
      </div>
      {flagManualReview && inArbitrationBand && (
        <p className="text-micro font-semibold uppercase tracking-wide text-amber">
          Manual review required
        </p>
      )}
    </div>
  );
}

export { ConfidenceMeter };
