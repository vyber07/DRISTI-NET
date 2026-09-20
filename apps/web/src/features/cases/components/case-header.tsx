import { Link } from "react-router-dom";
import {
  ArrowLeft,
  FileDown,
  Network,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusDot } from "@/components/ui/status-dot";
import type { CaseDetail } from "@/types/case";

interface CaseHeaderProps {
  caseData: CaseDetail;
  activeTab: string;
}

export function CaseHeader({ caseData, activeTab }: CaseHeaderProps) {
  return (
    <div className="flex h-14 items-center justify-between px-3 sm:px-4 bg-surface-1 w-full max-w-full min-w-0 overflow-hidden">
      {/* Left: Back & Case Identity */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 mr-3 overflow-hidden">
        <Button asChild variant="ghost" size="sm" className="gap-1 text-xs shrink-0 h-8 px-2">
          <Link to="/command-center">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Home</span>
          </Link>
        </Button>

        <div className="h-4 w-px bg-border-subtle shrink-0" />

        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 overflow-hidden">
          <span className="font-mono text-xs font-bold text-electric-blue shrink-0">
            {caseData.caseNumber}
          </span>
          <span className="text-border-strong shrink-0">&mdash;</span>
          <span
            className="text-xs sm:text-sm font-semibold text-text-primary truncate min-w-0"
            title={caseData.title}
          >
            {caseData.title}
          </span>

          <Badge tone="emerald" className="hidden 2xl:inline-flex items-center gap-1 text-[11px] shrink-0">
            <StatusDot tone="verified" className="h-1.5 w-1.5" />
            Active Investigation
          </Badge>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {activeTab !== "graph" && (
          <Button asChild variant="primary" size="sm" className="gap-1.5 text-xs h-8 px-2.5 shadow-xs">
            <Link to={`/cases/${caseData.id}/graph`}>
              <Network className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Investigation Map</span>
            </Link>
          </Button>
        )}

        <Button asChild variant="secondary" size="sm" className="gap-1.5 text-xs h-8 px-2.5">
          <Link to={`/cases/${caseData.id}/reports`}>
            <FileDown className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export Reports</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
