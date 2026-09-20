import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FileCheck2,
  Lock,
  Scale,
  AlertOctagon,
  RotateCcw,
  AlertCircle,
  FilterX,
  Radio,
  Landmark,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EvidenceFilterBar } from "./evidence-filter-bar";
import { EvidenceCard } from "./evidence-card";
import { EvidenceRow } from "./evidence-row";
import { useEvidenceStore } from "@/stores/evidenceStore";

interface CaseEvidenceViewProps {
  caseId: string;
}

export function CaseEvidenceView({ caseId }: CaseEvidenceViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const entityIdFromUrl = searchParams.get("entityId");

  const {
    evidence,
    isLoading,
    error,
    entityScope,
    viewMode,
    loadEvidence,
    setEntityScope,
    resetFilters,
    getFilteredEvidence,
  } = useEvidenceStore();

  useEffect(() => {
    loadEvidence(caseId, entityIdFromUrl);
  }, [caseId, entityIdFromUrl, loadEvidence]);

  const handleScopeEntity = (entityId: string) => {
    setEntityScope(entityId);
    setSearchParams({ tab: "evidence", entityId });
  };

  const handleClearScope = () => {
    setEntityScope(null);
    setSearchParams({ tab: "evidence" });
  };

  const filteredEvidence = getFilteredEvidence();

  // Metrics summary
  const courtAdmissibleCount = evidence.filter((e) => e.isCourtAdmissible).length;
  const contradictionCount = evidence.filter(
    (e) => e.extractionStatus === "FLAGGED_CONTRADICTION",
  ).length;
  const telecomCount = evidence.filter((e) => e.sourceType === "TELECOM").length;
  const bankingCount = evidence.filter((e) => e.sourceType === "BANKING").length;

  return (
    <div className="flex flex-col h-full w-full max-w-full min-w-0 bg-background overflow-hidden">
      {/* Non-Technical Orientation Guide Bar */}
      <div className="border-b border-border-subtle bg-surface-1 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-text-secondary">
          <span className="font-semibold text-text-primary flex items-center gap-1.5">
            <FileCheck2 className="h-4 w-4 text-teal-primary" />
            Evidence Library:
          </span>
          <span>4 source files ingested &bull; 3 evidence artifacts &bull; Every map connection links to original proof here</span>
        </div>
        <div className="text-micro text-text-muted hidden md:inline">
          Click <strong>Inspect Document</strong> on any card to view the exact page and highlighted clue.
        </div>
      </div>

      <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 space-y-4">
        {/* Evidence Docket Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-3">
          <div className="space-y-0.5">
            <h2 className="text-base font-semibold text-text-primary tracking-tight">
              Case Evidence &amp; Source Documents
            </h2>
            <p className="text-xs text-text-muted">
              Original documents and verified files supporting this case. Demo evidence records with cryptographic integrity checks.
            </p>
          </div>

          {/* Key Evidentiary Stat Chips */}
          <div className="flex flex-wrap items-center gap-2 text-micro">
            <div className="flex items-center gap-1.5 rounded-md border border-purple-300/60 bg-purple-50 px-2.5 py-1 text-court-purple font-medium">
              <Scale className="h-3 w-3 text-court-purple shrink-0" />
              <span>{courtAdmissibleCount} Verified Records (Demo)</span>
            </div>

            {contradictionCount > 0 && (
              <div className="flex items-center gap-1.5 rounded-md border border-critical-red/40 bg-critical-red/10 px-2.5 py-1 text-critical-red font-medium">
                <AlertOctagon className="h-3 w-3" />
                <span>{contradictionCount} Discrepancy Flagged</span>
              </div>
            )}

            <div className="flex items-center gap-1.5 rounded-md border border-teal-primary/30 bg-teal-primary/5 px-2.5 py-1 text-teal-primary font-medium">
              <Radio className="h-3 w-3 text-teal-primary" />
              <span>{telecomCount} Phone Records (CDR)</span>
            </div>

            <div className="flex items-center gap-1.5 rounded-md border border-verified-emerald/40 bg-emerald-50 px-2.5 py-1 text-verified-emerald font-medium">
              <Landmark className="h-3 w-3 text-verified-emerald" />
              <span>{bankingCount} Banking Record</span>
            </div>

            <div className="flex items-center gap-1.5 rounded-md border border-border-subtle bg-surface-2 px-2.5 py-1 text-text-secondary font-medium">
              <Lock className="h-3 w-3 text-verified-emerald" />
              <span>Tamper-Proof (Hashed)</span>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <EvidenceFilterBar
          totalCount={evidence.length}
          filteredCount={filteredEvidence.length}
        />

        {/* State 1: Loading Skeleton */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-64 rounded-lg bg-surface-2 border border-border-subtle p-4 space-y-3"
              />
            ))}
          </div>
        )}

        {/* State 2: Error State */}
        {!isLoading && error && (
          <div className="rounded-lg border border-critical-red/40 bg-critical-red/10 p-6 text-center space-y-3 my-8">
            <AlertCircle className="h-8 w-8 text-critical-red mx-auto" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-text-primary">
                Unable to load evidence docket
              </h3>
              <p className="text-xs text-text-muted">{error}</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => loadEvidence(caseId, entityScope)}
              className="gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        )}

        {/* State 3: Empty State */}
        {!isLoading && !error && filteredEvidence.length === 0 && (
          <div className="rounded-lg border border-border-subtle bg-surface-1/50 p-10 text-center space-y-3 my-8">
            <FilterX className="h-8 w-8 text-text-muted mx-auto" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-text-primary">
                {entityScope
                  ? `No evidence artifacts associated with entity ${entityScope}`
                  : "No evidence artifacts match current filter criteria"}
              </h3>
              <p className="text-xs text-text-muted max-w-md mx-auto">
                {entityScope
                  ? "This entity may not be directly cited in the current ingested evidentiary artifacts."
                  : "Broaden your search or reset tier/source filters to view the full evidence library."}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              {entityScope && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleClearScope}
                  className="text-xs"
                >
                  View Full Case Evidence
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={resetFilters}
                className="text-xs"
              >
                Reset Filters
              </Button>
            </div>
          </div>
        )}

        {/* State 4: Evidence Items List */}
        {!isLoading && !error && filteredEvidence.length > 0 && (
          <>
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-2 gap-4.5 pt-1 min-w-0">
                {filteredEvidence.map((item) => (
                  <EvidenceCard
                    key={item.id}
                    item={item}
                    caseId={caseId}
                    onScopeEntity={handleScopeEntity}
                    currentEntityScope={entityScope}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-border-subtle bg-surface-1 overflow-x-auto shadow-panel">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border-subtle bg-surface-2/60 text-micro font-semibold uppercase tracking-wider text-text-muted">
                      <th className="py-2.5 px-3">Document / Title</th>
                      <th className="py-2.5 px-3">Source Agency</th>
                      <th className="py-2.5 px-3">Tier</th>
                      <th className="py-2.5 px-3">SHA-256 Digest</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Entities</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/60">
                    {filteredEvidence.map((item) => (
                      <EvidenceRow
                        key={item.id}
                        item={item}
                        caseId={caseId}
                        onScopeEntity={handleScopeEntity}
                        currentEntityScope={entityScope}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
