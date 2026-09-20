export function StatusPill({ s }: { s: string }) {
  const cls = ['CLEAN', 'ACCEPTED', 'EXTRACTED', 'GRAPH_PROJECTED', 'ACTIVE', 'APPROVE', 'SUCCEEDED', 'OK', 'CURRENT'].includes(s) ? 'ok'
    : ['INFECTED', 'SCAN_FAILED', 'SCAN_TIMEOUT', 'SCANNER_UNAVAILABLE', 'EXTRACTION_FAILED', 'INTEGRITY_MISMATCH', 'REJECT', 'FAILED', 'DENIED', 'ERROR', 'BLOCKED', 'REJECTED'].includes(s) ? 'bad'
    : ['HITL', 'REVIEW_REQUIRED', 'DEFER', 'CONTRADICTORY', 'STALE', 'QUARANTINED', 'MALWARE_SCANNING', 'PROCESSING', 'CANDIDATE'].includes(s) ? 'warn'
    : s === 'HISTORICAL' ? 'hist' : 'grey'
  return <span className={`pill ${cls}`}>{s}</span>
}

export function ErrorBox({ e }: { e: any }) {
  if (!e) return null
  return <div className="error">{e.status ? `HTTP ${e.status}: ` : ''}{e.message || String(e)}{e.trace && <span className="small"> · trace {e.trace}</span>}</div>
}

export const short = (s?: string | null, n = 12) => (s ? `${s.slice(0, n)}…` : '')

/** Spread onto a non-button clickable element (a <tr>, <div> row, etc.) so it's keyboard-operable and
 * screen-reader-visible as an interactive control, not just mouse-clickable. Prefer a real <button>
 * where the markup allows it; use this only where the element must stay a <tr>/<div> for layout. */
export function clickableRow(onActivate: () => void, label?: string) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    'aria-label': label,
    onClick: onActivate,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate() }
    },
  }
}

/** A small, dependency-free icon set (plain inline SVG, no icon font/library) used by the case
 * navigation sidebar. Deliberately simple geometric strokes -- easy to tell apart at a glance, which is
 * the actual goal (quick visual scanning while navigating), not decorative detail. */
const ICON_PATHS: Record<string, string> = {
  overview: 'M3 11l9-7 9 7M5 10v9h5v-6h4v6h5v-9',
  evidence: 'M6 3h9l4 4v14H6z M15 3v4h4 M9 12h6 M9 16h6',
  review: 'M9 11l2 2 4-4 M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  graph: 'M6 6a2 2 0 100-4 2 2 0 000 4zM18 6a2 2 0 100-4 2 2 0 000 4zM6 20a2 2 0 100-4 2 2 0 000 4zM8 6h8M7 8l4 10M17 8l-4 10',
  map: 'M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2-6-2z M9 4v14 M15 6v14',
  timeline: 'M3 6h18M3 12h18M3 18h18 M7 6v0M11 12v0M15 18v0',
  analysis: 'M4 20V10 M10 20V4 M16 20v-7 M22 20H2',
  audit: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4',
  report: 'M6 3h12v18H6z M9 8h6M9 12h6M9 16h4',
}
export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const d = ICON_PATHS[name]
  if (!d) return null
  // A single `d` string can hold any number of "M ..." subpaths natively -- SVG doesn't need a
  // separate <path> per subpath, so no manual splitting (which was here before and was fragile: some
  // of the strings above have "M" run directly against the previous token with no space, e.g. "...7M5",
  // which broke a naive `.split(' M')`).
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  )
}

/** A shimmering placeholder block for loading states, instead of bare "loading…" text. `lines`
 * controls how many text-row placeholders to stack; pass 0 for a single block (e.g. a stat card). */
export function Skeleton({ lines = 3, height }: { lines?: number; height?: number }) {
  if (height) return <div className="skeleton" style={{ height }} />
  return <div className="skeleton-lines">{Array.from({ length: lines }).map((_, i) => <div key={i} className="skeleton" style={{ width: i === lines - 1 ? '60%' : '100%' }} />)}</div>
}
