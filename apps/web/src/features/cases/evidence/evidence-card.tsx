import { useState } from "react";
import {
  FileText,
  Radio,
  Landmark,
  Shield,
  Eye,
  Cpu,
  Camera,
  Hash,
  Copy,
  Check,
  Scale,
  AlertOctagon,
  Tag,
  CheckCircle2,
  Clock,
  HardDrive,
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
import { cn } from "@/lib/utils";

interface EvidenceCardProps {
  item: EvidenceItem;
  caseId: string;
  onScopeEntity?: (entityId: string) => void;
  currentEntityScope?: string | null;
}

const SOURCE_TYPE_CONFIG: Record<
  EvidenceSourceType,
  { label: string; icon: typeof Radio; tone: "blue" | "emerald" | "amber" | "purple" | "neutral" }
> = {
  TELECOM: { label: "Telecom CDR", icon: Radio, tone: "blue" },
  BANKING: { label: "Banking & Financial", icon: Landmark, tone: "emerald" },
  LAW_ENFORCEMENT: { label: "Law Enforcement", icon: Shield, tone: "neutral" },
  SPATIAL_ANPR: { label: "Spatial / ANPR", icon: Camera, tone: "amber" },
  SURVEILLANCE: { label: "Surveillance", icon: Eye, tone: "purple" },
  CYBER_INTERCEPT: { label: "Cyber Intercept", icon: Cpu, tone: "blue" },
};

export function EvidenceCard({
  item,
  caseId,
  onScopeEntity,
  currentEntityScope,
}: EvidenceCardProps) {
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

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  return (
    <div className="rounded-lg border border-border-subtle bg-surface-1/95 p-4 flex flex-col justify-between space-y-3.5 hover:border-border-strong hover:bg-surface-2/40 transition-colors shadow-panel min-w-0 h-full">
      {/* 1. Header: Source Type, Status Badges, Tier */}
      <div className="space-y-2.5 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <Badge
              tone={sourceConfig.tone}
              className="text-micro font-mono flex items-center gap-1 uppercase shrink-0"
            >
              <SourceIcon className="h-3 w-3 shrink-0" />
              <span>{sourceConfig.label}</span>
            </Badge>

            {item.isCourtAdmissible && (
              <Badge tone="purple" className="text-micro font-mono flex items-center gap-1 shrink-0">
                <Scale className="h-3 w-3 shrink-0" />
                <span>Source Verified (Demo)</span>
              </Badge>
            )}

            {item.extractionStatus === "FLAGGED_CONTRADICTION" && (
              <Badge tone="red" className="text-micro font-mono flex items-center gap-1 shrink-0">
                <AlertOctagon className="h-3 w-3 shrink-0" />
                <span>Contradiction</span>
              </Badge>
            )}

            {item.extractionStatus === "SUPERVISOR_APPROVED" && (
              <Badge tone="emerald" className="text-micro font-mono flex items-center gap-1 shrink-0">
                <CheckCircle2 className="h-3 w-3 shrink-0" />
                <span>Attested</span>
              </Badge>
            )}
          </div>

          <div className="shrink-0">
            <EvidenceTierBadge tier={item.evidenceTier} />
          </div>
        </div>

        {/* 2. Title & Document ID */}
        <div className="space-y-0.5 min-w-0">
          <h3
            className="text-sm font-semibold text-text-primary tracking-tight line-clamp-2 break-words min-w-0"
            title={maskSensitiveText(item.title)}
          >
            {maskSensitiveText(item.title)}
          </h3>
          <div className="flex items-center gap-1.5 text-micro font-mono text-text-muted mt-1 min-w-0">
            <FileText className="h-3 w-3 text-text-disabled shrink-0" />
            <span
              className="text-text-secondary truncate min-w-0 max-w-full"
              title={item.fileName}
            >
              {item.fileName}
            </span>
            <span className="shrink-0">&bull;</span>
            <span className="shrink-0 whitespace-nowrap">{formatFileSize(item.fileSizeBytes)}</span>
          </div>
        </div>
      </div>

      {/* 3. Extracted Evidentiary Snippet (Forensic monospace with safe wrapping and internal scroll) */}
      <div className="rounded-md border border-border-subtle/80 bg-surface-2/60 p-3 space-y-2 text-xs min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap text-micro font-mono text-text-muted min-w-0">
          <span className="uppercase font-semibold tracking-wider text-text-secondary">
            Extracted Evidence Clue
          </span>
          <span className="text-electric-blue-soft font-medium whitespace-nowrap">
            {Math.round(item.confidence * 100)}% confidence
          </span>
        </div>
        <pre className="font-mono text-xs text-text-secondary bg-surface-3/50 p-2.5 rounded border border-border-subtle/40 whitespace-pre-wrap break-words leading-relaxed max-h-44 overflow-y-auto overflow-x-hidden min-w-0 [overflow-wrap:anywhere]">
          {maskSensitiveText(item.extractedSnippet)}
        </pre>
      </div>

      {/* 4. Source Agency + Ingested Date (Responsive two-column metadata layout) */}
      <div className="grid grid-cols-2 gap-2 text-xs py-1.5 border-t border-b border-border-subtle/50 min-w-0">
        <div className="space-y-0.5 min-w-0">
          <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
            Source Agency
          </div>
          <div
            className="text-xs text-text-secondary truncate font-medium"
            title={maskSensitiveText(item.sourceAgency)}
          >
            {maskSensitiveText(item.sourceAgency)}
          </div>
        </div>
        <div className="space-y-0.5 min-w-0">
          <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
            Ingested Date
          </div>
          <div className="text-xs text-text-secondary font-mono flex items-center gap-1">
            <Clock className="h-3 w-3 text-text-muted shrink-0" />
            <span>
              {new Date(item.ingestedAt).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
      </div>

      {/* 5. SHA-256 Digest & Raw Artifact Byte Stream Info */}
      <div className="space-y-1.5 text-xs min-w-0">
        <div className="flex items-center justify-between gap-2 rounded bg-surface-2 px-2.5 py-1.5 font-mono text-micro text-text-muted border border-border-subtle/50 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0" title={`SHA-256: ${item.sha256Hash}`}>
            <Hash className="h-3 w-3 text-border-strong shrink-0" />
            <span className="text-text-disabled shrink-0">SHA-256:</span>
            <span className="truncate text-text-primary [overflow-wrap:anywhere] min-w-0">
              {item.sha256Hash.slice(0, 16)}...
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyHash}
            className="text-text-muted hover:text-text-primary p-1 rounded transition-colors shrink-0"
            title="Copy complete SHA-256 cryptographic hash"
            aria-label="Copy hash"
          >
            {copiedHash ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {/* Raw Artifact Link */}
        <div className="flex items-center justify-between text-micro font-mono text-text-muted min-w-0 pt-0.5">
          <div className="flex items-center gap-1 min-w-0 truncate">
            <HardDrive className="h-2.5 w-2.5 text-text-disabled shrink-0" />
            <span className="text-text-muted shrink-0">Raw Ref:</span>
            <span className="text-text-secondary truncate" title={item.rawArtifactId}>
              {item.rawArtifactId}
            </span>
          </div>
          <span className="text-[10px] text-text-muted shrink-0">Byte-Stream (Tier 1)</span>
        </div>
      </div>

      {/* 6. Associated Entities & Relationships */}
      <div className="space-y-1.5 min-w-0 pt-1 border-t border-border-subtle/50">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-text-muted shrink-0">
            Entities:
          </span>
          {item.relatedEntityIds.map((entId) => {
            const isScoped = currentEntityScope === entId;
            return (
              <button
                key={entId}
                type="button"
                onClick={() => onScopeEntity?.(entId)}
                className={cn(
                  "flex items-center gap-1 rounded px-1.5 py-0.5 text-micro font-mono transition-colors border shrink-0",
                  isScoped
                    ? "bg-electric-blue text-white border-electric-blue"
                    : "bg-surface-2 text-text-secondary border-border-subtle hover:border-border-strong hover:text-text-primary",
                )}
                title={`Filter docket to entity ${entId}`}
              >
                <Tag className="h-2.5 w-2.5 text-text-muted shrink-0" />
                <span>{entId}</span>
              </button>
            );
          })}
        </div>

        {item.relatedRelationshipIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 text-[11px] font-mono text-text-muted min-w-0">
            <span className="shrink-0 text-text-muted font-semibold">Relationships:</span>
            <span className="text-text-secondary break-words">
              {item.relatedRelationshipIds.join(", ")}
            </span>
          </div>
        )}
      </div>

      {/* 7. Card Actions Footer (Stable, responsive, non-overlapping) */}
      <div className="pt-2 border-t border-border-subtle/60 flex flex-wrap items-center gap-2 mt-auto min-w-0">
        <Button
          variant="primary"
          size="sm"
          onClick={handleViewSource}
          className="flex-1 min-w-[155px] text-xs font-semibold gap-1.5 shadow-sm whitespace-nowrap"
          title="Open Original Document Viewer with Highlights"
        >
          <FileText className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Inspect Original Document &rarr;</span>
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={handleViewInGraph}
          className="text-xs gap-1 text-text-secondary hover:text-text-primary shrink-0 whitespace-nowrap"
          title="Locate related clues on the Investigation Map"
        >
          <Waypoints className="h-3.5 w-3.5 shrink-0 text-teal-primary" />
          <span>Locate on Map</span>
        </Button>
      </div>
    </div>
  );
}
