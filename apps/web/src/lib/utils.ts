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
