import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Small, dependency-free charts built to the dataviz rules (thin marks, 2px surface gaps between segments,
 * 4px rounded data-ends, legend for >= 2 parts, hover detail, and a screen-reader table for every chart).
 * Palettes are fixed by meaning and were validated (adjacent CVD/normal-vision separation) with the dataviz
 * validator; amber sits under 3:1 on white, so every part also has a visible label/legend and a table.
 */

/** Evidence state groups, in validated adjacent order. */
export const EVIDENCE_GROUP_COLORS = {
  graph: "#2f8a5b",      // In graph / active
  processing: "#3b82c4", // scanning, accepted, extracting
  review: "#d99a1e",     // needs human review
  held: "#7d5ba6",       // quarantined / scan not clean yet
  failed: "#c0453f",     // infected, failed, integrity mismatch
} as const;

/** Review states, in validated adjacent order. Red is deliberately not used for any decision about a person. */
export const REVIEW_COLORS = {
  approved: "#2f8a5b",
  rejected: "#3b82c4",
  pending: "#d99a1e",
  deferred: "#7d5ba6",
} as const;

export const ACCENT = "#21706e"; // single-series bars (brand teal, >= 3:1 on white)


/** WCAG contrast ratio between two hex colours. */
function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
const INK = "#10202b";
/** White or near-black, whichever reads better on the fill; null when neither reaches 4.5:1 (then no in-bar label). */
function labelInk(fill: string): string | null {
  const w = contrastRatio("#ffffff", fill), k = contrastRatio(INK, fill);
  const best = w >= k ? "#ffffff" : INK;
  return Math.max(w, k) >= 4.5 ? best : null;
}

export interface Part { key: string; label: string; value: number; color: string }

/** Tall segmented bar (one whole split into parts) with a legend, hover detail and a table alternative. */
export function SegmentedBar({ parts, title, unit = "items", testId }: { parts: Part[]; title: string; unit?: string; testId?: string }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const [hover, setHover] = useState<string | null>(null);
  const tableId = useId();
  const shown = parts.filter((p) => p.value > 0);
  if (total === 0) return <p className="text-sm text-text-secondary">Nothing to show yet.</p>;
  // Largest-remainder rounding, so the shown percentages always add up to exactly 100.
  const raw = shown.map((p) => (p.value / total) * 100);
  const floors = raw.map(Math.floor);
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  raw.map((r, i) => [r - floors[i], i] as const).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { floors[i]++; left--; } });
  const shares = new Map(shown.map((p, i) => [p.key, floors[i]]));
  const pctOf = (p: Part) => shares.get(p.key) ?? 0;
  const active = shown.find((p) => p.key === hover);
  return (
    <figure className="space-y-2" data-testid={testId}>
      <div className="flex h-7 w-full gap-[2px]" role="img" aria-label={`${title}: ` + shown.map((p) => `${p.label} ${p.value} (${pctOf(p)}%)`).join(", ")} aria-describedby={tableId}>
        {shown.map((p) => (
          <div key={p.key} tabIndex={0} title={`${p.label}: ${p.value} ${unit} (${pctOf(p)}%)`}
            onMouseEnter={() => setHover(p.key)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(p.key)} onBlur={() => setHover(null)}
            // the hovered/focused part gets an outline; the others are not faded (fading lowered their labels' contrast)
            className={cn("relative flex min-w-[6px] items-center rounded-[4px] px-2 text-xs font-semibold outline-offset-2",
              hover === p.key && "outline outline-2 outline-[#10202b]")}
            style={{ flexGrow: p.value, flexBasis: 0, backgroundColor: p.color, color: labelInk(p.color) ?? undefined }}>
            {/* printed only where it is legible (>= 4.5:1); the legend always carries count and share */}
            {pctOf(p) >= 12 && labelInk(p.color) && <span className="truncate" aria-hidden="true">{pctOf(p)}%</span>}
          </div>
        ))}
      </div>
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
        {shown.map((p) => (
          <span key={p.key} className={cn("inline-flex items-center gap-1.5", hover === p.key && "text-text-primary font-semibold")}>
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: p.color }} aria-hidden="true" />
            {p.label} <span className="tabular-nums text-text-primary">{p.value}</span> <span className="tabular-nums">({pctOf(p)}%)</span>
          </span>
        ))}
        <span className="ml-auto text-text-secondary" aria-live="polite">
          {active ? `${active.label}: ${active.value} of ${total} ${unit} (${pctOf(active)}%)` : `${total} ${unit}`}
        </span>
      </figcaption>
      <SrTable id={tableId} caption={title} head={["Part", "Count", "Share"]} rows={shown.map((p) => [p.label, String(p.value), `${pctOf(p)}%`])} />
    </figure>
  );
}

