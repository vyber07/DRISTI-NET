import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock, FileWarning, Search, ShieldAlert, Waypoints } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CaseSummary } from "@/types/case";
import { listCases } from "@/services/api/casesApi";

export function CasesDirectoryPage() {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let mounted = true;
    listCases()
      .then((res) => {
        if (mounted && res.data) setCases(res.data);
      })
      .catch((e) => console.error("Failed to load cases", e))
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const filteredCases = cases.filter((c) => {
    const term = searchQuery.toLowerCase();
    return (
      c.id.toLowerCase().includes(term) ||
      c.title.toLowerCase().includes(term) ||
      c.purpose.toLowerCase().includes(term) ||
      c.jurisdiction.toLowerCase().includes(term) ||
      c.authority_reference.toLowerCase().includes(term)
    );
  });

  return (
    <div className="flex h-full flex-col bg-bg-base">
      <div className="flex shrink-0 items-center justify-between border-b border-border-subtle bg-surface-1 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <FileWarning className="h-4 w-4 text-electric-blue-soft" />
          <h2 className="text-sm font-bold font-mono tracking-wide uppercase text-text-primary">
            Active Investigations Directory
          </h2>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-text-muted font-medium text-xs">Portfolio Status:</span>
          <span className="text-text-primary font-semibold text-xs">Total Cases: {cases.length}</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 max-w-7xl mx-auto w-full space-y-4">
        <div className="flex items-center gap-3 rounded-md border border-border-subtle bg-surface-1 p-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search cases by number, title, narrative, or jurisdiction..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-2 border border-border-subtle rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:border-electric-blue font-mono"
            />
          </div>
        </div>

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
                  "rounded-lg border bg-surface-1 p-5 space-y-4 transition-all duration-150 hover:border-border-strong border-border-subtle"
                )}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-semibold text-text-primary">{c.id}</span>
                    <Badge tone="blue" className="text-micro font-mono">
                      {c.classification}
                    </Badge>
                    <span className="text-micro font-mono text-text-muted">&bull;</span>
                    <span className="text-micro font-mono text-text-secondary">{c.jurisdiction}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-micro font-mono text-text-muted">
                    <Clock className="h-3 w-3" />
                    <span>Opened: {new Date(c.opened_at).toLocaleDateString("en-IN")}</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-text-primary">{c.title}</h3>
                  <p className="text-xs text-text-secondary leading-relaxed mt-1">{c.purpose}</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 gap-2 p-3 bg-surface-2 rounded-md border border-border-subtle text-center text-xs font-mono">
                  <div className="space-y-0.5">
                    <span className="text-micro text-text-muted uppercase">Evidence Docs</span>
                    <p className="font-semibold text-text-primary">{c.evidence_count}</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-micro text-text-muted uppercase">Pending Reviews</span>
                    <p className="font-semibold text-text-primary">{c.pending_reviews}</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-micro text-text-muted uppercase">Assigned Users</span>
                    <p className="font-semibold text-text-primary">{c.assigned.length}</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-micro text-text-muted uppercase">Authority Ref</span>
                    <p className="font-semibold text-text-primary truncate" title={c.authority_reference}>{c.authority_reference}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border-subtle/80 flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-micro font-mono text-text-muted">
                    <ShieldAlert className="h-3.5 w-3.5 text-electric-blue-soft" />
                    <span>Owner: <strong>{c.owner_id}</strong></span>
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
