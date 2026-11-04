import {
  AlertOctagon, CheckCircle2, CircleDashed, Clock, Hourglass, Loader2, PauseCircle, ShieldAlert, XCircle,
} from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = NonNullable<BadgeProps["tone"]>;
interface StatusInfo { label: string; tone: Tone; icon: typeof Clock; hint: string }

/**
 * One mapping from backend state codes to plain language (docs/context.md §8.2 evidence states, models.REVIEW_STATES).
 * Colour is never the only signal: every state has a label and an icon. Red only for failure/blocked states.
 */
const EVIDENCE: Record<string, StatusInfo> = {
  UPLOADED: { label: "Uploaded", tone: "neutral", icon: Clock, hint: "Received; not yet hashed" },
  HASHED: { label: "Hashed", tone: "neutral", icon: Clock, hint: "Integrity reference recorded" },
  QUARANTINED: { label: "Quarantined", tone: "purple", icon: PauseCircle, hint: "Held until the malware scan passes" },
  MALWARE_SCANNING: { label: "Scanning", tone: "blue", icon: Loader2, hint: "Malware scan in progress" },
  CLEAN: { label: "Scan clean", tone: "blue", icon: CheckCircle2, hint: "Passed the malware scan" },
  INFECTED: { label: "Blocked: infected", tone: "red", icon: ShieldAlert, hint: "Malware detected; never parsed" },
  SCAN_FAILED: { label: "Held: scan failed", tone: "purple", icon: PauseCircle, hint: "Not clean; can be reprocessed" },
  SCAN_TIMEOUT: { label: "Held: scan timed out", tone: "purple", icon: PauseCircle, hint: "Not clean; can be reprocessed" },
  SCANNER_UNAVAILABLE: { label: "Held: scanner unavailable", tone: "purple", icon: PauseCircle, hint: "Not clean; can be reprocessed" },
  ACCEPTED: { label: "Accepted", tone: "blue", icon: CheckCircle2, hint: "Accepted for processing" },
  PROCESSING: { label: "Processing", tone: "blue", icon: Loader2, hint: "Extraction running" },
  EXTRACTED: { label: "Extracted", tone: "blue", icon: CheckCircle2, hint: "Content extracted" },
  ENTITY_CANDIDATES: { label: "Candidates found", tone: "blue", icon: CircleDashed, hint: "Candidate entities produced" },
  HITL: { label: "Needs review", tone: "amber", icon: Hourglass, hint: "Candidates wait for a human decision" },
  GRAPH_PROJECTED: { label: "In graph", tone: "emerald", icon: CheckCircle2, hint: "Claims projected into the case graph" },
  ACTIVE: { label: "Active", tone: "emerald", icon: CheckCircle2, hint: "In use" },
  EXTRACTION_FAILED: { label: "Extraction failed", tone: "red", icon: XCircle, hint: "Original preserved; can be reprocessed" },
  INTEGRITY_MISMATCH: { label: "Integrity mismatch", tone: "red", icon: AlertOctagon, hint: "Stored bytes differ from the recorded SHA-256" },
  REJECTED: { label: "Rejected", tone: "gray", icon: XCircle, hint: "Not accepted" },
  STALE: { label: "Stale", tone: "gray", icon: Clock, hint: "Superseded or out of date" },
  TOMBSTONED: { label: "Removed", tone: "gray", icon: XCircle, hint: "Tombstoned" },
};

const REVIEW: Record<string, StatusInfo> = {
  REVIEW_REQUIRED: { label: "Needs review", tone: "amber", icon: Hourglass, hint: "No human decision yet" },
  APPROVE: { label: "Approved", tone: "emerald", icon: CheckCircle2, hint: "A reviewer approved this candidate" },
  REJECT: { label: "Rejected", tone: "gray", icon: XCircle, hint: "A reviewer rejected this candidate" },
  DEFER: { label: "Deferred", tone: "purple", icon: PauseCircle, hint: "Needs more information" },
  REVERSE: { label: "Reversed", tone: "neutral", icon: Clock, hint: "An earlier decision was reversed" },
  STALE: { label: "Stale", tone: "gray", icon: Clock, hint: "Out of date" },
  CONTRADICTORY: { label: "Contradictory", tone: "orange", icon: AlertOctagon, hint: "Sources disagree" },
  ALLOWED: { label: "Admitted", tone: "blue", icon: CheckCircle2, hint: "Structured record admitted by policy" },
};

export function evidenceStatusInfo(code: string): StatusInfo {
  return EVIDENCE[code] ?? { label: code, tone: "neutral", icon: CircleDashed, hint: code };
}
export function reviewStatusInfo(code: string): StatusInfo {
  return REVIEW[code] ?? { label: code, tone: "neutral", icon: CircleDashed, hint: code };
}

export function StatusBadge({ code, kind = "evidence", className }: { code: string; kind?: "evidence" | "review"; className?: string }) {
  const info = kind === "review" ? reviewStatusInfo(code) : evidenceStatusInfo(code);
  const Icon = info.icon;
  return (
    <Badge tone={info.tone} className={cn("gap-1", className)} title={`${info.hint} (${code})`} data-status={code}>
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {info.label}
    </Badge>
  );
}
