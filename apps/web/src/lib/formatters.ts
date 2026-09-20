/**
 * DRISTI-NET Standardized Timestamp & Metadata Formatters
 *
 * Enforces compact technical typography across drawers, metadata cards,
 * audit logs, and provenance records to guarantee zero layout overflow.
 *
 * Standard IST formats:
 * - Compact: "12 Feb 2026 · 09:30 IST"
 * - Detailed: "12 Feb 2026 · 09:30:00 IST"
 * - Date only: "12 Feb 2026"
 * - Time only: "09:30 IST"
 */

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function toDate(input: string | number | Date): Date | null {
  if (!input) return null;
  const d = typeof input === "object" ? input : new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Format timestamp into compact technical IST display:
 * "12 Feb 2026 · 09:30 IST"
 */
export function formatCompactTimestamp(input: string | number | Date): string {
  const d = toDate(input);
  if (!d) return "—";

  try {
    const parts = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(d);

    const day = parts.find((p) => p.type === "day")?.value || "";
    const month = parts.find((p) => p.type === "month")?.value || "";
    const year = parts.find((p) => p.type === "year")?.value || "";
    const hour = parts.find((p) => p.type === "hour")?.value || "";
    const minute = parts.find((p) => p.type === "minute")?.value || "";

    return `${day} ${month} ${year} · ${hour}:${minute} IST`;
  } catch {
    const day = String(d.getDate()).padStart(2, "0");
    const month = MONTH_NAMES[d.getMonth()] || "";
    const year = d.getFullYear();
    const hour = String(d.getHours()).padStart(2, "0");
    const minute = String(d.getMinutes()).padStart(2, "0");
    return `${day} ${month} ${year} · ${hour}:${minute} IST`;
  }
}

/**
 * Format timestamp into detailed technical IST display:
 * "12 Feb 2026 · 09:30:00 IST"
 */
export function formatDetailedTimestamp(input: string | number | Date): string {
  const d = toDate(input);
  if (!d) return "—";

  try {
    const parts = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(d);

    const day = parts.find((p) => p.type === "day")?.value || "";
    const month = parts.find((p) => p.type === "month")?.value || "";
    const year = parts.find((p) => p.type === "year")?.value || "";
    const hour = parts.find((p) => p.type === "hour")?.value || "";
    const minute = parts.find((p) => p.type === "minute")?.value || "";
    const second = parts.find((p) => p.type === "second")?.value || "";

    return `${day} ${month} ${year} · ${hour}:${minute}:${second} IST`;
  } catch {
    const day = String(d.getDate()).padStart(2, "0");
    const month = MONTH_NAMES[d.getMonth()] || "";
    const year = d.getFullYear();
    const hour = String(d.getHours()).padStart(2, "0");
    const minute = String(d.getMinutes()).padStart(2, "0");
    const second = String(d.getSeconds()).padStart(2, "0");
    return `${day} ${month} ${year} · ${hour}:${minute}:${second} IST`;
  }
}

/**
 * Format date only: "12 Feb 2026"
 */
export function formatDateOnly(input: string | number | Date): string {
  const d = toDate(input);
  if (!d) return "—";

  try {
    const parts = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).formatToParts(d);

    const day = parts.find((p) => p.type === "day")?.value || "";
    const month = parts.find((p) => p.type === "month")?.value || "";
    const year = parts.find((p) => p.type === "year")?.value || "";

    return `${day} ${month} ${year}`;
  } catch {
    const day = String(d.getDate()).padStart(2, "0");
    const month = MONTH_NAMES[d.getMonth()] || "";
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  }
}

/**
 * Format time only: "09:30 IST"
 */
export function formatTimeOnly(input: string | number | Date): string {
  const d = toDate(input);
  if (!d) return "—";

  try {
    const parts = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(d);

    const hour = parts.find((p) => p.type === "hour")?.value || "";
    const minute = parts.find((p) => p.type === "minute")?.value || "";

    return `${hour}:${minute} IST`;
  } catch {
    const hour = String(d.getHours()).padStart(2, "0");
    const minute = String(d.getMinutes()).padStart(2, "0");
    return `${hour}:${minute} IST`;
  }
}
