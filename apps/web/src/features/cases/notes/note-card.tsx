import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Briefcase,
  User,
  Waypoints,
  FileText,
  Clock,
  Edit3,
  Trash2,
  Tag,
  Shield,
  Clock3,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNotesStore } from "@/stores/notesStore";
import { useProvenanceStore } from "@/stores/provenanceStore";
import { useGraphStore } from "@/stores/graphStore";
import type { AnalystNote, NoteCategory, NoteTargetType } from "@/types/note";
import { cn } from "@/lib/utils";
import { maskSensitiveText } from "@/lib/pii";

interface NoteCardProps {
  note: AnalystNote;
  caseId: string;
}

const CATEGORY_CONFIG: Record<
  NoteCategory,
  { label: string; tone: "purple" | "emerald" | "amber" | "blue" }
> = {
  HYPOTHESIS: { label: "Working Hypothesis", tone: "purple" },
  EVIDENCE_ASSESSMENT: { label: "Evidence Assessment", tone: "emerald" },
  OPERATIONAL: { label: "Operational Intel", tone: "amber" },
  LEGAL_PROCEDURAL: { label: "Legal & Procedural", tone: "blue" },
};

const TARGET_TYPE_CONFIG: Record<
  NoteTargetType,
  { label: string; icon: typeof Briefcase }
> = {
  CASE: { label: "Case-Wide", icon: Briefcase },
  ENTITY: { label: "Entity Target", icon: User },
  RELATIONSHIP: { label: "Relationship Channel", icon: Waypoints },
  EVIDENCE: { label: "Evidentiary Artifact", icon: FileText },
};

