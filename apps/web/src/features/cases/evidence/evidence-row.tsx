import { useState } from "react";
import {
  FileText,
  Radio,
  Landmark,
  Shield,
  Eye,
  Cpu,
  Camera,
  Copy,
  Check,
  Scale,
  AlertOctagon,
  Waypoints,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EvidenceTierBadge } from "@/components/intelligence/evidence-tier-badge";
import { useProvenanceStore } from "@/stores/provenanceStore";
import { useGraphStore } from "@/stores/graphStore";
import { useNavigate } from "react-router-dom";
import type { EvidenceItem, EvidenceSourceType } from "@/types/evidence";
import { maskSensitiveText } from "@/lib/pii";

interface EvidenceRowProps {
  item: EvidenceItem;
  caseId: string;
  onScopeEntity?: (entityId: string) => void;
  currentEntityScope?: string | null;
}

const SOURCE_TYPE_CONFIG: Record<
  EvidenceSourceType,
  { label: string; icon: typeof Radio; tone: "blue" | "emerald" | "amber" | "purple" | "neutral" }
> = {
  TELECOM: { label: "Telecom", icon: Radio, tone: "blue" },
  BANKING: { label: "Banking", icon: Landmark, tone: "emerald" },
  LAW_ENFORCEMENT: { label: "Law Enf.", icon: Shield, tone: "neutral" },
  SPATIAL_ANPR: { label: "ANPR", icon: Camera, tone: "amber" },
  SURVEILLANCE: { label: "Surv.", icon: Eye, tone: "purple" },
  CYBER_INTERCEPT: { label: "Cyber", icon: Cpu, tone: "blue" },
};

export function EvidenceRow({
  item,
  caseId,
}: EvidenceRowProps) {
  const navigate = useNavigate();
  const { openProvenanceForRecord } = useProvenanceStore();
  const { selectEdge, selectNode } = useGraphStore();
  const [copiedHash, setCopiedHash] = useState(false);

  const sourceConfig = SOURCE_TYPE_CONFIG[item.sourceType] || {
    label: item.sourceType,
    icon: FileText,
    tone: "neutral",
  };
  const SourceIcon = sourceConfig.icon;

  const handleCopyHash = () => {
    navigator.clipboard.writeText(item.sha256Hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleViewSource = async () => {
    await openProvenanceForRecord(item.documentId || item.id);
  };

  const handleViewInGraph = () => {
    if (item.relatedRelationshipIds.length > 0) {
      selectEdge(item.relatedRelationshipIds[0]);
    } else if (item.relatedEntityIds.length > 0) {
      selectNode(item.relatedEntityIds[0]);
    }
    navigate(`/cases/${caseId}/graph`);
  };

  return (
    <tr className="border-b border-border-subtle/80 hover:bg-surface-2/50 transition-colors text-xs">
      {/* File & Title */}
      <td className="py-3 px-3">
        <div className="space-y-0.5 max-w-sm">
          <p className="font-semibold text-text-primary truncate" title={maskSensitiveText(item.title)}>
            {maskSensitiveText(item.title)}
          </p>
          <div className="flex items-center gap-1.5 font-mono text-micro text-text-muted">
            <FileText className="h-3 w-3 text-text-disabled shrink-0" />
            <span className="truncate">{item.fileName}</span>
          </div>
        </div>
      </td>

      {/* Source Agency & Type */}
      <td className="py-3 px-3">
        <div className="space-y-1">
          <Badge
            tone={sourceConfig.tone}
            className="text-micro font-mono flex items-center gap-1 w-fit uppercase"
          >
            <SourceIcon className="h-2.5 w-2.5" />
            <span>{sourceConfig.label}</span>
          </Badge>
          <p className="text-micro text-text-muted truncate max-w-44" title={maskSensitiveText(item.sourceAgency)}>
            {maskSensitiveText(item.sourceAgency)}
          </p>
        </div>
      </td>

      {/* Evidence Tier */}
      <td className="py-3 px-3 whitespace-nowrap">
        <EvidenceTierBadge tier={item.evidenceTier} compact />
      </td>

      {/* Cryptographic SHA-256 Hash */}
      <td className="py-3 px-3">
        <div className="flex items-center gap-1 font-mono text-micro text-text-secondary bg-surface-2 px-2 py-0.5 rounded border border-border-subtle/50 w-fit">
          <span>{item.sha256Hash.substring(0, 12)}...</span>
          <button
            type="button"
            onClick={handleCopyHash}
            className="text-text-muted hover:text-text-primary transition-colors ml-1"
            title="Copy SHA-256"
          >
            {copiedHash ? (
              <Check className="h-2.5 w-2.5 text-emerald-400" />
            ) : (
              <Copy className="h-2.5 w-2.5" />
            )}
          </button>
        </div>
      </td>

      {/* Status / Admissibility */}
      <td className="py-3 px-3 whitespace-nowrap">
        {item.isCourtAdmissible ? (
          <Badge tone="purple" className="text-micro font-mono flex items-center gap-1 w-fit">
            <Scale className="h-2.5 w-2.5" />
            <span>Verified (Demo)</span>
          </Badge>
        ) : item.extractionStatus === "FLAGGED_CONTRADICTION" ? (
          <Badge tone="red" className="text-micro font-mono flex items-center gap-1 w-fit">
            <AlertOctagon className="h-2.5 w-2.5" />
            <span>Contradiction</span>
          </Badge>
        ) : (
          <Badge tone="neutral" className="text-micro font-mono w-fit">
            {item.extractionStatus.replace(/_/g, " ")}
          </Badge>
        )}
      </td>

      {/* Entities count */}
      <td className="py-3 px-3 font-mono text-micro text-text-muted whitespace-nowrap">
        {item.relatedEntityIds.join(", ")}
      </td>

      {/* Actions */}
      <td className="py-3 px-3 text-right whitespace-nowrap">
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleViewSource}
            className="h-7 px-2 text-micro font-mono text-electric-blue-soft border-electric-blue/30 hover:bg-electric-blue/15"
            title="View Evidence Provenance Document"
          >
            Source Doc
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleViewInGraph}
            className="h-7 px-2 text-micro font-mono text-text-secondary hover:text-text-primary"
            title="Locate in Graph"
          >
            <Waypoints className="h-3 w-3" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
