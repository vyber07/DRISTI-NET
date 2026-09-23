import { FileCheck2, CheckSquare } from "lucide-react";
import type { CaseStats } from "@/types/case";

interface CaseStatsGridProps {
  stats?: CaseStats;
}

export function CaseStatsGrid({ stats }: CaseStatsGridProps) {
  if (!stats) return null;

  const cards = [
    {
      label: "Evidence Records",
      value: stats.totalEvidence ?? "-",
      description: "Original source documents",
      icon: FileCheck2,
      accent: "text-court-purple bg-court-purple/10",
    },
    {
      label: "Pending Reviews",
      value: stats.pendingTasks ?? "-",
      description: "Manual tasks requiring review",
      icon: CheckSquare,
      accent: "text-electric-blue bg-electric-blue/10",
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 min-w-0 w-full max-w-full">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.label} className="p-3.5 rounded-xl border border-border-subtle bg-surface-1 shadow-xs flex flex-col justify-between min-h-[96px]">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-xs font-bold text-text-primary leading-tight">{c.label}</span>
              <div className={`p-1.5 rounded-lg \${c.accent} shrink-0`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-2 min-w-0">
              <span className="text-2xl font-extrabold text-text-primary block leading-none tracking-tight">{c.value}</span>
              <p className="text-[11px] text-text-secondary mt-1 leading-snug">{c.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
