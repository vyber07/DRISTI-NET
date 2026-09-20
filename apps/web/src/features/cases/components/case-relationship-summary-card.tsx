import { Link } from "react-router-dom";
import { GitFork, AlertTriangle, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EvidenceTierBadge } from "@/components/intelligence/evidence-tier-badge";
import {
  MOCK_RELATIONSHIPS,
  MOCK_CASE_ID,
} from "@/mock/caseGraphData";
import type { EvidenceTier } from "@/constants/evidenceTiers";

const TIER_BREAKDOWN: { tier: EvidenceTier; count: number; label: string }[] = [
  { tier: 6, count: 2, label: "Court Ready (BSA §63)" },
  { tier: 5, count: 3, label: "Supervisor Verified (Gazetted)" },
  { tier: 4, count: 8, label: "Analyst Validated (IO Signed)" },
  { tier: 3, count: 5, label: "Corroborated (Multi-Source)" },
  { tier: 2, count: 2, label: "Machine Extracted (Candidate)" },
];

export function CaseRelationshipSummaryCard() {
  const contradictionRel = MOCK_RELATIONSHIPS.find((r) => r.hasContradiction);

  return (
    <div className="rounded-lg border border-border-subtle bg-surface-2 p-4 flex flex-col justify-between min-w-0 overflow-hidden">
      <div>
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-border-subtle min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <GitFork className="h-4 w-4 text-electric-blue-soft shrink-0" />
            <h3 className="text-sm font-semibold text-text-primary truncate">
              Correlated Relationships &amp; Tiers
            </h3>
            <span className="font-mono text-xs text-text-muted shrink-0">
              ({MOCK_RELATIONSHIPS.length})
            </span>
          </div>

          <Link
            to={`/cases/${MOCK_CASE_ID}/graph`}
            className="flex items-center gap-1 text-xs text-electric-blue-soft hover:underline shrink-0"
          >
            <span>Graph View</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Tier Distribution Bars */}
        <div className="space-y-2 py-3 border-b border-border-subtle">
          {TIER_BREAKDOWN.map(({ tier, count, label }) => {
            const percentage = (count / MOCK_RELATIONSHIPS.length) * 100;

            return (
              <div key={tier} className="space-y-1">
                <div className="flex items-center justify-between text-micro min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <EvidenceTierBadge tier={tier} short />
                    <span className="text-text-secondary truncate">{label}</span>
                  </div>
                  <span className="font-mono font-medium text-text-primary shrink-0 ml-1">
                    {count} ({Math.round(percentage)}%)
                  </span>
                </div>
                <div className="h-1.5 w-full bg-surface-3 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: `var(--tier-${tier}-color)`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Contradiction Callout */}
        {contradictionRel && (
          <div className="mt-3 p-3 rounded-md border border-amber-500/40 bg-amber-500/10 space-y-2 min-w-0">
            <div className="flex items-center justify-between gap-1 min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300 min-w-0 truncate">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span className="truncate">Spatio-Temporal Contradiction</span>
              </div>
              <Badge tone="amber" className="text-micro font-mono shrink-0">
                {contradictionRel.contradictionDetails?.arbitrationStatus}
              </Badge>
            </div>

            <p
              className="text-xs text-text-secondary leading-relaxed"
              style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
            >
              <span className="font-mono text-electric-blue-soft">{contradictionRel.id}</span>
              {" "}({contradictionRel.sourceLabel} &rarr; {contradictionRel.targetLabel}):
              {" "}{contradictionRel.contradictionDetails?.arbitrationNotes}
            </p>

            <div className="flex flex-wrap items-center justify-between gap-1 pt-1 text-micro text-amber-400/90 font-mono">
              <span className="truncate" style={{ overflowWrap: "anywhere" }}>Jaipur (Tower 412) vs Gurugram (NHAI)</span>
              <span className="shrink-0">&Delta;t = 4m 33s / 240km</span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 pt-2.5 border-t border-border-subtle flex flex-wrap items-center justify-between gap-1 text-micro text-text-muted">
        <span className="truncate">Channel Diversity: GSM, VoIP, RTGS, Hawala</span>
        <span className="font-mono shrink-0">1 Contradiction</span>
      </div>
    </div>
  );
}
