import { useState, useEffect } from "react";
import { AlertCircle, CheckCircle2, ShieldCheck, Send, Info, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfidenceMeter } from "@/components/intelligence/confidence-meter";
import { useAuthStore } from "@/stores/authStore";
import type { HITLTask, HITLTaskDecision, HITLDecisionAction } from "@/types/hitl";
import { cn } from "@/lib/utils";

interface HITLDecisionPaneProps {
  task: HITLTask;
  onRequestDecision: (decision: HITLTaskDecision) => Promise<boolean>;
  isSubmitting?: boolean;
}

export function HITLDecisionPane({
  task,
  onRequestDecision,
  isSubmitting = false,
}: HITLDecisionPaneProps) {
  const { user } = useAuthStore();
  const [justification, setJustification] = useState("");
  const [selectedAction, setSelectedAction] = useState<HITLDecisionAction>("APPROVE_MERGE");
  const [justificationError, setJustificationError] = useState<string | null>(null);

  // Reset form when task changes
  useEffect(() => {
    setJustification("");
    setJustificationError(null);
    setSelectedAction("APPROVE_MERGE");
  }, [task.id]);

  const handlePresetJustification = (text: string) => {
    setJustification((prev) => (prev ? `${prev} ${text}` : text));
    setJustificationError(null);
  };

  const handleSubmit = async () => {
    if (!justification || justification.trim().length < 15) {
      setJustificationError("A comprehensive investigative rationale (min 15 chars) is legally required.");
      return;
    }
    const decision: HITLTaskDecision = {
      action: selectedAction,
      officerName: user?.display_name || "Unknown",
      officerBadge: user?.username || "Unknown",
      justification,
      arbitratedAt: new Date().toISOString(),
    };
    await onRequestDecision(decision);
  };

  const isResolved = task.status === "APPROVED" || task.status === "REJECTED";

  return (
    <div className="flex flex-col h-full bg-background border-l border-border-subtle">
      {/* Header */}
      <div className="flex flex-col border-b border-border-subtle bg-surface-1 p-4 shrink-0">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="space-y-1 min-w-0">
            <h2 className="text-sm font-semibold text-text-primary tracking-tight truncate flex items-center gap-2">
              <span>{task.title}</span>
            </h2>
            <p className="text-micro font-mono text-text-muted truncate uppercase">
              Task ID: {task.id} &bull; Pipeline Phase 4
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <Badge tone={task.flagManualReview ? "amber" : "neutral"} className="text-[10px] font-mono font-semibold uppercase px-1.5 py-0">
            {task.flagManualReview ? "MANDATORY REVIEW" : "OPTIONAL AUDIT"}
          </Badge>
          <Badge tone={task.status === "PENDING" ? "blue" : (task.status === "APPROVED" ? "emerald" : "neutral")} className="text-[10px] font-mono uppercase px-1.5 py-0">
            {task.status.replace("_", " ")}
          </Badge>
          <div className="ml-auto w-32 shrink-0 pt-1">
             <ConfidenceMeter confidence={task.confidence} flagManualReview={false} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <CandidateSignals task={task} />

        {isResolved ? (
          <div className="rounded-lg border border-verified-emerald/30 bg-verified-emerald/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-verified-emerald font-semibold text-sm">
              <CheckCircle2 className="h-4 w-4" />
              <span>Arbitration Completed</span>
            </div>
            <div className="space-y-2 text-sm text-text-secondary">
              <div className="grid grid-cols-[100px_1fr] gap-2">
                <span className="text-text-muted font-mono uppercase text-xs">Decision:</span>
                <span className="font-mono text-text-primary">{task.decision?.action}</span>
              </div>
              <div className="grid grid-cols-[100px_1fr] gap-2">
                <span className="text-text-muted font-mono uppercase text-xs">Officer:</span>
                <span>{task.decision?.officerName} ({task.decision?.officerBadge})</span>
              </div>
              <div className="grid grid-cols-[100px_1fr] gap-2">
                <span className="text-text-muted font-mono uppercase text-xs">Justification:</span>
                <p className="italic">{task.decision?.justification}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-border-strong bg-surface-2 p-4 space-y-5 shadow-sm">
            <div className="space-y-1.5 border-b border-border-subtle pb-4">
              <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                1. Select Supervisory Action
              </h3>
              <p className="text-xs text-text-muted">
                Your decision and reason are recorded in the case audit log (each event HMAC-signed). It can be reversed later.
              </p>
              
              <div className="grid grid-cols-2 gap-2 mt-3 pt-1">
                <Button
                  variant={selectedAction === "APPROVE_MERGE" ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setSelectedAction("APPROVE_MERGE")}
                  className="justify-start text-xs font-mono"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-verified-emerald" />
                  Approve Merge
                </Button>
                <Button
                  variant={selectedAction === "REJECT_MERGE" ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setSelectedAction("REJECT_MERGE")}
                  className="justify-start text-xs font-mono"
                >
                  <XCircle className="h-3.5 w-3.5 mr-1 text-critical-red" />
                  Reject (Distinct)
                </Button>
                <Button
                  variant={selectedAction === "ESCALATE" ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setSelectedAction("ESCALATE")}
                  className="justify-start text-xs font-mono col-span-2"
                >
                  <AlertCircle className="h-3.5 w-3.5 mr-1 text-amber" />
                  Escalate to Supervisory Officer
                </Button>
              </div>
            </div>

            {/* DEF-069: "statutory quick-fills" inserted canned claims of legal process (e.g. "Corroborated under Sec 91
                CrPC notice response from TSP") into the reviewer's reason. Removed: the reason must be the reviewer's own. */}
            <div className="space-y-1.5">
              <label className="text-micro font-mono uppercase tracking-wider text-text-muted flex items-center justify-between">
                <span>Reason for this decision (required, in your own words):</span>
                <span className="text-text-muted">{justification.length} chars</span>
              </label>
              <textarea
                rows={3}
                value={justification}
                onChange={(e) => {
                  setJustification(e.target.value);
                  if (justificationError) setJustificationError(null);
                }}
                placeholder="Enter mandatory statutory justification, investigative rationale, and corroborating evidentiary reference..."
                className="w-full text-xs font-mono bg-surface-1 border border-border-subtle rounded-md p-2.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-electric-blue"
              />
              {justificationError && (
                <p className="text-micro text-critical-red font-mono">{justificationError}</p>
              )}
            </div>

            <div className="flex items-center justify-between p-2.5 rounded bg-surface-1 border border-border-subtle text-micro font-mono">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-electric-blue-soft" />
                <span className="text-text-secondary">Signing Officer:</span>
                <span className="font-semibold text-text-primary">{user?.display_name} ({user?.username})</span>
              </div>
              <span className="text-text-muted">{user?.role}</span>
            </div>

            <Button
              variant="primary"
              size="md"
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="w-full justify-center text-xs font-semibold gap-2 py-2.5 shadow-panel font-mono"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{isSubmitting ? "Recording decision…" : "Record decision"}</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}


/** What the matcher actually found, so a merge is never approved on a confidence number alone (DEF-059). */
function CandidateSignals({ task }: { task: HITLTask }) {
  const s = task.signals;
  if (!s) return null;
  const fmt = (x: any) => (typeof x === "string" ? x : [x.signal || x.attribute || x.kind, x.detail || x.value || x.note].filter(Boolean).join(": ") || JSON.stringify(x));
  return (
    <section className="rounded-lg border border-border-subtle bg-surface-2 p-4 space-y-3 text-xs" aria-label="Why this is a candidate">
      <h3 className="font-semibold text-text-primary uppercase tracking-wider">Why this is a candidate (matcher output)</h3>
      <div>
        <p className="text-text-muted font-mono uppercase text-[10px] mb-1">Supporting signals</p>
        {s.positive.length ? (
          <ul className="space-y-1">
            {s.positive.map((p, i) => (
              <li key={i} className="text-text-secondary">
                <span className="font-mono text-text-primary">{p.signal}</span>{p.detail ? ` — ${p.detail}` : ""}
                {typeof p.weight === "number" ? <span className="text-text-muted"> (weight {p.weight})</span> : null}
                {p.caveat ? <span className="block text-amber-400">Note: {p.caveat}</span> : null}
              </li>
            ))}
          </ul>
        ) : <p className="text-text-muted">None returned.</p>}
      </div>
      <div>
        <p className="text-text-muted font-mono uppercase text-[10px] mb-1">Counter-evidence</p>
        {s.counter.length ? <ul className="space-y-1">{s.counter.map((c, i) => <li key={i} className="text-text-secondary">{fmt(c)}</li>)}</ul> : <p className="text-text-muted">None found.</p>}
      </div>
      <div>
        <p className="text-text-muted font-mono uppercase text-[10px] mb-1">Conflicts</p>
        {s.conflicts.length ? <ul className="space-y-1">{s.conflicts.map((c, i) => <li key={i} className="text-text-secondary">{fmt(c)}</li>)}</ul> : <p className="text-text-muted">None found.</p>}
      </div>
      <div>
        <p className="text-text-muted font-mono uppercase text-[10px] mb-1">Missing information</p>
        {s.missing.length ? (
          <ul className="space-y-1">{s.missing.map((m, i) => <li key={i} className="text-text-secondary">{m.attribute}{m.missing_on?.length ? ` (missing on ${m.missing_on.join(", ")})` : ""}</li>)}</ul>
        ) : <p className="text-text-muted">Nothing reported missing.</p>}
      </div>
      <p className="text-text-muted">A shared identifier or similar name is a candidate relationship, not proof that two records are the same person.</p>
    </section>
  );
}
