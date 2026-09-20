import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import {
  ListChecks,
  AlertTriangle,
  GitMerge,
  ArrowLeft,
  Waypoints,
  FileSpreadsheet,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HITLQueueFilters } from "./hitl-queue-filters";
import { HITLTaskCard } from "./hitl-task-card";
import { HITLDecisionPane } from "./hitl-decision-pane";
import { HITLEvidencePane } from "./hitl-evidence-pane";
import { HITLDecisionDialog } from "./hitl-decision-dialog";
import { ProvenanceViewer } from "@/components/evidence/ProvenanceViewer";
import { useHITLStore } from "@/stores/hitlStore";
import type { HITLTaskDecision } from "@/types/hitl";
import { cn } from "@/lib/utils";

export function HITLWorkspacePage() {
  const { taskId } = useParams<{ taskId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const caseIdFilter = searchParams.get("caseId") || undefined;

  const {
    tasks,
    activeTask,
    filter,
    stats,
    isLoading,
    isSubmitting,
    loadTasks,
    loadTaskById,
    selectTask,
    setFilter,
    resetFilter,
    submitDecision,
  } = useHITLStore();

  const [pendingDecision, setPendingDecision] = useState<HITLTaskDecision | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Load tasks on mount or when caseId param changes
  useEffect(() => {
    loadTasks({ caseId: caseIdFilter });
  }, [caseIdFilter, loadTasks]);

  // Sync route taskId with store activeTask
  useEffect(() => {
    if (taskId) {
      loadTaskById(taskId);
    } else {
      selectTask(null);
    }
  }, [taskId, loadTaskById, selectTask]);

  const handleSelectTask = (id: string) => {
    navigate(`/hitl/${id}${caseIdFilter ? `?caseId=${caseIdFilter}` : ""}`);
  };

  const handleBackToQueue = () => {
    navigate(`/hitl${caseIdFilter ? `?caseId=${caseIdFilter}` : ""}`);
  };

  const handleDecisionRequest = async (decision: HITLTaskDecision) => {
    setPendingDecision(decision);
    setIsDialogOpen(true);
    return true;
  };

  const handleConfirmDecision = async () => {
    if (!activeTask || !pendingDecision) return;
    const success = await submitDecision(activeTask.id, pendingDecision);
    if (success) {
      setIsDialogOpen(false);
      setPendingDecision(null);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-background overflow-hidden">
      {/* Top Header Bar */}
      <header className="flex h-14 items-center justify-between border-b border-border-subtle bg-surface-1 px-5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-amber/10 border border-amber/30 text-amber">
            <ListChecks className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-text-primary">
                Human-in-the-Loop (HITL) Review &amp; Evidentiary Arbitration
              </h1>
              <Badge tone="blue" className="text-micro font-mono">
                STAGE 4 VALIDATION
              </Badge>
              <Badge tone="red" className="text-micro font-mono">
                CONFIDENTIAL // LEA SENSITIVE
              </Badge>
            </div>
            <p className="text-micro font-mono text-text-muted mt-0.5">
              Arbitration Band: 0.60–0.95 Confidence &bull; Ground Truth Admissibility Verification &bull; Case:{" "}
              {caseIdFilter || "DR-2026-00421"}
            </p>
          </div>
        </div>

        {/* Action & Status Strip */}
        <div className="flex items-center gap-2">
          {activeTask ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleBackToQueue}
              className="text-xs font-mono gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Queue</span>
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/cases/DR-2026-00421/graph">
                <Button variant="ghost" size="sm" className="text-xs font-mono gap-1 text-text-secondary">
                  <Waypoints className="h-3.5 w-3.5 text-electric-blue-soft" />
                  <span>Graph View</span>
                </Button>
              </Link>
              <Link to="/cases/DR-2026-00421">
                <Button variant="ghost" size="sm" className="text-xs font-mono gap-1 text-text-secondary">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-verified-emerald" />
                  <span>Case Overview</span>
                </Button>
              </Link>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => loadTasks()}
            title="Refresh tasks"
            className="h-8 w-8 text-text-muted hover:text-text-primary"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          </Button>
        </div>
      </header>

      {/* Stats Ribbon */}
      <div className="flex items-center justify-between px-5 py-2 bg-surface-2 border-b border-border-subtle text-xs font-mono shrink-0 overflow-x-auto">
        <div className="flex items-center gap-4">
          <span className="text-text-muted">Queue Status:</span>
          <span className="flex items-center gap-1.5 text-text-primary">
            <span className="h-2 w-2 rounded-full bg-electric-blue" />
            Total: <strong>{stats?.totalTasks ?? tasks.length}</strong>
          </span>
          <span className="flex items-center gap-1.5 text-amber">
            <span className="h-2 w-2 rounded-full bg-amber" />
            Pending: <strong>{stats?.pendingCount ?? 0}</strong>
          </span>
          <span className="flex items-center gap-1.5 text-critical-red">
            <AlertTriangle className="h-3 w-3" />
            Critical Contradictions: <strong>{stats?.criticalCount ?? 0}</strong>
          </span>
          <span className="flex items-center gap-1.5 text-electric-blue-soft">
            <GitMerge className="h-3 w-3" />
            Identity Merges: <strong>{stats?.identityMergesCount ?? 0}</strong>
          </span>
          <span className="flex items-center gap-1.5 text-verified-emerald">
            <CheckCircle2 className="h-3 w-3" />
            Resolved: <strong>{stats?.resolvedCount ?? 0}</strong>
          </span>
        </div>

        <div className="text-micro text-text-muted">
          <span>Target SLA: &lt; 24h &bull; Statutory Authority: CrPC / IEA</span>
        </div>
      </div>

      {/* Main Workspace Area: Either Queue List or Two-Pane Review */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTask ? (
          /* Two-Pane Review Workspace (§17 & §18) */
          <div className="grid grid-cols-1 lg:grid-cols-2 h-full min-h-0">
            {/* Left Pane: Proposed Match / Contradiction & Decision */}
            <div className="h-full min-h-0 overflow-hidden">
              <HITLDecisionPane
                task={activeTask}
                onSubmitDecision={handleDecisionRequest}
                isSubmitting={isSubmitting}
              />
            </div>

            {/* Right Pane: Supporting Evidence & Provenance Viewer */}
            <div className="h-full min-h-0 overflow-hidden">
              <HITLEvidencePane task={activeTask} />
            </div>
          </div>
        ) : (
          /* Full Queue List View */
          <div className="flex flex-col h-full max-w-7xl mx-auto p-4 space-y-4 overflow-y-auto">
            <HITLQueueFilters
              filter={filter}
              onFilterChange={setFilter}
              onReset={resetFilter}
              totalResults={tasks.length}
            />

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-2">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-electric-blue border-t-transparent" />
                <p className="text-xs font-mono text-text-muted">Loading arbitration queue...</p>
              </div>
            ) : tasks.length === 0 ? (
              <div className="rounded-md border border-dashed border-border-subtle bg-surface-1 p-12 text-center space-y-3">
                <CheckCircle2 className="h-10 w-10 text-verified-emerald mx-auto" />
                <h3 className="text-sm font-semibold text-text-primary">Arbitration Queue Clear</h3>
                <p className="text-xs text-text-muted max-w-md mx-auto">
                  No pending entity merges, spatio-temporal contradictions, or tier elevation requests match your active filter criteria.
                </p>
                <Button variant="secondary" size="sm" onClick={resetFilter} className="text-xs font-mono">
                  Reset Filters
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {tasks.map((task) => (
                  <HITLTaskCard
                    key={task.id}
                    task={task}
                    onSelect={handleSelectTask}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {activeTask && (
        <HITLDecisionDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          onConfirm={handleConfirmDecision}
          task={activeTask}
          decision={pendingDecision}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Global Provenance Viewer Modal (available when clicking Full Inspector) */}
      <ProvenanceViewer />
    </div>
  );
}
