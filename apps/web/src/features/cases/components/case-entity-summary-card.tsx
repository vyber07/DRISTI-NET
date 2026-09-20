import { Link } from "react-router-dom";
import { Users, ArrowUpRight, Shield } from "lucide-react";
import { EntityBadge } from "@/components/intelligence/entity-badge";
import { EvidenceTierBadge } from "@/components/intelligence/evidence-tier-badge";
import { MOCK_ENTITIES, MOCK_CASE_ID } from "@/mock/caseGraphData";
import type { EntityType } from "@/types/entity";

const POLE_COUNTS: Record<EntityType, number> = {
  PERSON: 4,
  ORGANIZATION: 3,
  LOCATION: 3,
  EVENT: 3,
  FINANCIAL: 1,
  CYBER: 2,
};

const POLE_TYPES: EntityType[] = [
  "PERSON",
  "ORGANIZATION",
  "LOCATION",
  "EVENT",
  "FINANCIAL",
  "CYBER",
];

export function CaseEntitySummaryCard() {
  // Key representative entities across POLE+ spectrum
  const keyEntities = MOCK_ENTITIES.filter((e) =>
    [
      "E-PERS-01",
      "E-PERS-02",
      "E-PERS-03",
      "E-ORG-01",
      "E-FIN-01",
      "E-CYB-01",
    ].includes(e.id),
  );

  return (
    <div className="rounded-lg border border-border-subtle bg-surface-2 p-4 flex flex-col justify-between min-w-0 overflow-hidden">
      <div>
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-border-subtle min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <Users className="h-4 w-4 text-electric-blue-soft shrink-0" />
            <h3 className="text-sm font-semibold text-text-primary truncate">
              POLE+ Entities Summary
            </h3>
            <span className="font-mono text-xs text-text-muted shrink-0">
              ({MOCK_ENTITIES.length})
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

        {/* POLE Category Distribution Pills */}
        <div className="flex flex-wrap items-center gap-1.5 py-2.5 border-b border-border-subtle">
          {POLE_TYPES.map((type) => (
            <div
              key={type}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-3 border border-border-subtle text-micro shrink-0"
            >
              <EntityBadge type={type} />
              <span className="font-mono text-text-muted font-bold">
                {POLE_COUNTS[type]}
              </span>
            </div>
          ))}
        </div>

        {/* Key Entities Listing */}
        <div className="space-y-1 mt-1">
          {keyEntities.map((entity) => {
            const displayName = entity.maskedName || entity.displayName;

            return (
              <div
                key={entity.id}
                className="h-10 px-2.5 flex items-center justify-between gap-2 text-xs min-w-0 rounded border border-transparent hover:border-border-subtle hover:bg-surface-3/50 transition-colors"
              >
                {/* 1. ENTITY TYPE */}
                <div className="shrink-0 flex items-center">
                  <EntityBadge type={entity.type} className="text-micro" />
                </div>

                {/* 2. ENTITY ID / NAME */}
                <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                  <span className="font-mono text-micro text-text-disabled shrink-0">
                    {entity.id}
                  </span>
                  <span className="text-border-strong shrink-0">&bull;</span>
                  <span className="font-medium text-text-primary text-xs truncate" title={displayName}>
                    {displayName}
                  </span>
                </div>

                {/* 3. PII STATE */}
                <div className="shrink-0 flex items-center">
                  {entity.isPiiMasked ? (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 text-micro font-mono font-medium text-amber-400 shrink-0">
                      <Shield className="h-2.5 w-2.5 shrink-0" />
                      <span>MASKED</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded bg-surface-3 border border-border-subtle px-1.5 py-0.5 text-micro font-mono text-text-muted shrink-0">
                      CLEAR
                    </span>
                  )}
                </div>

                {/* 4. EVIDENCE TIER */}
                <div className="shrink-0 flex items-center">
                  <EvidenceTierBadge tier={entity.evidenceTier} short className="text-micro" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 pt-2.5 border-t border-border-subtle flex flex-wrap items-center justify-between gap-1 text-micro text-text-muted">
        <span className="truncate">Zero-Trust PII Masking: Active</span>
        <span className="font-mono shrink-0">100% Identifiers Audited</span>
      </div>
    </div>
  );
}
