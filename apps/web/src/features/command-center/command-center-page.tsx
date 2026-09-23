import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Compass,
  FolderOpen,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";
import { listCases } from "@/services/api/casesApi";
import type { CaseSummary } from "@/types/case";

export function CommandCenterPage() {
  const { user } = useAuthStore();
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    listCases()
      .then((res) => {
        if (mounted && res.data) {
          setCases(res.data);
        }
      })
      .catch((e) => console.error("Failed to load cases", e))
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="flex flex-col h-full flex-1 min-h-0 min-w-0 overflow-y-auto bg-background">
      <header className="flex h-14 items-center justify-between border-b border-border-subtle bg-surface-1 px-6 shrink-0 select-none">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-electric-blue/10 text-electric-blue">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-text-primary">
              DRISTI-NET Dashboard
            </h1>
            <p className="text-[11px] text-text-muted">
              Welcome back, {user?.display_name || "Investigator"}
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 p-6 space-y-6 max-w-5xl mx-auto w-full">
        <section className="rounded-xl border border-border-subtle bg-surface-1 p-5 space-y-4 shadow-sm">
          <h2 className="text-sm font-bold text-text-primary border-b border-border-subtle pb-2">
            Your Active Cases
          </h2>
          
          {isLoading ? (
            <p className="text-xs text-text-muted py-4">Loading active cases...</p>
          ) : cases.length === 0 ? (
            <p className="text-xs text-text-muted py-4">No cases found.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cases.slice(0, 4).map((c) => (
                <div key={c.id} className="rounded-lg border border-border-subtle bg-surface-2 p-4 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="font-mono text-xs font-semibold text-text-primary block">{c.id}</span>
                      <span className="text-xs text-text-secondary mt-0.5 line-clamp-1">{c.title}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 pt-2 border-t border-border-subtle">
                    <Link to={`/cases/${c.id}`} className="flex-1">
                      <Button variant="secondary" size="sm" className="w-full text-xs gap-1.5 h-8">
                        <FolderOpen className="h-3.5 w-3.5" />
                        <span>Open Workspace</span>
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2">
            <Link to="/cases">
              <Button variant="ghost" size="sm" className="text-xs text-electric-blue gap-1">
                <span>View all cases in directory</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
