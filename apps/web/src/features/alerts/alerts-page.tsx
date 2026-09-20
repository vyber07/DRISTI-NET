import { useState, useEffect, useTransition } from "react";
import { Link } from "react-router-dom";
import {
  AlertOctagon,
  AlertTriangle,
  Clock,
  ArrowRight,
  CheckCircle2,
  Filter,
  Search,
  Check,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listAlerts, acknowledgeAlert, resolveAlert } from "@/services/api/alertsApi";
import type { AlertItem, AlertFilter, AlertCategory, AlertPriority, AlertStatus } from "@/types/alert";
import { cn } from "@/lib/utils";

export function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<AlertFilter>({
    category: "ALL",
    priority: "ALL",
    status: "ALL",
    searchQuery: "",
  });
  const [, startTransition] = useTransition();

  const loadData = async (f = filter) => {
    setIsLoading(true);
    try {
      const res = await listAlerts(f);
      setAlerts(res.data);
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFilterChange = (patch: Partial<AlertFilter>) => {
    const updated = { ...filter, ...patch };
    setFilter(updated);
    startTransition(() => {
      loadData(updated);
    });
  };

  const handleAcknowledge = async (alertId: string) => {
    await acknowledgeAlert(alertId);
    loadData();
  };

  const handleResolve = async (alertId: string) => {
    await resolveAlert(alertId);
    loadData();
  };

  const activeCount = alerts.filter((a) => a.status === "ACTIVE").length;
  const criticalCount = alerts.filter((a) => a.priority === "CRITICAL" && a.status !== "RESOLVED").length;
  const highCount = alerts.filter((a) => a.priority === "HIGH" && a.status !== "RESOLVED").length;

  const getPriorityTone = (priority: AlertPriority) => {
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

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-background overflow-hidden">
      {/* Top Header */}
      <header className="flex h-14 items-center justify-between border-b border-border-subtle bg-surface-1 px-5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-critical-red/10 border border-critical-red/30 text-critical-red">
            <AlertOctagon className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-text-primary">
                Investigation Alerts &amp; Discrepancies
              </h1>
              <Badge tone="red" className="text-micro font-medium">
                Live Monitoring
              </Badge>
              <Badge tone="neutral" className="text-micro font-medium">
                Case DR-2026-00421
              </Badge>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Automated notifications for conflicting witness claims, new phone matches, and urgent leads
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => loadData()}
          title="Refresh alerts"
          className="h-8 w-8 text-text-muted hover:text-text-primary"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
        </Button>
      </header>

      {/* Stats Ribbon */}
      <div className="flex items-center justify-between px-5 py-2 bg-surface-2 border-b border-border-subtle text-xs shrink-0 overflow-x-auto">
        <div className="flex items-center gap-4">
          <span className="text-text-muted font-medium">Summary:</span>
          <span className="flex items-center gap-1.5 text-critical-red font-semibold">
            <AlertTriangle className="h-3.5 w-3.5" />
            Critical: {criticalCount}
          </span>
          <span className="flex items-center gap-1.5 text-amber font-semibold">
            High Priority: {highCount}
          </span>
          <span className="flex items-center gap-1.5 text-teal-primary font-semibold">
            Active: {activeCount}
          </span>
          <span className="flex items-center gap-1.5 text-text-secondary">
            Total Alerts: {alerts.length}
          </span>
        </div>

        <div className="text-micro text-text-muted">
          <span>Real-time clue matching active</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 max-w-7xl mx-auto w-full space-y-4">
        {/* Filters */}
        <div className="rounded-md border border-border-subtle bg-surface-1 p-3 space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <input
                type="text"
                placeholder="Search alerts by title, trigger reason, entity, or ID..."
                value={filter.searchQuery || ""}
                onChange={(e) => handleFilterChange({ searchQuery: e.target.value })}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-2 border border-border-subtle rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:border-electric-blue font-mono"
              />
            </div>
            <div className="flex items-center gap-2 text-micro font-mono text-text-muted shrink-0">
              <Filter className="h-3.5 w-3.5 text-electric-blue-soft" />
              <span>{alerts.length} alert{alerts.length !== 1 ? "s" : ""}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border-subtle/60 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-micro font-mono uppercase text-text-muted">Category:</span>
              <select
                value={filter.category || "ALL"}
                onChange={(e) => handleFilterChange({ category: e.target.value as AlertCategory | "ALL" })}
                className="bg-surface-2 border border-border-subtle rounded px-2 py-1 text-micro font-mono text-text-primary focus:outline-none focus:border-electric-blue"
              >
                <option value="ALL">All Categories</option>
                <option value="CONTRADICTION">Contradiction</option>
                <option value="HITL">HITL Review</option>
                <option value="TACTICAL">Tactical</option>
                <option value="EVIDENCE">Evidence Health</option>
                <option value="INTEGRITY">Integrity</option>
                <option value="SECURITY">Security</option>
                <option value="SYSTEM">System</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-micro font-mono uppercase text-text-muted">Priority:</span>
              <select
                value={filter.priority || "ALL"}
                onChange={(e) => handleFilterChange({ priority: e.target.value as AlertPriority | "ALL" })}
                className="bg-surface-2 border border-border-subtle rounded px-2 py-1 text-micro font-mono text-text-primary focus:outline-none focus:border-electric-blue"
              >
                <option value="ALL">All Priorities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="INFO">Informational</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-micro font-mono uppercase text-text-muted">Status:</span>
              <select
                value={filter.status || "ALL"}
                onChange={(e) => handleFilterChange({ status: e.target.value as AlertStatus | "ALL" })}
                className="bg-surface-2 border border-border-subtle rounded px-2 py-1 text-micro font-mono text-text-primary focus:outline-none focus:border-electric-blue"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="ACKNOWLEDGED">Acknowledged</option>
                <option value="RESOLVED">Resolved</option>
              </select>
            </div>
          </div>
        </div>

        {/* Alerts List */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-2">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-electric-blue border-t-transparent" />
            <p className="text-xs font-mono text-text-muted">Filtering tactical alerts...</p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="rounded-md border border-dashed border-border-subtle bg-surface-1 p-12 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 text-verified-emerald mx-auto" />
            <h3 className="text-sm font-semibold text-text-primary">No Active Alerts In Category</h3>
            <p className="text-xs text-text-muted max-w-md mx-auto">
              All tactical triggers, evidentiary contradictions, and integrity monitors are operating within nominal thresholds.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  "rounded-md border bg-surface-1 p-4 transition-all duration-150 space-y-3",
                  alert.status === "RESOLVED"
                    ? "border-border-subtle opacity-75"
                    : alert.priority === "CRITICAL"
                      ? "border-critical-red/60 border-l-4 border-l-critical-red bg-critical-red/5"
                      : alert.priority === "HIGH"
                        ? "border-amber/50 border-l-4 border-l-amber bg-amber/5"
                        : "border-border-subtle",
                )}
              >
                {/* Alert Top Bar */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-text-primary">{alert.id}</span>
                    <Badge tone={getPriorityTone(alert.priority)} className="text-micro font-mono">
                      {alert.priority}
                    </Badge>
                    <Badge tone="blue" className="text-micro font-mono">
                      {alert.category}
                    </Badge>
                    <Badge
                      tone={alert.status === "RESOLVED" ? "emerald" : alert.status === "ACKNOWLEDGED" ? "blue" : "neutral"}
                      className="text-micro font-mono"
                    >
                      {alert.status}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1.5 text-micro font-mono text-text-muted">
                    <Clock className="h-3 w-3" />
                    <span>{new Date(alert.timestamp).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</span>
                  </div>
                </div>

                {/* Title and Description */}
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">{alert.title}</h3>
                  <p className="text-xs text-text-secondary leading-relaxed mt-1">{alert.description}</p>
                </div>

                {/* Trigger Reason Box */}
                <div className="rounded bg-surface-2 p-2.5 border border-border-subtle/80 text-xs space-y-1">
                  <div className="flex items-center justify-between text-micro font-mono text-text-muted">
                    <span className="uppercase font-semibold tracking-wider">Trigger Rationale:</span>
                    <span>Case: {alert.caseId}</span>
                  </div>
                  <p className="text-text-primary font-mono text-micro">{alert.triggerReason}</p>
                  {alert.affectedEntityName && (
                    <div className="text-micro text-text-muted pt-1 border-t border-border-subtle/60 flex items-center gap-1.5">
                      <span>Affected Subject:</span>
                      <strong className="text-text-primary">{alert.affectedEntityName}</strong>
                    </div>
                  )}
                </div>

                {/* Action Footer */}
                <div className="flex items-center justify-between pt-1 border-t border-border-subtle/60">
                  <div className="flex items-center gap-2">
                    {alert.status === "ACTIVE" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleAcknowledge(alert.id)}
                        className="h-7 text-xs font-mono gap-1"
                      >
                        <Check className="h-3 w-3" />
                        <span>Acknowledge</span>
                      </Button>
                    )}
                    {alert.status !== "RESOLVED" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleResolve(alert.id)}
                        className="h-7 text-xs font-mono gap-1 text-verified-emerald hover:text-text-primary"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Mark Resolved</span>
                      </Button>
                    )}
                  </div>

                  <Link to={alert.actionPath}>
                    <Button variant="primary" size="sm" className="h-7 text-xs font-mono gap-1.5">
                      <span>{alert.actionLabel}</span>
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
