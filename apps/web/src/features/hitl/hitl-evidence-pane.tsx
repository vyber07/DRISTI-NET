import { useState, useEffect } from "react";
import {
  FileText,
  ShieldCheck,
  ExternalLink,
  CheckCircle2,
  Hash,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EvidenceTierBadge } from "@/components/intelligence/evidence-tier-badge";
import { PdfDocumentViewer } from "@/components/evidence/PdfDocumentViewer";
import { useProvenanceStore } from "@/stores/provenanceStore";
import { getProvenanceByRecordId, getProvenanceByRelationshipId } from "@/services/api/provenanceApi";
import { maskPhoneNumbersInText } from "@/lib/pii";
import type { ProvenanceRecord } from "@/types/entity";
import type { HITLTask } from "@/types/hitl";
import { MOCK_PROVENANCE_RECORDS } from "@/mock/caseGraphData";

interface HITLEvidencePaneProps {
  task: HITLTask;
}

export function HITLEvidencePane({ task }: HITLEvidencePaneProps) {
  const [record, setRecord] = useState<ProvenanceRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { openProvenanceForRecord } = useProvenanceStore();

  useEffect(() => {
    let isMounted = true;
    async function loadRecord() {
      setIsLoading(true);
      try {
        let matched: ProvenanceRecord | null = null;
        if (task.provenanceRecordId) {
          const res = await getProvenanceByRecordId(task.provenanceRecordId);
          matched = res.data;
        } else if (task.relationshipId) {
          const res = await getProvenanceByRelationshipId(task.relationshipId);
          matched = res.data;
        }

        // Fallback to mock records if not found
        if (!matched) {
          matched =
            task.hasContradiction
              ? MOCK_PROVENANCE_RECORDS["PROV-R-04"]
              : MOCK_PROVENANCE_RECORDS["PROV-R-01"];
        }

        if (isMounted) {
          setRecord(matched);
        }
      } catch {
        if (isMounted) {
          setRecord(MOCK_PROVENANCE_RECORDS["PROV-R-04"] || null);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadRecord();
    return () => {
      isMounted = false;
    };
  }, [task]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-surface-2 p-6 text-center space-y-2">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-electric-blue border-t-transparent" />
        <p className="text-xs font-mono text-text-muted">Loading supporting forensic evidence...</p>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-surface-2 p-6 text-center space-y-3">
        <FileText className="h-10 w-10 text-text-muted" />
        <h4 className="text-sm font-semibold text-text-primary">No Direct Evidence Attached</h4>
        <p className="text-xs text-text-secondary max-w-sm">
          No primary forensic PDF record is directly linked to task {task.id}. Check evidence library.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-surface-2 overflow-hidden">
      {/* Evidence Pane Header */}
      <div className="flex h-12 items-center justify-between px-4 bg-surface-1 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-electric-blue-soft shrink-0" />
          <span className="text-xs font-semibold text-text-primary truncate">
            {maskPhoneNumbersInText(record.documentTitle)}
          </span>
          <EvidenceTierBadge tier={record.evidenceTier} className="shrink-0" />
          <Badge tone="gray" className="text-micro font-mono shrink-0">
            {record.documentType}
          </Badge>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-micro font-mono text-electric-blue-soft hover:text-text-primary px-2 gap-1"
            onClick={() => openProvenanceForRecord(record.recordId)}
            title="Expand in full-screen modal forensic viewer"
          >
            <ExternalLink className="h-3 w-3" />
            <span>Full Inspector</span>
          </Button>
        </div>
      </div>

      {/* Embedded Forensic PDF Viewer with Bounding Box Overlay */}
      <div className="flex-1 min-h-0">
        <PdfDocumentViewer record={record} />
      </div>

      {/* Bottom Forensic Dossier Metadata Strip */}
      <div className="p-3 bg-surface-1 border-t border-border-subtle space-y-2 shrink-0 text-micro">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 font-mono text-text-muted">
            <Hash className="h-3 w-3 text-verified-emerald" />
            <span>SHA-256:</span>
            <span className="text-text-secondary truncate max-w-[200px]" title={record.sha256Hash}>
              {record.sha256Hash.substring(0, 16)}...
            </span>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-text-muted">
            <ShieldCheck className="h-3 w-3 text-electric-blue-soft" />
            <span>Agency: {record.sourceAgency}</span>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-text-muted">
            <span>Ingested: {new Date(record.ingestedAt).toLocaleDateString("en-IN")}</span>
          </div>
        </div>

        {record.analystSignoff && (
          <div className="rounded bg-surface-2 p-2 border border-border-subtle/70 text-text-secondary flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-verified-emerald" />
              <span>Prior Signoff: <strong>{record.analystSignoff.officerName}</strong> ({record.analystSignoff.role})</span>
            </div>
            <span className="font-mono text-text-muted">{record.analystSignoff.notes}</span>
          </div>
        )}
      </div>
    </div>
  );
}
