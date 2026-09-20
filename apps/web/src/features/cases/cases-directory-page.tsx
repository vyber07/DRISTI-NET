import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FileStack,
  Clock,
  ArrowRight,
  Search,
  Waypoints,
  UserCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listCases } from "@/services/api/casesApi";
import type { CaseSummary } from "@/types/case";
import { cn } from "@/lib/utils";

export function CasesDirectoryPage() {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const res = await listCases();
        setCases(res.data);
      } catch {
        // Fallback
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const filteredCases = cases.filter((c) => {
    if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      return (
        c.caseNumber.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.jurisdiction.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getPriorityTone = (priority: CaseSummary["priority"]) => {
    switch (priority) {
      case "CRITICAL":
        return "red" as const;
      case "HIGH":
        return "amber" as const;
      case "MEDIUM":
        return "blue" as const;
      default:
        return "neutral" as const;
    }
  };

  const getStatusTone = (status: CaseSummary["status"]) => {
    switch (status) {
      case "ACTIVE":
        return "emerald" as const;
      case "UNDER_REVIEW":
        return "amber" as const;
      case "CLOSED":
        return "neutral" as const;
      default:
        return "blue" as const;
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-background overflow-hidden">
      {/* Top Header */}
      <header className="flex h-14 items-center justify-between border-b border-border-subtle bg-surface-1 px-5 shrink-0 select-none">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-electric-blue/10 text-electric-blue">
            <FileStack className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-text-primary">
                Case Directory &bull; Active Investigations
              </h1>
              <Badge tone="blue" className="text-[10.5px]">
                {cases.length} REGISTERED
              </Badge>
            </div>
            <p className="text-[11px] text-text-muted">
              Select a case to explore the connected clues, investigation map, and source evidence
            </p>
          </div>
        </div>

        <Link to="/cases/DR-2026-00421">
          <Button variant="primary" size="sm" className="text-xs gap-1.5 shadow-xs">
            <span>Open Demo Case (DR-2026-00421)</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </header>

      {/* Stats Ribbon */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-surface-2 border-b border-border-subtle text-xs shrink-0 overflow-x-auto select-none">
        <div className="flex items-center gap-4">
          <span className="text-text-muted font-medium">Portfolio Status:</span>
          <span className="text-text-primary font-semibold">Total Cases: {cases.length}</span>
          <span className="text-verified-emerald font-semibold">Active: {cases.filter((c) => c.status === "ACTIVE").length}</span>
          <span className="text-amber font-semibold">Under Review: {cases.filter((c) => c.status === "UNDER_REVIEW").length}</span>
        </div>

        <div className="text-xs text-text-muted">
          <span>Jurisdiction: Rajasthan &bull; All Identifiers Masked</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 max-w-7xl mx-auto w-full space-y-4">
        {/* Search & Filter Strip */}
        <div className="flex items-center gap-3 rounded-md border border-border-subtle bg-surface-1 p-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search cases by number, title, syndicate description, or district..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-2 border border-border-subtle rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:border-electric-blue font-mono"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span className="text-micro text-text-muted uppercase">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-surface-2 border border-border-subtle rounded px-2 py-1 text-micro text-text-primary focus:outline-none focus:border-electric-blue"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
        </div>

        {/* Case Cards Grid */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-2">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-electric-blue border-t-transparent" />
            <p className="text-xs font-mono text-text-muted">Loading case directory...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredCases.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "rounded-lg border bg-surface-1 p-5 space-y-4 transition-all duration-150 hover:border-border-strong",
                  c.priority === "CRITICAL"
                    ? "border-electric-blue/40 ring-1 ring-electric-blue/20 bg-gradient-to-r from-electric-blue/5 via-surface-1 to-surface-1"
                    : "border-border-subtle",
                )}
              >
                {/* Card Header */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-semibold text-text-primary">{c.caseNumber}</span>
                    <Badge tone={getPriorityTone(c.priority)} className="text-micro font-mono">
                      {c.priority}
                    </Badge>
                    <Badge tone={getStatusTone(c.status)} className="text-micro font-mono">
                      {c.status.replace(/_/g, " ")}
                    </Badge>
                    <span className="text-micro font-mono text-text-muted">&bull;</span>
                    <span className="text-micro font-mono text-text-secondary">{c.jurisdiction}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-micro font-mono text-text-muted">
                    <Clock className="h-3 w-3" />
                    <span>Updated: {new Date(c.lastUpdated).toLocaleDateString("en-IN")}</span>
                  </div>
                </div>

                {/* Title & Description */}
                <div>
                  <h3 className="text-base font-semibold text-text-primary">{c.title}</h3>
                  <p className="text-xs text-text-secondary leading-relaxed mt-1">{c.description}</p>
                </div>

                {/* Metrics Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 p-3 bg-surface-2 rounded-md border border-border-subtle text-center text-xs font-mono">
                  <div className="space-y-0.5">
                    <span className="text-micro text-text-muted uppercase">Entities</span>
                    <p className="font-semibold text-text-primary">{c.stats.totalEntities}</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-micro text-text-muted uppercase">Relationships</span>
                    <p className="font-semibold text-text-primary">{c.stats.totalRelationships}</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-micro text-text-muted uppercase">Evidence Docs</span>
                    <p className="font-semibold text-text-primary">{c.stats.totalEvidence}</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-micro text-text-muted uppercase">Contradictions</span>
                    <p className={cn("font-semibold", c.stats.contradictionsCount > 0 ? "text-critical-red" : "text-text-muted")}>
                      {c.stats.contradictionsCount}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-micro text-text-muted uppercase">Highest Tier</span>
                    <p className="font-semibold text-electric-blue-soft">Tier {c.stats.highestTier}</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-micro text-text-muted uppercase">Analyst Notes</span>
                    <p className="font-semibold text-text-primary">{c.stats.notesCount}</p>
                  </div>
                </div>

                {/* Card Action Strip */}
                <div className="flex items-center justify-between pt-2 border-t border-border-subtle/80 flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-micro font-mono text-text-muted">
                    <UserCheck className="h-3.5 w-3.5 text-electric-blue-soft" />
                    <span>Lead IO: <strong>{c.leadInvestigator.name}</strong> ({c.leadInvestigator.badgeNumber})</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link to={`/cases/${c.id}/graph`}>
                      <Button variant="ghost" size="sm" className="h-8 text-xs font-mono gap-1 text-text-secondary">
                        <Waypoints className="h-3.5 w-3.5 text-electric-blue-soft" />
                        <span>Graph</span>
                      </Button>
                    </Link>
                    <Link to={`/cases/${c.id}`}>
                      <Button variant="primary" size="sm" className="h-8 text-xs font-mono gap-1.5 shadow-panel">
                        <span>Open Case Workspace</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