/** Horizontal bars for one series (≤ 24px thick, 4px rounded data-end, square at the baseline). */
export function BarList({ items, title, valueLabel, color = ACCENT, testId, render }: {
  items: { key: string; label: ReactNode; text: string; value: number }[]; title: string; valueLabel: string; color?: string; testId?: string;
  render?: (key: string) => ReactNode;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const tableId = useId();
  return (
    <figure className="space-y-2.5" data-testid={testId} aria-describedby={tableId}>
      {items.map((i) => (
        <div key={i.key} className="grid grid-cols-[minmax(0,1fr)_minmax(3rem,1fr)_auto] items-center gap-2 text-sm sm:grid-cols-[minmax(0,14rem)_1fr_auto] sm:gap-3">
          <div className="min-w-0 truncate text-text-primary">{i.label}</div>
          <div className="h-5 rounded-sm bg-surface-2" aria-hidden="true">
            <div className="h-5 rounded-r-[4px]" title={`${i.text}: ${i.value} ${valueLabel}`}
              style={{ width: `${Math.max(i.value > 0 ? 2 : 0, (i.value / max) * 100)}%`, backgroundColor: color }} />
          </div>
          <div className="flex items-center gap-2 tabular-nums text-text-primary">{i.value}{render?.(i.key)}</div>
        </div>
      ))}
      <SrTable id={tableId} caption={title} head={["Item", valueLabel]} rows={items.map((i) => [i.text, String(i.value)])} />
    </figure>
  );
}

/** Columns over time for one series, with hover detail and a table alternative. */
export function ColumnChart({ points, title, valueLabel, color = ACCENT, testId }: {
  points: { key: string; label: string; value: number }[]; title: string; valueLabel: string; color?: string; testId?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const tableId = useId();
  const max = Math.max(1, ...points.map((p) => p.value));
  if (!points.length) return <p className="text-sm text-text-secondary">No dated events.</p>;
  const tickEvery = Math.max(1, Math.ceil(points.length / 7)); // whole labels need ~1/7 of the width each
  const h = hover !== null ? points[hover] : null;
  return (
    <figure className="space-y-2" data-testid={testId}>
      <div className="flex items-baseline justify-between text-xs text-text-secondary">
        <span>Highest: {max} {valueLabel}</span>
        <span aria-live="polite" className="text-text-primary">{h ? `${h.label}: ${h.value} ${valueLabel}` : `${points.reduce((s, p) => s + p.value, 0)} ${valueLabel} in ${points.length} periods`}</span>
      </div>
      <div className="relative h-36 border-b border-border-strong" role="img" aria-label={`${title}, ${points.length} periods`} aria-describedby={tableId}>
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-border-subtle" aria-hidden="true" />
        <div className="relative flex h-full items-end gap-[2px]">
          {points.map((p, i) => (
            <div key={p.key} className="flex h-full flex-1 items-end justify-center" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <div className={cn("w-full max-w-6 rounded-t-[4px] transition-opacity", hover !== null && hover !== i && "opacity-50")}
                title={`${p.label}: ${p.value} ${valueLabel}`}
                style={{ height: `${(p.value / max) * 100}%`, minHeight: p.value > 0 ? 2 : 0, backgroundColor: color }} />
            </div>
          ))}
        </div>
      </div>
      <div className="flex h-4 gap-[2px] text-[11px] text-text-secondary" aria-hidden="true">
        {points.map((p, i) => <div key={p.key} className="relative flex-1 text-center"><span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">{i % tickEvery === 0 ? p.label : ""}</span></div>)}
      </div>
      <SrTable id={tableId} caption={title} head={["Period", valueLabel]} rows={points.map((p) => [p.label, String(p.value)])} />
    </figure>
  );
}

function SrTable({ id, caption, head, rows }: { id: string; caption: string; head: string[]; rows: string[][] }) {
  return (
    // Hidden via a wrapper: a <table> ignores the 1px width of .sr-only and kept its full width (page scrolled sideways at 320px).
    <div className="sr-only">
      <table id={id}>
        <caption>{caption}</caption>
        <thead><tr>{head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}</tr>)}</tbody>
      </table>
    </div>
  );
}

/** Group a backend evidence state into one of the five chart groups. */
export function evidenceGroup(status: string): keyof typeof EVIDENCE_GROUP_COLORS {
  if (["GRAPH_PROJECTED", "ACTIVE"].includes(status)) return "graph";
  if (status === "HITL") return "review";
  if (["QUARANTINED", "SCAN_FAILED", "SCAN_TIMEOUT", "SCANNER_UNAVAILABLE", "UPLOADED", "HASHED"].includes(status)) return "held";
  if (["INFECTED", "EXTRACTION_FAILED", "INTEGRITY_MISMATCH", "REJECTED", "TOMBSTONED", "STALE"].includes(status)) return "failed";
  return "processing";
}

export const EVIDENCE_GROUP_LABEL: Record<keyof typeof EVIDENCE_GROUP_COLORS, string> = {
  graph: "In graph", processing: "Processing", review: "Needs review", held: "Held (scan gate)", failed: "Failed or blocked",
};

/** Stat tile: icon chip, label, value. */
export function StatTile({ icon, label, value, hint, tone = "teal" }: { icon: ReactNode; label: string; value: ReactNode; hint?: string; tone?: "teal" | "amber" | "blue" | "violet" }) {
  const tones = {
    teal: "bg-electric-blue/10 text-electric-blue",
    amber: "bg-amber/15 text-amber-dim",
    blue: "bg-[#3b82c4]/12 text-[#245f96]",
    violet: "bg-court-purple/12 text-court-purple",
  };
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-1 px-4 py-3.5 shadow-[0_1px_2px_rgba(16,42,61,0.06)]">
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", tones[tone])} aria-hidden="true">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-text-secondary">{label}</div>
        <div className="text-2xl font-semibold leading-tight text-text-primary">{value}</div>
        {hint && <div className="text-xs text-text-secondary">{hint}</div>}
      </div>
    </div>
  );
}
