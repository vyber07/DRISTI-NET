/** Formatting helpers shared by the evidence table and drawer. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Held or failed states the backend allows to be reprocessed (routes/evidence_routes.py `process`). */
export const REPROCESSABLE = new Set(["QUARANTINED", "SCAN_FAILED", "SCAN_TIMEOUT", "SCANNER_UNAVAILABLE", "EXTRACTION_FAILED"]);

/** Upload outcomes that mean "stored but not processed" (DEF-076). */
export const NOT_PROCESSED = new Set(["INFECTED", "SCAN_FAILED", "SCAN_TIMEOUT", "SCANNER_UNAVAILABLE", "QUARANTINED", "INTEGRITY_MISMATCH", "EXTRACTION_FAILED"]);
