import {
  Users,
  Smartphone,
  Landmark,
  MapPin,
  FileCheck2,
} from "lucide-react";
import type { CaseStats } from "@/types/case";

interface CaseStatsGridProps {
  stats?: CaseStats;
}

export function CaseStatsGrid({ stats: _stats }: CaseStatsGridProps) {
  const cards = [
    {
      label: "People",
      value: "4",
      description: "Suspects, victims & associates",
      icon: Users,
      accent: "text-electric-blue bg-electric-blue/10",
    },
    {
      label: "Phone Numbers",
      value: "2",
      description: "Threat & extortion handsets",
      icon: Smartphone,
      accent: "text-amber bg-amber/10",
    },
    {
      label: "Financial Accounts",
      value: "1",
      description: "Mule account used for cash",
      icon: Landmark,
      accent: "text-verified-emerald bg-verified-emerald/10",
    },
    {
      label: "Locations",
      value: "3",
      description: "Cell tower & safehouse sites",
      icon: MapPin,
      accent: "text-text-secondary bg-surface-3",
    },
    {
      label: "Evidence Records",
      value: "4",
      description: "Original source documents",
      icon: FileCheck2,
      accent: "text-court-purple bg-court-purple/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-5 gap-3.5 min-w-0 w-full max-w-full">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.label}
            className="p-3.5 rounded-xl border border-border-subtle bg-surface-1 shadow-xs flex flex-col justify-between min-h-[96px]"
          >
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-xs font-bold text-text-primary leading-tight">
                {c.label}
              </span>
              <div className={`p-1.5 rounded-lg ${c.accent} shrink-0`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
            </div>

            <div className="mt-2 min-w-0">
              <span className="text-2xl font-extrabold text-text-primary block leading-none tracking-tight">
                {c.value}
              </span>
              <p className="text-[11px] text-text-secondary mt-1 leading-snug">
                {c.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
