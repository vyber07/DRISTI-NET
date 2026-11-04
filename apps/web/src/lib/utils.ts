import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges conditional class names and resolves Tailwind class conflicts.
 * Standard shadcn/ui convention — used by every component in components/ui.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Timestamps in the evidence are recorded without a time zone (e.g. "2019-03-04 10:00:00"). DEF-079: they were
 * parsed in the browser's zone and re-formatted as Asia/Kolkata, shifting them for any non-IST viewer. Show them
 * exactly as recorded instead; only values that carry an explicit zone are converted.
 */
const NAIVE_TS = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2})(?::\d{2})?)?$/;
export function recordedDateKey(ts: string | null | undefined): string | null {
  if (!ts) return null;
  const m = NAIVE_TS.exec(ts.trim());
  if (m) return m[1];
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
export function recordedTime(ts: string | null | undefined): string | null {
  if (!ts) return null;
  const m = NAIVE_TS.exec(ts.trim());
  if (m) return m[2] ?? null;
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(11, 16) + " UTC";
}

/**
 * FE-058: one time base for every place that compares or displays evidence times on the graph. A naive recorded time
 * ("2019-03-04 10:00:00", no zone) is read as that wall-clock time on a UTC carrier, so comparisons and labels never
 * shift with the viewer's zone; a time that carries a zone is converted normally. NaN when absent or unparseable.
 */
export function recordedTimeMs(ts: string | null | undefined): number {
  if (!ts) return NaN;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(ts.trim());
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
  const d = Date.parse(ts);
  return isNaN(d) ? NaN : d;
}

/** Display a recordedTimeMs value as recorded (no zone conversion, no zone label). */
export function formatRecordedMs(ms: number, withTime = true): string {
  if (!Number.isFinite(ms)) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC", day: "2-digit", month: "short", year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  }).format(new Date(ms));
}
