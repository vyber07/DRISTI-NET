import { Link } from "react-router-dom";
import { FileCheck2, FileText, Lock, Hash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EvidenceTierBadge } from "@/components/intelligence/evidence-tier-badge";
import { formatDateOnly } from "@/lib/formatters";
import { MOCK_PROVENANCE_RECORDS } from "@/mock/caseGraphData";

export function CaseEvidenceSummaryCard() {
  const records = Object.values(MOCK_PROVENANCE_RECORDS);

  return (
    <div className="rounded-lg border border-border-subtle bg-surface-2 p-4 flex flex-col justify-between min-w-0 overflow-hidden">
      <div>
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-border-subtle min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileCheck2 className="h-4 w-4 text-electric-blue-soft shrink-0" />
            <h3 className="text-sm font-semibold text-text-primary truncate">
              Evidentiary Records &amp; Provenance
            </h3>
            <span className="font-mono text-xs text-text-muted shrink-0">
              ({records.length})
            </span>
          </div>

          <Badge tone="emerald" className="text-micro font-mono flex items-center gap-1 shrink-0">
            <Lock className="h-2.5 w-2.5" />
            <span className="hidden sm:inline">SHA-256</span> VERIFIED
          </Badge>
        </div>

        {/* Evidence Records List */}
        <div className="divide-y divide-border-subtle/50 mt-1">
          {records.map((rec) => (
            <div key={rec.recordId} className="py-2.5 space-y-1.5 text-xs min-w-0">
              <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <FileText className="h-4 w-4 text-electric-blue-soft shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-text-primary truncate" title={rec.documentTitle}>
                      {rec.documentTitle}
                    </p>
                    <p className="text-micro text-text-muted truncate mt-0.5" title={rec.sourceAgency}>
                      {rec.sourceAgency}
                    </p>
                  </div>
                </div>

                <div className="shrink-0">
                  <EvidenceTierBadge tier={rec.evidenceTier} short className="text-micro" />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-micro text-text-muted">
                <div className="flex items-center gap-1 font-mono text-text-disabled">
                  <Hash className="h-3 w-3 text-border-strong shrink-0" />
                  <span className="truncate max-w-[140px] sm:max-w-[200px]">{rec.sha256Hash.substring(0, 16)}...</span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-electric-blue-soft">
                    {rec.documentType}
                  </span>
                  <span className="text-border-strong">&bull;</span>
                  <span>{formatDateOnly(rec.ingestedAt)}</span>
                </div>
              </div>

              {rec.analystSignoff && (
                <div className="text-micro text-text-secondary bg-surface-3 px-2 py-1 rounded border border-border-subtle/40 break-words">
                  <span className="font-medium text-text-primary">
                    {rec.analystSignoff.officerName}
                  </span>
                  {" "}({rec.analystSignoff.badgeNumber}): {rec.analystSignoff.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 pt-2.5 border-t border-border-subtle flex flex-wrap items-center justify-between gap-2 text-micro text-text-muted">
        <Link
          to="/cases/DR-2026-00421/evidence"
          className="text-electric-blue-soft hover:underline font-mono text-xs flex items-center gap-1 shrink-0"
        >
          <span>Open Evidence Docket &rarr;</span>
        </Link>
        <span className="font-mono shrink-0">BSA 2023 §63 Compliant</span>
      </div>
    </div>
  );
}
