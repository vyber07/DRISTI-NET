import { useGraphStore } from "@/stores/graphStore";
import { cn } from "@/lib/utils";

function toDateInputString(timestamp: number): string {
  if (isNaN(timestamp)) return "";
  const d = new Date(timestamp);
  return d.toISOString().split("T")[0];
}

function fromDateInputString(dateStr: string, isEndOfDay = false): number {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 0;
  if (isEndOfDay) {
    d.setUTCHours(23, 59, 59, 999);
  } else {
    d.setUTCHours(0, 0, 0, 0);
  }
  return d.getTime();
}

function formatDateDisplay(timestamp: number): string {
  if (isNaN(timestamp)) return "--";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(timestamp));
}

export function DateRangeFilter() {
  const {  dateRange, setDateRange, minTimestamp, maxTimestamp, edges } =
    useGraphStore();

  const [fromTime, toTime] = dateRange;

  const handleFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) return;
    const newFrom = fromDateInputString(val, false);
    setDateRange([newFrom, Math.max(newFrom, toTime)]);
  };

  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) return;
    const newTo = fromDateInputString(val, true);
    setDateRange([Math.min(fromTime, newTo), newTo]);
  };

  const handleFullExtent = () => {
    setDateRange([minTimestamp, maxTimestamp]);
  };

  const midpoint = Math.floor((minTimestamp + maxTimestamp) / 2);

  const handleFirstHalf = () => {
    setDateRange([minTimestamp, midpoint]);
  };

  const handleSecondHalf = () => {
    setDateRange([midpoint, maxTimestamp]);
  };

  const edgesInRange = edges.filter((e) => {
    const t = new Date(e.firstSeen || e.lastSeen || 0).getTime();
    return isNaN(t) || (t >= fromTime && t <= toTime);
  }).length;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-micro font-semibold uppercase tracking-wider text-text-muted">
          Observation Window
        </span>
        <span className="font-mono text-micro text-text-secondary">
          {edgesInRange} / {edges.length} edges
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label
            htmlFor="date-range-from"
            className="text-micro text-text-muted uppercase tracking-wider block"
          >
            From
          </label>
          <input
            id="date-range-from"
            type="date"
            value={toDateInputString(fromTime)}
            min={toDateInputString(minTimestamp)}
            max={toDateInputString(maxTimestamp)}
            onChange={handleFromChange}
            aria-label="Filter observation window start date"
            className="w-full rounded border border-border-subtle bg-surface-2 px-2 py-1 text-xs font-mono text-text-primary focus:border-electric-blue focus:outline-none"
          />
          <span className="text-micro font-mono text-text-muted block truncate">
            {formatDateDisplay(fromTime)}
          </span>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="date-range-to"
            className="text-micro text-text-muted uppercase tracking-wider block"
          >
            To
          </label>
          <input
            id="date-range-to"
            type="date"
            value={toDateInputString(toTime)}
            min={toDateInputString(minTimestamp)}
            max={toDateInputString(maxTimestamp)}
            onChange={handleToChange}
            aria-label="Filter observation window end date"
            className="w-full rounded border border-border-subtle bg-surface-2 px-2 py-1 text-xs font-mono text-text-primary focus:border-electric-blue focus:outline-none"
          />
          <span className="text-micro font-mono text-text-muted block truncate">
            {formatDateDisplay(toTime)}
          </span>
        </div>
      </div>

      {/* Quick Presets */}
      <div className="flex items-center gap-1 pt-1">
        <button
          type="button"
          onClick={handleFullExtent}
          className={cn(
            "flex-1 py-1 text-micro font-mono font-medium rounded border transition-colors",
            fromTime <= minTimestamp && toTime >= maxTimestamp
              ? "bg-electric-blue/20 border-electric-blue text-electric-blue-soft font-semibold"
              : "bg-surface-2 border-border-subtle text-text-muted hover:text-text-primary hover:border-border-strong",
          )}
        >
          Full
        </button>
        <button
          type="button"
          onClick={handleFirstHalf}
          className="flex-1 py-1 text-micro font-mono font-medium rounded border bg-surface-2 border-border-subtle text-text-muted hover:text-text-primary hover:border-border-strong transition-colors"
        >
          1st Half
        </button>
        <button
          type="button"
          onClick={handleSecondHalf}
          className="flex-1 py-1 text-micro font-mono font-medium rounded border bg-surface-2 border-border-subtle text-text-muted hover:text-text-primary hover:border-border-strong transition-colors"
        >
          2nd Half
        </button>
      </div>
    </div>
  );
}
