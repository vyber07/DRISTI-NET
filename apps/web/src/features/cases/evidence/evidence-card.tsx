import { useNavigate } from "react-router-dom";
import { FileText, Clock, Hash, Check, Copy, HardDrive, Tag, Waypoints, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EvidenceItem } from "@/types/evidence";
import { useState } from "react";
import { useProvenanceStore } from "@/stores/provenanceStore";

interface EvidenceCardProps {
  item: EvidenceItem;
  caseId: string;
  onScopeEntity?: (entityId: string) => void;
  currentEntityScope?: string | null;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

export function EvidenceCard({ item, caseId, onScopeEntity, currentEntityScope }: EvidenceCardProps) {
  const navigate = useNavigate();
  const { openProvenanceForRecord } = useProvenanceStore();
  const [copiedHash, setCopiedHash] = useState(false);

  const handleCopyHash = () => {
    navigator.clipboard.writeText(item.sha256);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleViewSource = async () => {
    await openProvenanceForRecord(item.evidence_id);
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border-subtle bg-surface-1 p-4 shadow-sm min-w-0 max-w-full">
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <Badge tone="blue" className="text-micro font-medium uppercase shrink-0">
              {item.status}
            </Badge>
            <Badge tone="neutral" className="text-micro font-medium uppercase shrink-0">
              {item.source_label}
            </Badge>
          </div>
          <h3 className="text-sm font-semibold text-text-primary tracking-tight line-clamp-2 break-words min-w-0" title={item.filename}>
            {item.filename}
          </h3>
          <div className="flex items-center gap-1.5 text-micro font-mono text-text-muted mt-1 min-w-0">
            <FileText className="h-3 w-3 text-text-disabled shrink-0" />
            <span className="text-text-secondary truncate min-w-0" title={item.detected_type}>{item.detected_type}</span>
            <span className="shrink-0">&bull;</span>
            <span className="shrink-0 whitespace-nowrap">{formatFileSize(item.size_bytes)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs py-1.5 border-t border-b border-border-subtle/50 min-w-0">
        <div className="space-y-0.5 min-w-0">
          <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted">Uploaded By</div>
          <div className="text-xs text-text-secondary truncate font-medium">{item.uploaded_by}</div>
        </div>
        <div className="space-y-0.5 min-w-0">
          <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted">Ingested Date</div>
          <div className="text-xs text-text-secondary font-mono flex items-center gap-1">
            <Clock className="h-3 w-3 text-text-muted shrink-0" />
            <span>{new Date(item.created_at).toLocaleDateString("en-IN")}</span>
          </div>
        </div>
      </div>

      <div className="space-y-1.5 text-xs min-w-0">
        <div className="flex items-center justify-between gap-2 rounded bg-surface-2 px-2.5 py-1.5 font-mono text-micro text-text-muted border border-border-subtle/50 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0" title={`SHA-256: \${item.sha256}`}>
            <Hash className="h-3 w-3 text-border-strong shrink-0" />
            <span className="truncate text-text-primary min-w-0">{item.sha256.slice(0, 20)}...</span>
          </div>
          <button type="button" onClick={handleCopyHash} className="text-text-muted hover:text-text-primary p-1 rounded transition-colors shrink-0">
            {copiedHash ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      <div className="pt-2 border-t border-border-subtle/60 flex flex-wrap items-center gap-2 mt-auto min-w-0">
        <Button variant="primary" size="sm" onClick={handleViewSource} className="flex-1 text-xs font-semibold gap-1.5 shadow-sm whitespace-nowrap">
          <FileText className="h-3.5 w-3.5 shrink-0" />
          <span>Inspect Document</span>
        </Button>
        <Button variant="secondary" size="sm" onClick={() => {
           window.open(`/api/v1/evidence/\${item.evidence_id}/download`, '_blank');
        }} className="text-xs gap-1 text-text-secondary hover:text-text-primary shrink-0 whitespace-nowrap">
          <Download className="h-3.5 w-3.5 shrink-0" />
          <span>Download</span>
        </Button>
      </div>
    </div>
  );
}
