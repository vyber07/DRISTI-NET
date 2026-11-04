import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { CaseSummary } from "@/types/case";
import { cn } from "@/lib/utils";

type SortKey = "id" | "title" | "jurisdiction" | "evidence_count" | "pending_reviews" | "opened_at";
const COLUMNS: { key: SortKey; label: string; numeric?: boolean; hideBelow?: string }[] = [
  { key: "id", label: "Case" },
  { key: "title", label: "Title" },
  { key: "jurisdiction", label: "Jurisdiction", hideBelow: "md" },
  { key: "evidence_count", label: "Evidence", numeric: true },
  { key: "pending_reviews", label: "Awaiting review", numeric: true },
  { key: "opened_at", label: "Opened", hideBelow: "sm" },
];

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** Sortable case table. The first cell is a real link (keyboard users); the whole row is also clickable. */
export function CaseTable({ cases, caption }: { cases: CaseSummary[]; caption: string }) {
  const navigate = useNavigate();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "id", dir: 1 });
  const rows = useMemo(() => [...cases].sort((a, b) => {
    const x = a[sort.key], y = b[sort.key];
    return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * sort.dir;
  }), [cases, sort]);

  const hide = (h?: string) => (h === "md" ? "hidden md:table-cell" : h === "sm" ? "hidden sm:table-cell" : "");
  return (
    <div className="overflow-x-auto rounded-lg border border-border-subtle bg-surface-1">
      <table className="w-full text-sm" data-testid="case-table">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
          <tr>
            {COLUMNS.map((c) => {
              const active = sort.key === c.key;
              const Icon = active ? (sort.dir === 1 ? ArrowUp : ArrowDown) : ArrowUpDown;
              return (
                <th key={c.key} scope="col" className={cn("px-3 py-2", c.numeric && "text-right", hide(c.hideBelow))}
                  aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
                  <button type="button" className={cn("inline-flex items-center gap-1 hover:text-text-primary", c.numeric && "flex-row-reverse")}
                    onClick={() => setSort({ key: c.key, dir: active ? (sort.dir === 1 ? -1 : 1) : 1 })}>
                    {c.label}<Icon className="h-3 w-3" aria-hidden="true" />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {rows.map((c) => (
            <tr key={c.id} className="cursor-pointer hover:bg-surface-2/60" onClick={() => navigate(`/cases/${encodeURIComponent(c.id)}`)}>
              <td className="px-3 py-2.5 whitespace-nowrap">
                <Link to={`/cases/${encodeURIComponent(c.id)}`} onClick={(e) => e.stopPropagation()} className="font-mono text-sm font-semibold text-electric-blue hover:underline">
                  {c.id}
                </Link>
              </td>
              <td className="px-3 py-2.5 text-text-primary min-w-[12rem]">{c.title}</td>
              <td className={cn("px-3 py-2.5 text-text-secondary", hide("md"))}>{c.jurisdiction}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{c.evidence_count}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {c.pending_reviews > 0 ? <span className="font-semibold text-amber-dim">{c.pending_reviews}</span> : <span className="text-text-secondary">0</span>}
              </td>
              <td className={cn("px-3 py-2.5 text-text-secondary whitespace-nowrap", hide("sm"))}>{formatDate(c.opened_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
