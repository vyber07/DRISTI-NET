import { useNavigate } from "react-router-dom";
import { Clock, FileText, Waypoints, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TimelineEvent } from "@/types/timeline";
import { useProvenanceStore } from "@/stores/provenanceStore";
import { useGraphStore } from "@/stores/graphStore";

interface TimelineEventRowProps {
  event: TimelineEvent;
  caseId: string;
  isLast?: boolean;
  onScopeEntity?: (entityId: string) => void;
  currentEntityScope?: string | null;
}

export function TimelineEventRow({
  event,
  caseId,
  isLast = false,
  onScopeEntity,
  currentEntityScope,
}: TimelineEventRowProps) {
  const navigate = useNavigate();
  const { openProvenanceForRecord } = useProvenanceStore();
  const { selectNode } = useGraphStore();

  const handleViewSource = async () => {
    if (event.evidence_id) {
      await openProvenanceForRecord(event.evidence_id);
    }
  };

  const handleViewInGraph = () => {
    if (event.source?.entity_id) {
      selectNode(event.source.entity_id);
    }
    navigate(`/cases/${caseId}/graph`);
  };

  return (
    <div className="relative flex items-start gap-3.5 group">
      {!isLast && (
        <div
          className="absolute left-4 top-9 -bottom-2 w-px bg-border-subtle group-hover:bg-border-strong transition-colors"
          aria-hidden="true"
        />
      )}

      <div className="relative z-10 pt-0.5 mt-2 ml-1">
        <div className="w-6 h-6 rounded-full bg-electric-blue flex items-center justify-center shrink-0">
           <span className="text-white text-[10px]">{event.rel_type.substring(0,2)}</span>
        </div>
      </div>

      <div
        className={cn(
          "flex-1 rounded-md border p-3.5 space-y-2.5 transition-colors",
          event.missing
            ? "border-amber/40 bg-surface-1/95 hover:border-amber/70 shadow-sm"
            : "border-border-subtle bg-surface-1/90 hover:border-border-strong hover:bg-surface-2/40",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="flex items-center gap-1 font-mono text-micro font-semibold text-text-muted bg-surface-2/80 px-2 py-0.5 rounded border border-border-subtle"
                title={event.time ? new Date(event.time).toLocaleDateString("en-IN") : "Unknown Date"}
              >
                <Clock className="h-3 w-3 text-text-disabled" />
                {event.time ? new Date(event.time).toLocaleTimeString("en-IN", {hour: "2-digit", minute: "2-digit"}) : "Undated"}
              </span>
              <span className="text-micro font-medium border px-1.5 rounded bg-surface-3">
                {event.rel_type}
              </span>
              <span className="text-micro font-medium text-text-secondary border px-1.5 rounded">
                Conf: {Math.round(event.confidence * 100)}%
              </span>
            </div>

            <h3 className="text-sm font-semibold text-text-primary tracking-tight">
               {event.source.label} {event.rel_type.toLowerCase()} {event.target?.label}
            </h3>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {event.evidence_id && (
              <Button
                variant="secondary"
                size="sm"
                className="h-7 px-2.5 text-xs font-semibold gap-1 text-teal-primary border-teal-primary/30 hover:bg-teal-primary/10 shadow-2xs"
                onClick={handleViewSource}
                title="View original evidence document with highlighted proof"
              >
                <FileText className="h-3.5 w-3.5 text-teal-primary" />
                <span>View Evidence</span>
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1 text-text-secondary hover:text-text-primary"
              onClick={handleViewInGraph}
              title="Locate this event on the Investigation Map"
            >
              <Waypoints className="h-3 w-3 text-teal-primary" />
              <span>Map</span>
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border-subtle/60 text-xs mt-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-micro font-semibold uppercase tracking-wider text-text-muted">
              Entities:
            </span>
            {[event.source.entity_id, event.target?.entity_id].filter(Boolean).map((entId) => {
              if (!entId) return null;
              const isScoped = currentEntityScope === entId;
              return (
                <button
                  key={entId}
                  type="button"
                  onClick={() => onScopeEntity?.(entId)}
                  className={cn(
                    "flex items-center gap-1 rounded px-1.5 py-0.5 text-micro font-mono transition-colors border",
                    isScoped
                      ? "bg-electric-blue text-white border-electric-blue"
                      : "bg-surface-2 text-text-secondary border-border-subtle hover:border-border-strong hover:text-text-primary",
                  )}
                  title={`Filter timeline to ${entId}`}
                >
                  <Tag className="h-2.5 w-2.5 text-text-muted" />
                  <span>{entId}</span>
                </button>
              );
            })}
          </div>

          {event.claim_id && (
            <div className="flex items-center gap-1 text-micro font-mono text-text-muted border-l border-border-subtle pl-2">
              <span>Claim ID:</span>
              <span className="text-text-secondary">{event.claim_id}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
