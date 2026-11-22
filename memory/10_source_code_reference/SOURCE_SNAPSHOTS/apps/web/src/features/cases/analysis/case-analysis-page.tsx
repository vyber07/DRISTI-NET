import { useEffect, useState } from "react";
import { useCase } from "../case-context";
import {
  GitBranch, Users, AlertTriangle, TrendingUp,
  RefreshCw, Network, Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCaseAnalysis } from "@/services/api/casesApi";

export function CaseAnalysisPage() {
  const { caseId } = useCase();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    if (!caseId) return;
    setIsLoading(true);
    setError("");
    getCaseAnalysis(caseId)
      .then((r) => setData(r.data))
      .catch((e) => setError(e.message || "Failed to load analysis"))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { load(); }, [caseId]);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-background overflow-y-auto">
      <div className="shrink-0 border-b border-border-subtle bg-surface-1 px-4 sm:px-6 py-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-text-primary">Patterns</h2>
          <p className="text-sm text-text-secondary mt-0.5 max-w-3xl">Structural observations from the case graph: well-connected entities, possible bridges between groups, communities and repeated activity. They are review priorities, not findings about any person.</p>
        </div>
        <Button variant="secondary" size="sm" className="gap-1.5" onClick={load} disabled={isLoading}>
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} aria-hidden="true" /> Refresh
        </Button>
      </div>

      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-electric-blue border-t-transparent" />
        </div>
      )}

      {error && (
        <div className="m-5 rounded-lg border border-red-400/30 bg-red-400/5 p-4 text-xs text-red-400 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      {!isLoading && !error && data && (
        <div className="flex-1 p-5 space-y-6 max-w-5xl mx-auto w-full">

          {/* Degree centrality */}
          <section className="rounded-xl border border-border-subtle bg-surface-1 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-text-primary flex items-center gap-2 mb-4">
              <Hash className="h-4 w-4 text-electric-blue" /> Degree Centrality (Top Nodes)
            </h3>
            {(data.degree || []).length === 0 ? (
              <p className="text-xs text-text-muted">No degree data available.</p>
            ) : (
              <div className="space-y-2">
                {(data.degree || []).slice(0, 8).map((n: any) => (
                  <div key={n.entity_id} className="flex items-center gap-3">
                    <span className="text-[10.5px] font-mono text-text-muted w-16 shrink-0">{n.kind}</span>
                    <span className="text-xs text-text-primary flex-1 truncate">{n.label}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="h-2 rounded-full bg-electric-blue/30" style={{ width: `${Math.min((n.degree || 0) * 8, 120)}px` }} />
                      <span className="text-xs font-mono text-text-muted w-8 text-right">{n.degree}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Bridge candidates */}
          <section className="rounded-xl border border-border-subtle bg-surface-1 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-text-primary flex items-center gap-2 mb-4">
              <GitBranch className="h-4 w-4 text-amber-400" /> Bridge Candidates
              <span className="text-[10px] text-text-muted font-normal">— nodes that connect otherwise separate clusters</span>
            </h3>
            {(data.bridge_candidates || []).length === 0 ? (
              <p className="text-xs text-text-muted">No bridge candidates detected.</p>
            ) : (
              <div className="space-y-2">
                {(data.bridge_candidates || []).map((n: any) => (
                  <div key={n.entity_id} className="rounded-md bg-surface-2 border border-border-subtle px-3 py-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge tone="amber" className="text-micro shrink-0">{n.kind}</Badge>
                      <span className="text-xs text-text-primary truncate">{n.label}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-text-muted shrink-0">
                      <span>communities touched: <strong className="text-text-primary">{Array.isArray(n.touches_communities) ? n.touches_communities.length : (n.touches_communities ?? "—")}</strong></span>
                      <span>betweenness: <strong className="text-text-primary">{(n.betweenness || 0).toFixed(3)}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Communities */}
          <section className="rounded-xl border border-border-subtle bg-surface-1 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-text-primary flex items-center gap-2 mb-4">
              <Users className="h-4 w-4 text-purple-400" /> Communities ({(data.communities || []).length})
              <span className="text-[10px] text-text-muted font-normal">— detected by greedy modularity</span>
            </h3>
            {(data.communities || []).length === 0 ? (
              <p className="text-xs text-text-muted">No communities detected.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(data.communities || []).map((comm: any, idx: number) => (
                  <div key={idx} className="rounded-md bg-surface-2 border border-border-subtle p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-text-primary">Community {idx + 1}</span>
                      <span className="text-[10px] text-text-muted">{comm.size ?? (comm.members || []).length} members</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(comm.members || []).slice(0, 5).map((m: any) => (
                        <span key={m.entity_id} className="text-[10px] font-mono bg-surface-1 border border-border-subtle rounded px-1.5 py-0.5 text-text-secondary truncate max-w-[120px]">
                          {m.label}
                        </span>
                      ))}
                      {(comm.members || []).length > 5 && (
                        <span className="text-[10px] text-text-muted">+{(comm.members || []).length - 5} more</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Rule alerts */}
          {(data.rules || []).length > 0 && (
            <section className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-5 shadow-xs">
              <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4" /> Rule Alerts ({(data.rules || []).length})
              </h3>
              <div className="space-y-2">
                {(data.rules || []).map((r: any, idx: number) => (
                  <div key={idx} className="rounded-md bg-surface-1 border border-border-subtle px-3 py-2 text-xs flex items-start gap-2">
                    <TrendingUp className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-text-primary">{r.rule}</span>
                      {r.subject && <span className="text-text-muted"> · {r.subject}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Language note */}
          {data.language_note && (
            <div className="rounded-md bg-surface-2 border border-border-subtle px-4 py-2 text-xs text-text-muted flex items-center gap-2">
              <Network className="h-3.5 w-3.5 shrink-0" />
              <span>{data.language_note}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
