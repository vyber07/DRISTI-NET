import { useState } from "react";
import {
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  FileText,
  UserCheck,
  ChevronRight,
  Send,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EvidenceTierBadge } from "@/components/intelligence/evidence-tier-badge";
import { ConfidenceMeter } from "@/components/intelligence/confidence-meter";
import { maskPhoneNumbersInText } from "@/lib/pii";
import { useAuthStore } from "@/stores/authStore";
import type {
  HITLTask,
  HITLDecisionAction,
  HITLTaskDecision,
} from "@/types/hitl";
import { cn } from "@/lib/utils";

interface HITLDecisionPaneProps {
  task: HITLTask;
  onSubmitDecision: (decision: HITLTaskDecision) => Promise<boolean>;
  isSubmitting?: boolean;
}

export function HITLDecisionPane({
  task,
  onSubmitDecision,
  isSubmitting = false,
}: HITLDecisionPaneProps) {
  const { fullName, badgeNumber, roleLabel } = useAuthStore();

  const [selectedAction, setSelectedAction] = useState<HITLDecisionAction>(() => {
    if (task.type === "CONTRADICTION_RESOLUTION") return "ACCEPT_CLAIM_A";
    if (task.type === "ENTITY_MERGE") return "APPROVE_MERGE";
    if (task.type === "TIER_ELEVATION") return "ARBITRATE";
    return "ARBITRATE";
  });

  const [justification, setJustification] = useState("");
  const [justificationError, setJustificationError] = useState<string | null>(null);

  const isResolved = task.status === "APPROVED" || task.status === "REJECTED";

  const handlePresetJustification = (preset: string) => {
    setJustification((prev) => (prev ? `${prev} ${preset}` : preset));
    setJustificationError(null);
  };

  const handleSubmit = async () => {
    if (!justification.trim() || justification.trim().length < 15) {
      setJustificationError("Mandatory: Provide at least 15 characters of statutory/investigative justification.");
      return;
    }
    setJustificationError(null);

    const decision: HITLTaskDecision = {
      action: selectedAction,
      officerName: fullName,
      officerBadge: badgeNumber,
      justification: justification.trim(),
      arbitratedAt: new Date().toISOString(),
      newTier: task.type === "TIER_ELEVATION" ? 5 : undefined,
    };

    await onSubmitDecision(decision);
  };

  return (
    <div className="flex flex-col h-full bg-surface-1 border-r border-border-subtle overflow-y-auto">
      {/* Task Header Bar */}
      <div className="p-4 border-b border-border-subtle bg-surface-2/40 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-text-primary">
              {task.id}
            </span>
            <Badge tone="blue" className="text-micro font-mono">
              {task.type.replace(/_/g, " ")}
            </Badge>
            <Badge
              tone={task.priority === "CRITICAL" ? "red" : task.priority === "HIGH" ? "amber" : "neutral"}
              className="text-micro font-mono"
            >
              {task.priority}
            </Badge>
          </div>

          <div className="flex items-center gap-1.5 text-micro font-mono text-text-muted">
            <Clock className="h-3 w-3" />
            <span>SLA: {new Date(task.slaDeadline).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</span>
          </div>
        </div>

        <h2 className="text-base font-semibold text-text-primary">
          {maskPhoneNumbersInText(task.title)}
        </h2>
        <p className="text-xs text-text-secondary leading-relaxed">
          {maskPhoneNumbersInText(task.description)}
        </p>
      </div>

      {/* Task Comparison Workspace Body */}
      <div className="p-4 space-y-5 flex-1">
        {/* SCENARIO 1: CONTRADICTION RESOLUTION */}
        {task.type === "CONTRADICTION_RESOLUTION" && task.contradictionData && (
          <div className="space-y-4">
            {/* Warning Banner */}
            <div className="rounded-md border border-critical-red/50 bg-critical-red/10 p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-critical-red font-semibold text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="uppercase tracking-wide">
                  {task.contradictionType === "SPATIAL_TEMPORAL"
                    ? "Spatio-Temporal Contradiction Detected"
                    : "Evidentiary Discrepancy Flagged"}
                </span>
              </div>
              <p className="text-xs text-text-primary leading-relaxed">
                {task.contradictionData.deltaExplanation}
              </p>
              {task.contradictionData.spatialDeltaKm !== undefined && (
                <div className="flex items-center gap-4 text-micro font-mono text-text-secondary pt-1 border-t border-critical-red/20">
                  <span>Spatial Delta: <strong>{task.contradictionData.spatialDeltaKm} km</strong></span>
                  <span>Temporal Delta: <strong>{task.contradictionData.temporalDeltaMinutes} min</strong></span>
                  <span className="text-critical-red">Physical Impossibility: &gt; 3,000 km/h</span>
                </div>
              )}
            </div>

            {/* Conflicting Claims Side-by-Side Comparison */}
            <div className="space-y-2">
              <span className="text-micro font-mono uppercase tracking-wider text-text-muted">
                Evidentiary Claims in Conflict
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Claim A */}
                <div
                  onClick={() => !isResolved && setSelectedAction("ACCEPT_CLAIM_A")}
                  className={cn(
                    "rounded-md border p-3 space-y-2 cursor-pointer transition-all",
                    selectedAction === "ACCEPT_CLAIM_A" && !isResolved
                      ? "border-electric-blue bg-electric-blue/10 ring-1 ring-electric-blue"
                      : "border-border-subtle bg-surface-2 hover:border-border-strong",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-micro font-mono font-semibold text-electric-blue-soft">
                      CLAIM A (Primary Telecom)
                    </span>
                    <span className="font-mono text-micro text-text-muted">
                      Conf: {Math.round(task.contradictionData.claimA.confidence * 100)}%
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-text-primary">
                    {task.contradictionData.claimA.title}
                  </h4>
                  <p className="text-micro text-text-secondary leading-relaxed bg-surface-1 p-2 rounded border border-border-subtle/70">
                    "{maskPhoneNumbersInText(task.contradictionData.claimA.snippet)}"
                  </p>
                  <div className="space-y-1 text-micro font-mono text-text-muted pt-1">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-amber shrink-0" />
                      <span className="truncate">{task.contradictionData.claimA.location}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-electric-blue-soft shrink-0" />
                      <span>{new Date(task.contradictionData.claimA.timestamp).toLocaleTimeString("en-IN")} IST</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText className="h-3 w-3 shrink-0" />
                      <span>{task.contradictionData.claimA.agency}</span>
                    </div>
                  </div>
                </div>

                {/* Claim B */}
                <div
                  onClick={() => !isResolved && setSelectedAction("ACCEPT_CLAIM_B")}
                  className={cn(
                    "rounded-md border p-3 space-y-2 cursor-pointer transition-all",
                    selectedAction === "ACCEPT_CLAIM_B" && !isResolved
                      ? "border-electric-blue bg-electric-blue/10 ring-1 ring-electric-blue"
                      : "border-border-subtle bg-surface-2 hover:border-border-strong",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-micro font-mono font-semibold text-verified-emerald">
                      CLAIM B (Highway ANPR)
                    </span>
                    <span className="font-mono text-micro text-text-muted">
                      Conf: {Math.round(task.contradictionData.claimB.confidence * 100)}%
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-text-primary">
                    {task.contradictionData.claimB.title}
                  </h4>
                  <p className="text-micro text-text-secondary leading-relaxed bg-surface-1 p-2 rounded border border-border-subtle/70">
                    "{maskPhoneNumbersInText(task.contradictionData.claimB.snippet)}"
                  </p>
                  <div className="space-y-1 text-micro font-mono text-text-muted pt-1">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-amber shrink-0" />
                      <span className="truncate">{task.contradictionData.claimB.location}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-verified-emerald shrink-0" />
                      <span>{new Date(task.contradictionData.claimB.timestamp).toLocaleTimeString("en-IN")} IST</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText className="h-3 w-3 shrink-0" />
                      <span>{task.contradictionData.claimB.agency}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SCENARIO 2: ENTITY MERGE */}
        {task.type === "ENTITY_MERGE" && task.proposedMatch && (
          <div className="space-y-4">
            {/* Similarity Score Strip */}
            <div className="rounded-md border border-border-subtle bg-surface-2 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-micro font-mono uppercase tracking-wider text-text-muted">
                  Candidate Identity Match Similarity
                </span>
                <span className="text-sm font-semibold text-electric-blue-soft font-mono">
                  {Math.round(task.proposedMatch.similarityScore * 100)}%
                </span>
              </div>
              <ConfidenceMeter
                confidence={task.proposedMatch.similarityScore}
                flagManualReview
              />
              <p className="text-xs text-text-secondary pt-1">
                {task.proposedMatch.candidateReason}
              </p>
            </div>

            {/* Entity A vs Entity B Side-by-Side Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Entity A */}
              <div className="rounded-md border border-border-subtle bg-surface-2 p-3 space-y-2">
                <div className="flex items-center justify-between border-b border-border-subtle pb-1.5">
                  <span className="text-micro font-mono font-semibold text-text-muted">
                    PRIMARY PROFILE (A)
                  </span>
                  <span className="font-mono text-micro text-text-secondary">
                    {task.proposedMatch.entityA.id}
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-text-primary">
                  {maskPhoneNumbersInText(task.proposedMatch.entityA.name)}
                </h4>
                <div className="space-y-1.5 text-xs">
                  {Object.entries(task.proposedMatch.entityA.attributes).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between text-micro">
                      <span className="text-text-muted">{k}:</span>
                      <span className="font-mono text-text-primary">
                        {maskPhoneNumbersInText(v)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Entity B */}
              <div className="rounded-md border border-border-subtle bg-surface-2 p-3 space-y-2">
                <div className="flex items-center justify-between border-b border-border-subtle pb-1.5">
                  <span className="text-micro font-mono font-semibold text-electric-blue-soft">
                    CANDIDATE ALIAS (B)
                  </span>
                  <span className="font-mono text-micro text-text-secondary">
                    {task.proposedMatch.entityB.id}
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-text-primary">
                  {maskPhoneNumbersInText(task.proposedMatch.entityB.name)}
                </h4>
                <div className="space-y-1.5 text-xs">
                  {Object.entries(task.proposedMatch.entityB.attributes).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between text-micro">
                      <span className="text-text-muted">{k}:</span>
                      <span className="font-mono text-text-primary">
                        {maskPhoneNumbersInText(v)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Similarity Metrics Breakdown */}
            <div className="space-y-1.5">
              <span className="text-micro font-mono uppercase tracking-wider text-text-muted">
                Similarity Metrics Decomposition
              </span>
              <div className="divide-y divide-border-subtle rounded border border-border-subtle bg-surface-2 text-xs">
                {task.proposedMatch.similarityMetrics.map((m) => (
                  <div key={m.metric} className="p-2.5 flex items-center justify-between gap-3">
                    <div>
                      <span className="font-medium text-text-primary block">{m.metric}</span>
                      <span className="text-micro font-mono text-text-muted">{m.method}</span>
                      {m.notes && <p className="text-micro text-text-secondary mt-0.5">{m.notes}</p>}
                    </div>
                    <span className="font-mono font-semibold text-electric-blue-soft shrink-0">
                      {Math.round(m.score * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SCENARIO 3: TIER ELEVATION */}
        {task.type === "TIER_ELEVATION" && task.proposedTierElevation && (
          <div className="space-y-4">
            <div className="rounded-md border border-border-subtle bg-surface-2 p-4 space-y-3">
              <span className="text-micro font-mono uppercase tracking-wider text-text-muted">
                Proposed Evidence Tier Transition
              </span>
              <div className="flex items-center justify-around p-3 bg-surface-1 rounded border border-border-subtle">
                <div className="text-center space-y-1">
                  <span className="text-micro text-text-muted uppercase">Current Tier</span>
                  <div>
                    <EvidenceTierBadge tier={task.proposedTierElevation.currentTier} />
                  </div>
                </div>

                <ChevronRight className="h-5 w-5 text-text-muted" />

                <div className="text-center space-y-1">
                  <span className="text-micro text-verified-emerald font-semibold uppercase">Proposed Target</span>
                  <div>
                    <EvidenceTierBadge tier={task.proposedTierElevation.proposedTier} />
                  </div>
                </div>
              </div>

              <div className="space-y-1 text-xs">
                <span className="text-text-muted font-medium">Elevation Rationale:</span>
                <p className="text-text-secondary leading-relaxed bg-surface-1 p-2.5 rounded border border-border-subtle">
                  {task.proposedTierElevation.elevationJustification}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* SCENARIO 4: RELATIONSHIP ARBITRATION */}
        {task.type === "RELATIONSHIP_ARBITRATION" && (
          <div className="space-y-3">
            <div className="rounded-md border border-border-subtle bg-surface-2 p-3 space-y-2">
              <span className="text-micro font-mono uppercase tracking-wider text-text-muted">
                Inferred Relationship Under Review
              </span>
              <div className="flex items-center justify-between text-xs font-mono p-2 bg-surface-1 rounded border border-border-subtle">
                <span className="text-text-primary">{task.entityAName}</span>
                <span className="text-amber">&rarr; {task.relationshipType} &rarr;</span>
                <span className="text-text-primary">{task.entityBName}</span>
              </div>
              <ConfidenceMeter confidence={task.confidence} flagManualReview />
            </div>
          </div>
        )}

        {/* DECISION OR CERTIFICATE SECTION */}
        {isResolved && task.decision ? (
          /* Read-only Evidentiary Arbitration Certificate */
          <div className="rounded-md border border-verified-emerald/50 bg-verified-emerald/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-verified-emerald font-semibold text-xs">
                <CheckCircle2 className="h-4 w-4" />
                <span>OFFICIAL ARBITRATION CERTIFICATE RECORDED</span>
              </div>
              <Badge tone="emerald" className="font-mono text-micro">
                IMMUTABLE AUDIT LOGGED
              </Badge>
            </div>

            <div className="space-y-2 text-xs bg-surface-1/80 p-3 rounded border border-verified-emerald/30">
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Arbitration Decision:</span>
                <span className="font-mono font-semibold text-text-primary">
                  {task.decision.action.replace(/_/g, " ")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Signed By Officer:</span>
                <span className="font-mono text-text-primary">
                  {task.decision.officerName} ({task.decision.officerBadge})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Recorded Timestamp:</span>
                <span className="font-mono text-text-primary">
                  {new Date(task.decision.arbitratedAt).toLocaleString("en-IN")} IST
                </span>
              </div>
              <div className="pt-2 border-t border-border-subtle">
                <span className="text-text-muted block text-micro uppercase tracking-wide mb-1">
                  Recorded Statutory Justification:
                </span>
                <p className="text-text-primary font-mono text-micro bg-surface-2 p-2 rounded">
                  {task.decision.justification}
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Action Selection & Mandatory Statutory Justification Form */
          <div className="rounded-md border border-border-subtle bg-surface-2 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                <UserCheck className="h-4 w-4 text-electric-blue-soft" />
                <span>Investigator Arbitration &amp; Signoff</span>
              </h3>
              <span className="text-micro font-mono text-amber font-medium">
                Mandatory Statutory Review
              </span>
            </div>

            {/* Action Buttons Selector */}
            <div className="space-y-2">
              <span className="text-micro font-mono uppercase tracking-wider text-text-muted">
                Select Resolution Action:
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {task.type === "CONTRADICTION_RESOLUTION" && (
                  <>
                    <Button
                      variant={selectedAction === "ACCEPT_CLAIM_A" ? "primary" : "secondary"}
                      size="sm"
                      onClick={() => setSelectedAction("ACCEPT_CLAIM_A")}
                      className="justify-start text-xs font-mono"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-electric-blue-soft" />
                      Accept Claim A
                    </Button>
                    <Button
                      variant={selectedAction === "ACCEPT_CLAIM_B" ? "primary" : "secondary"}
                      size="sm"
                      onClick={() => setSelectedAction("ACCEPT_CLAIM_B")}
                      className="justify-start text-xs font-mono"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-verified-emerald" />
                      Accept Claim B
                    </Button>
                    <Button
                      variant={selectedAction === "FLAG_CONTRADICTION" ? "primary" : "secondary"}
                      size="sm"
                      onClick={() => setSelectedAction("FLAG_CONTRADICTION")}
                      className="justify-start text-xs font-mono"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 mr-1 text-amber" />
                      Keep Flagged
                    </Button>
                    <Button
                      variant={selectedAction === "ESCALATE" ? "primary" : "secondary"}
                      size="sm"
                      onClick={() => setSelectedAction("ESCALATE")}
                      className="justify-start text-xs font-mono"
                    >
                      <AlertCircle className="h-3.5 w-3.5 mr-1 text-critical-red" />
                      Escalate to Supv.
                    </Button>
                  </>
                )}

                {task.type === "ENTITY_MERGE" && (
                  <>
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
                  </>
                )}

                {(task.type === "TIER_ELEVATION" || task.type === "RELATIONSHIP_ARBITRATION") && (
                  <>
                    <Button
                      variant={selectedAction === "ARBITRATE" || selectedAction === "APPROVE_MERGE" ? "primary" : "secondary"}
                      size="sm"
                      onClick={() => setSelectedAction("ARBITRATE")}
                      className="justify-start text-xs font-mono"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-verified-emerald" />
                      Approve &amp; Validate
                    </Button>
                    <Button
                      variant={selectedAction === "REJECT_MERGE" ? "primary" : "secondary"}
                      size="sm"
                      onClick={() => setSelectedAction("REJECT_MERGE")}
                      className="justify-start text-xs font-mono"
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1 text-critical-red" />
                      Reject Request
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
                  </>
                )}
              </div>
            </div>

            {/* Statutory Quick-Fill Shortcuts */}
            <div className="space-y-1.5">
              <span className="text-micro font-mono uppercase tracking-wider text-text-muted">
                Statutory Reference Quick-Fills:
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handlePresetJustification("Corroborated under Sec 91 CrPC notice response from TSP.")}
                  className="rounded bg-surface-1 hover:bg-surface-3 border border-border-subtle px-2 py-0.5 text-micro font-mono text-text-secondary hover:text-text-primary transition-colors"
                >
                  + Sec 91 CrPC Notice
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetJustification("Certified electronic evidence under Sec 65B Indian Evidence Act.")}
                  className="rounded bg-surface-1 hover:bg-surface-3 border border-border-subtle px-2 py-0.5 text-micro font-mono text-text-secondary hover:text-text-primary transition-colors"
                >
                  + Sec 65B IEA Cert
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetJustification("Verified optical Toll ANPR plate capture vs switch dump.")}
                  className="rounded bg-surface-1 hover:bg-surface-3 border border-border-subtle px-2 py-0.5 text-micro font-mono text-text-secondary hover:text-text-primary transition-colors"
                >
                  + ANPR Camera Log
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetJustification("Certified bank ledger statement under Bankers Books Evidence Act Sec 2A.")}
                  className="rounded bg-surface-1 hover:bg-surface-3 border border-border-subtle px-2 py-0.5 text-micro font-mono text-text-secondary hover:text-text-primary transition-colors"
                >
                  + Bankers Books 2A
                </button>
              </div>
            </div>

            {/* Mandatory Justification Textarea */}
            <div className="space-y-1.5">
              <label className="text-micro font-mono uppercase tracking-wider text-text-muted flex items-center justify-between">
                <span>Statutory Investigative Justification (Mandatory):</span>
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

            {/* Officer Signoff Information Strip */}
            <div className="flex items-center justify-between p-2.5 rounded bg-surface-1 border border-border-subtle text-micro font-mono">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-electric-blue-soft" />
                <span className="text-text-secondary">Signing Officer:</span>
                <span className="font-semibold text-text-primary">{fullName} ({badgeNumber})</span>
              </div>
              <span className="text-text-muted">{roleLabel}</span>
            </div>

            {/* Submit Button */}
            <Button
              variant="primary"
              size="md"
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="w-full justify-center text-xs font-semibold gap-2 py-2.5 shadow-panel font-mono"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{isSubmitting ? "Committing to Audit Chain..." : "Commit Decision & Sign Off"}</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