export function NoteCard({ note, caseId }: NoteCardProps) {
  const navigate = useNavigate();
  const { openEditComposer, deleteNote } = useNotesStore();
  const { openProvenanceForRecord } = useProvenanceStore();
  const { selectNode, selectEdge } = useGraphStore();
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const catConfig = CATEGORY_CONFIG[note.category] || {
    label: note.category,
    tone: "neutral",
  };
  const targetConfig = TARGET_TYPE_CONFIG[note.targetType] || {
    label: note.targetType,
    icon: Briefcase,
  };
  const TargetIcon = targetConfig.icon;

  const handleViewInGraph = () => {
    if (note.targetType === "ENTITY" && note.targetId) {
      selectNode(note.targetId);
      navigate(`/cases/${caseId}/graph`);
    } else if (note.targetType === "RELATIONSHIP" && note.targetId) {
      selectEdge(note.targetId);
      navigate(`/cases/${caseId}/graph`);
    }
  };

  const handleViewInTimeline = () => {
    if (note.targetType === "ENTITY" && note.targetId) {
      navigate(`/cases/${caseId}/timeline?entityId=${note.targetId}`);
    }
  };

  const handleViewEvidence = async () => {
    if (note.targetType === "EVIDENCE" && note.targetId) {
      await openProvenanceForRecord(note.targetId);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setIsDeleting(true);
    await deleteNote(note.id);
  };

  const isUpdated = note.updatedAt !== note.createdAt;

  return (
    <div className="rounded-lg border border-border-subtle bg-surface-1/95 p-4 flex flex-col justify-between space-y-3 hover:border-border-strong hover:bg-surface-2/40 transition-colors shadow-panel">
      {/* Top Header: ID, Target, Category */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-micro font-bold text-text-primary bg-surface-2 px-2 py-0.5 rounded border border-border-subtle">
              {note.id}
            </span>

            <Badge
              tone="neutral"
              className="text-micro font-mono flex items-center gap-1 uppercase"
            >
              <TargetIcon className="h-3 w-3 text-text-muted" />
              <span>{targetConfig.label}</span>
            </Badge>

            {note.targetLabel && (
              <span className="font-mono text-micro text-electric-blue-soft bg-electric-blue/10 border border-electric-blue/30 px-2 py-0.5 rounded truncate max-w-56" title={maskSensitiveText(note.targetLabel)}>
                {maskSensitiveText(note.targetLabel)}
              </span>
            )}

            {note.isRestricted && (
              <Badge tone="amber" className="text-micro font-mono flex items-center gap-1">
                <Shield className="h-2.5 w-2.5" />
                <span>Restricted</span>
              </Badge>
            )}
          </div>

          <Badge tone={catConfig.tone} className="text-micro font-medium">
            {catConfig.label}
          </Badge>
        </div>

        {/* Note Content */}
        <p className="text-xs text-text-primary leading-relaxed font-sans whitespace-pre-wrap pt-1">
          {maskSensitiveText(note.content)}
        </p>
      </div>

      {/* Tags list */}
      {note.tags && note.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 pt-1">
          {note.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded bg-surface-2 px-1.5 py-0.5 text-micro font-mono text-text-muted border border-border-subtle/60"
            >
              <Tag className="h-2.5 w-2.5 text-text-disabled" />
              <span>{tag}</span>
            </span>
          ))}
        </div>
      )}

      {/* Author & Timestamp Bar */}
      <div className="pt-2 border-t border-border-subtle/60 flex flex-wrap items-center justify-between gap-2 text-micro">
        <div className="flex items-center gap-1.5 text-text-secondary">
          <span className="font-semibold text-text-primary">{maskSensitiveText(note.authorName)}</span>
          <span className="font-mono text-text-muted">({note.authorBadgeNumber})</span>
          <span className="text-border-strong">&bull;</span>
          <span className="text-text-muted">{note.authorRole}</span>
        </div>

        <div className="flex items-center gap-2 font-mono text-text-muted">
          <span className="flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            {new Date(note.createdAt).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>
          {isUpdated && (
            <span className="flex items-center gap-0.5 text-text-disabled" title={`Updated: ${note.updatedAt}`}>
              <Clock3 className="h-2.5 w-2.5" />
              <span>(edited)</span>
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons Footer */}
      <div className="pt-2 border-t border-border-subtle flex flex-wrap items-center justify-between gap-2">
        {/* Navigation links based on target */}
        <div className="flex items-center gap-1.5">
          {(note.targetType === "ENTITY" || note.targetType === "RELATIONSHIP") && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleViewInGraph}
              className="h-6 px-2 text-micro font-mono gap-1"
              title="Locate target in graph"
            >
              <Waypoints className="h-2.5 w-2.5" />
              <span>Graph</span>
            </Button>
          )}

          {note.targetType === "ENTITY" && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleViewInTimeline}
              className="h-6 px-2 text-micro font-mono gap-1"
              title="Locate target in timeline"
            >
              <Clock className="h-2.5 w-2.5" />
              <span>Timeline</span>
            </Button>
          )}

          {note.targetType === "EVIDENCE" && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleViewEvidence}
              className="h-6 px-2 text-micro font-mono gap-1 text-electric-blue-soft border-electric-blue/30"
              title="View Source Provenance Document"
            >
              <FileText className="h-2.5 w-2.5" />
              <span>Source Doc</span>
            </Button>
          )}
        </div>

        {/* Edit & Delete */}
        <div className="flex items-center gap-1 ml-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openEditComposer(note)}
            className="h-6 px-2 text-micro gap-1 text-text-muted hover:text-text-primary"
            title="Edit note content"
          >
            <Edit3 className="h-3 w-3" />
            <span>Edit</span>
          </Button>

          <Button
            variant={confirmDelete ? "destructive" : "ghost"}
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            className={cn(
              "h-6 px-2 text-micro gap-1 transition-colors",
              confirmDelete
                ? "bg-critical-red text-white"
                : "text-text-muted hover:text-critical-red",
            )}
            title={confirmDelete ? "Confirm deletion" : "Delete note"}
          >
            <Trash2 className="h-3 w-3" />
            <span>{confirmDelete ? "Confirm Delete" : "Delete"}</span>
          </Button>

          {confirmDelete && (
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="text-micro text-text-muted hover:text-text-primary px-1 underline"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
