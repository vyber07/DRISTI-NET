import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Compass, FolderOpen, ArrowRight, FileStack,
  CheckCircle2, Clock, GitMerge, ShieldCheck, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";
import { listCases } from "@/services/api/casesApi";
import type { CaseSummary } from "@/types/case";

interface DashStats {
  totalCases: number;
  totalEvidence: number;
  pendingReviews: number;
  contradictions: number;
}

export function CommandCenterPage() {
  const { user } = useAuthStore();
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DashStats>({ totalCases: 0, totalEvidence: 0, pendingReviews: 0, contradictions: 0 });

  useEffect(() => {
    let mounted = true;
    listCases()
      .then((res) => {
        if (mounted && res.data) {
          const all = res.data;
          setCases(all);
          setStats({
            totalCases: all.length,
            totalEvidence: all.reduce((s, c) => s + (c.evidence_count || 0), 0),
            pendingReviews: all.reduce((s, c) => s + (c.pending_reviews || 0), 0),
            contradictions: 0,
          });
        }
      })
      .catch((e) => console.error("Failed to load cases", e))
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, []);

  const STAT_CARDS = [
    { label: "Total Cases", value: stats.totalCases, icon: FolderOpen, color: "text-electric-blue", bg: "bg-electric-blue/10" },
    { label: "Evidence Items", value: stats.totalEvidence, icon: FileStack, color: "text-emerald-400", bg: "bg-emerald-400/10" },
    { label: "Pending Reviews", value: stats.pendingReviews, icon: Clock, color: "text-amber-400", bg: "bg-amber-400/10" },
    // DEF-077: a "Contradictions: 0" card was hard-coded (the case list carries no contradiction count); removed.
  ];

  return (
    <div className="flex flex-col h-full flex-1 min-h-0 min-w-0 overflow-y-auto bg-background">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b border-border-subtle bg-surface-1 px-6 shrink-0 select-none">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-electric-blue/10 text-electric-blue">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-text-primary">DRISTI-NET Dashboard</h1>
            <p className="text-[11px] text-text-muted">Welcome back, {user?.display_name || "Investigator"} · {user?.role}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-xs text-emerald-400 font-mono font-semibold">SYSTEM ONLINE</span>
        </div>
      </header>

      <div className="flex-1 p-5 space-y-6 max-w-6xl mx-auto w-full">

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STAT_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="rounded-xl border border-border-subtle bg-surface-1 p-4 flex items-center gap-3 shadow-sm">
                <div className={`h-10 w-10 rounded-lg ${card.bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold font-mono text-text-primary leading-none">
                    {isLoading ? "—" : card.value}
                  </p>
                  <p className="text-[11px] text-text-muted mt-0.5 truncate">{card.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Access */}
        <div className="rounded-xl border border-border-subtle bg-surface-1 p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-electric-blue" />
              Active Investigations
            </h2>
            <span className="text-xs text-text-muted font-mono">
              {cases.length} assigned
            </span>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 rounded-lg bg-surface-2 border border-border-subtle animate-pulse" />
              ))}
            </div>
          ) : cases.length === 0 ? (
            <p className="text-xs text-text-muted py-4">No cases assigned to your account.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {cases.slice(0, 6).map((c) => (
                <div key={c.id} className="rounded-lg border border-border-subtle bg-surface-2 p-4 space-y-3 hover:border-border-strong transition-colors">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <span className="font-mono text-xs font-bold text-text-primary block">{c.id}</span>
                      <span className="text-xs text-text-secondary mt-0.5 line-clamp-1">{c.title}</span>
                      <span className="text-[10px] text-text-muted font-mono">{c.jurisdiction}</span>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <div className="flex items-center gap-1 text-[10px] text-text-muted">
                        <FileStack className="h-3 w-3" />
                        <span>{c.evidence_count} evidence</span>
                      </div>
                      {c.pending_reviews > 0 && (
                        <div className="flex items-center gap-1 text-[10px] text-amber-400">
                          <Clock className="h-3 w-3" />
                          <span>{c.pending_reviews} pending</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t border-border-subtle">
                    <Link to={`/cases/${c.id}`} className="flex-1">
                      <Button variant="secondary" size="sm" className="w-full text-xs gap-1.5 h-7">
                        <FolderOpen className="h-3 w-3" />
                        Open Workspace
                      </Button>
                    </Link>
                    <Link to={`/cases/${c.id}/graph`}>
                      <Button variant="ghost" size="sm" className="text-xs h-7 px-2 text-electric-blue">
                        Graph
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {cases.length > 6 && (
            <div className="pt-1">
              <Link to="/cases">
                <Button variant="ghost" size="sm" className="text-xs text-electric-blue gap-1">
                  <span>View all {cases.length} cases in directory</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Role Quick Links */}
        <div className="rounded-xl border border-border-subtle bg-surface-1 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-text-primary mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-electric-blue" />
            Quick Actions for {user?.role}
          </h2>
          <div className="flex flex-wrap gap-2">
            <Link to="/cases">
              <Button variant="secondary" size="sm" className="text-xs gap-1.5">
                <FileStack className="h-3.5 w-3.5" /> Case Directory
              </Button>
            </Link>
            {(user?.role === "REVIEWER" || user?.role === "INVESTIGATOR" || user?.role === "ADMIN") && (
              <Link to={cases[0] ? `/cases/${cases[0].id}/hitl` : "/cases"}>
                <Button variant="secondary" size="sm" className="text-xs gap-1.5">
                  <GitMerge className="h-3.5 w-3.5" /> Review Queue
                </Button>
              </Link>
            )}
            {(user?.role === "AUDITOR" || user?.role === "ADMIN") && (
              <Link to="/audit">
                <Button variant="secondary" size="sm" className="text-xs gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Global Audit
                </Button>
              </Link>
            )}
            <Link to="/profile">
              <Button variant="secondary" size="sm" className="text-xs gap-1.5">
                <Compass className="h-3.5 w-3.5" /> My Profile
              </Button>
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
