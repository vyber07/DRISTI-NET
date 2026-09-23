import { useEffect, useState } from "react";
import { LayoutGrid, List, FilterX, RotateCcw, AlertCircle, HardDrive, ShieldCheck, FileCheck, Search, Radio, Landmark, Lock, Scale, AlertOctagon } from "lucide-react";
import { useEvidenceStore } from "@/stores/evidenceStore";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EvidenceFilterBar } from "./evidence-filter-bar";
import { EvidenceCard } from "./evidence-card";
import { EvidenceRow } from "./evidence-row";

export function CaseEvidenceView() {
  const {
    caseId,
    entityScope,
    evidence,
    isLoading,
    error,
    viewMode,
    setViewMode,
    setEntityScope,
    resetFilters,
    loadEvidence,
    getFilteredEvidence,
  } = useEvidenceStore();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMsg, setUploadMsg] = useState("");

  const filteredEvidence = getFilteredEvidence();

  const handleScopeEntity = (entId: string) => {
    setEntityScope(entId === entityScope ? null : entId);
  };

  const handleClearScope = () => {
    setEntityScope(null);
  };

  const statusMap = evidence.reduce((acc, curr) => {
    acc[curr.status] = (acc[curr.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="h-full flex flex-col min-w-0 max-w-full">
      <div className="flex-1 space-y-4 p-4 min-w-0 max-w-full overflow-y-auto">
        <div className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface-1 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-electric-blue shrink-0" />
              <h2 className="text-sm font-semibold text-text-primary tracking-tight">Evidence Repository</h2>
            </div>
            <div className="flex items-center gap-1.5 bg-surface-2 rounded-lg p-0.5 border border-border-subtle">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={cn("p-1.5 rounded-md transition-colors", viewMode === "grid" ? "bg-surface-1 text-text-primary shadow-xs border border-border-subtle" : "text-text-muted hover:text-text-secondary")}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={cn("p-1.5 rounded-md transition-colors", viewMode === "table" ? "bg-surface-1 text-text-primary shadow-xs border border-border-subtle" : "text-text-muted hover:text-text-secondary")}
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
             {Object.entries(statusMap).map(([status, count]) => (
                <div key={status} className="flex items-center gap-1.5 rounded-md border border-electric-blue/40 bg-electric-blue/10 px-2.5 py-1 text-electric-blue font-medium text-xs">
                  <span>{count} {status}</span>
                </div>
             ))}
          </div>

          <div className="flex items-center gap-2 mt-4 w-full">
            <input type="file" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} className="text-sm border border-border-subtle p-1 rounded" />
            <Button onClick={async () => {
              if (!selectedFile) return;
              const fd = new FormData();
              fd.append("file", selectedFile);
              fd.append("source_label", "manual");
              const tok = localStorage.getItem("drishti.token");
              const res = await fetch(`/api/v1/cases/\${caseId}/evidence`, {
                method: "POST",
                headers: tok ? { Authorization: `Bearer \${tok}` } : {},
                body: fd
              });
              if (!res.ok) {
                 const text = await res.text();
                 if (text.includes("quarantine") || text.includes("virus") || text.includes("malware")) {
                    setUploadMsg("File is in quarantine");
                 } else {
                    setUploadMsg("Upload failed");
                 }
              } else {
                 setUploadMsg("Uploaded");
                 loadEvidence(caseId, entityScope);
              }
            }}>Upload</Button>
            {uploadMsg && <span className="text-critical-red font-bold text-xs">{uploadMsg}</span>}
          </div>
        </div>

        <EvidenceFilterBar totalCount={evidence.length} filteredCount={filteredEvidence.length} />

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 animate-pulse">
            {[1, 2, 3].map((i) => (<div key={i} className="h-64 rounded-lg bg-surface-2 border border-border-subtle p-4" />))}
          </div>
        )}

        {!isLoading && error && (
          <div className="rounded-lg border border-critical-red/40 bg-critical-red/10 p-6 text-center space-y-3 my-8">
            <AlertCircle className="h-8 w-8 text-critical-red mx-auto" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-text-primary">Unable to load evidence</h3>
              <p className="text-xs text-text-muted">{error}</p>
            </div>
          </div>
        )}

        {!isLoading && !error && filteredEvidence.length === 0 && (
          <div className="rounded-lg border border-border-subtle bg-surface-1/50 p-10 text-center space-y-3 my-8">
            <FilterX className="h-8 w-8 text-text-muted mx-auto" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-text-primary">No evidence artifacts</h3>
            </div>
            <Button variant="secondary" size="sm" onClick={resetFilters} className="text-xs">Reset Filters</Button>
          </div>
        )}

        {!isLoading && !error && filteredEvidence.length > 0 && (
          <>
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-2 gap-4.5 pt-1 min-w-0">
                {filteredEvidence.map((item) => (
                  <EvidenceCard key={item.evidence_id} item={item} caseId={caseId} onScopeEntity={handleScopeEntity} currentEntityScope={entityScope} />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-border-subtle bg-surface-1 overflow-x-auto shadow-panel">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border-subtle bg-surface-2/60 text-micro font-semibold uppercase tracking-wider text-text-muted">
                      <th className="py-2.5 px-3">Document / Title</th>
                      <th className="py-2.5 px-3">Uploaded By</th>
                      <th className="py-2.5 px-3">Source</th>
                      <th className="py-2.5 px-3">SHA-256 Digest</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/60">
                    {filteredEvidence.map((item) => (
                      <EvidenceRow key={item.evidence_id} item={item} caseId={caseId} onScopeEntity={handleScopeEntity} currentEntityScope={entityScope} />
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
