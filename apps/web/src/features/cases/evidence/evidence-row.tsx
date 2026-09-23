import { useNavigate } from "react-router-dom";
import { FileText, Copy, Check, Hash, MapPin, Tag, ShieldCheck, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EvidenceItem } from "@/types/evidence";
import { useState } from "react";
import { useProvenanceStore } from "@/stores/provenanceStore";

interface EvidenceRowProps {
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

export function EvidenceRow({ item, caseId, onScopeEntity, currentEntityScope }: EvidenceRowProps) {
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
    <tr className="hover:bg-surface-2/40 transition-colors group">
      <td className="py-3 px-3 max-w-[220px]">
        <div className="flex items-start gap-2.5">
          <FileText className="h-4 w-4 text-text-muted mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text-primary truncate" title={item.filename}>{item.filename}</p>
            <div className="flex items-center gap-1.5 text-micro font-mono text-text-muted mt-0.5">
              <span className="truncate max-w-[120px]">{item.detected_type}</span>
              <span>&bull;</span>
              <span>{formatFileSize(item.size_bytes)}</span>
            </div>
          </div>
        </div>
      </td>
      <td className="py-3 px-3">
        <span className="text-xs text-text-secondary truncate max-w-[140px] block" title={item.uploaded_by}>{item.uploaded_by}</span>
      </td>
      <td className="py-3 px-3">
        <span className="text-xs text-text-secondary truncate max-w-[140px] block">{item.source_label}</span>
      </td>
      <td className="py-3 px-3">
        <div className="flex items-center gap-1.5">
          <Hash className="h-3 w-3 text-text-disabled shrink-0" />
          <span className="text-micro font-mono text-text-secondary truncate w-24">{item.sha256.slice(0, 12)}...</span>
          <button type="button" onClick={handleCopyHash} className="text-text-muted hover:text-text-primary p-0.5 rounded transition-colors ml-1" title="Copy SHA-256 hash">
            {copiedHash ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          </button>
        </div>
      </td>
      <td className="py-3 px-3">
        <Badge tone="blue" className="text-[10px] font-medium tracking-wide">{item.status}</Badge>
      </td>
      <td className="py-3 px-3 text-right">
        <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-3" onClick={handleViewSource}>
             Inspect
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-3" onClick={() => {
           window.open(`/api/v1/evidence/\${item.evidence_id}/download`, '_blank');
          }}>
             <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
