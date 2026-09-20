import { useNavigate } from "react-router-dom";
import {
  MapPin,
  Waypoints,
  FileText,
  AlertOctagon,
  Tag,
  Clock,
  Filter,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EvidenceTierBadge } from "@/components/intelligence/evidence-tier-badge";
import { TimelineEventIcon } from "./timeline-event-icon";
import { useProvenanceStore } from "@/stores/provenanceStore";
import { useGraphStore } from "@/stores/graphStore";
import type { TimelineEvent } from "@/types/timeline";
import { cn } from "@/lib/utils";

interface TimelineEventRowProps {
  event: TimelineEvent;
  caseId: string;
  isLast?: boolean;
  onScopeEntity?: (entityId: string) => void;
  currentEntityScope?: string | null;
}

function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "Asia/Kolkata",
    }).format(d) + " IST";
  } catch {
    return isoString;
  }
}

function formatFullDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Kolkata",
    }).format(d);
  } catch {
    return isoString;
  }
}

export function TimelineEventRow({
  event,
  caseId,
  isLast = false,
  onScopeEntity,
  currentEntityScope,
}: TimelineEventRowProps) {
  const navigate = useNavigate();
  const { openProvenanceForRecord, openProvenanceForRelationship } =
    useProvenanceStore();
  const { selectNode, selectEdge } = useGraphStore();

  const handleViewSource = async () => {
    if (event.evidenceId) {
      await openProvenanceForRecord(event.evidenceId);
    } else if (event.relationshipId) {
      await openProvenanceForRelationship(event.relationshipId);
    }
  };

  const handleViewInGraph = () => {
    if (event.relationshipId) {
      selectEdge(event.relationshipId);
    } else if (event.primaryEntityId) {
      selectNode(event.primaryEntityId);
    }
    navigate(`/cases/${caseId}/graph`);
  };

  const categoryToneMap: Record<
    string,
    "neutral" | "blue" | "amber" | "emerald" | "purple"
  > = {
    CRIME_EVENT: "amber",
    EVIDENTIARY: "blue",
    PROCEDURAL: "neutral",
  };

  return (
    <div className="relative flex items-start gap-3.5 group">
      {/* Vertical Timeline Spine Line */}
      {!isLast && (
        <div
          className="absolute left-4 top-9 -bottom-2 w-px bg-border-subtle group-hover:bg-border-strong transition-colors"
          aria-hidden="true"
        />
      )}

      {/* Event Type Icon */}
      <div className="relative z-10 pt-0.5">
        <TimelineEventIcon
          type={event.type}
          hasContradiction={event.hasContradiction}
          size="md"
        />
      </div>

      {/* Main Event Card */}
      <div
        className={cn(
          "flex-1 rounded-md border p-3.5 space-y-2.5 transition-colors",
          event.hasContradiction
            ? "border-critical-red/40 bg-surface-1/95 hover:border-critical-red/70 shadow-sm"
            : "border-border-subtle bg-surface-1/90 hover:border-border-strong hover:bg-surface-2/40",
        )}
      >
        {/* Top Header: Time, Title, Badges */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="flex items-center gap-1 font-mono text-micro font-semibold text-text-muted bg-surface-2/80 px-2 py-0.5 rounded border border-border-subtle"
                title={formatFullDate(event.timestamp)}
              >
                <Clock className="h-3 w-3 text-text-disabled" />
                {formatTime(event.timestamp)}
              </span>
              <Badge
                tone={categoryToneMap[event.category] || "neutral"}
                className="text-micro font-medium"
              >
                {event.category === "CRIME_EVENT" ? "Incident" : event.category === "EVIDENTIARY" ? "Evidence" : "Procedure"}
              </Badge>
              <EvidenceTierBadge tier={event.evidenceTier} compact />
            </div>

            <h3 className="text-sm font-semibold text-text-primary tracking-tight">
              {event.title}
            </h3>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {(event.evidenceId || event.relationshipId) && (
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

        {/* Description */}
        <p className="text-xs text-text-secondary leading-relaxed font-sans">
          {event.description}
        </p>

        {/* Contradiction Alert Box */}
        {event.hasContradiction && event.contradictionNotes && (
          <div className="rounded border border-critical-red/40 bg-critical-red/10 p-2.5 space-y-1 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-critical-red">
              <AlertOctagon className="h-3.5 w-3.5 shrink-0" />
              <span>Spatio-Temporal Contradiction Detected</span>
            </div>
            <p className="text-text-secondary font-sans leading-normal">
              {event.contradictionNotes}
            </p>
          </div>
        )}

        {/* Entity Association & Location Row */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border-subtle/60 text-xs">
          {/* Related Entities */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-micro font-semibold uppercase tracking-wider text-text-muted">
              Entities:
            </span>
            {event.entityIds.map((entId) => {
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
                  {isScoped && (
                    <Filter className="h-2.5 w-2.5 ml-0.5 text-white" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Relationship Ref */}
          {event.relationshipId && (
            <div className="flex items-center gap-1 text-micro font-mono text-text-muted border-l border-border-subtle pl-2">
              <span>Edge:</span>
              <span className="text-text-secondary">{event.relationshipId}</span>
            </div>
          )}

          {/* Location */}
          {event.location && (
            <div className="flex items-center gap-1 text-micro font-sans text-text-muted border-l border-border-subtle pl-2">
              <MapPin className="h-3 w-3 text-amber-400 shrink-0" />
              <span className="truncate max-w-64" title={event.location.name}>
                {event.location.name}
              </span>
            </div>
          )}

          {/* Metadata Highlights */}
          {event.metadata && (
            <div className="flex items-center gap-2 ml-auto text-micro font-mono text-text-muted">
              {event.metadata.amount !== undefined && (
                <span className="text-emerald-400 font-semibold">
                  ₹{Number(event.metadata.amount).toLocaleString("en-IN")}
                </span>
              )}
              {event.metadata.paymentMethod !== undefined && (
                <span>{String(event.metadata.paymentMethod)}</span>
              )}
              {event.metadata.durationSeconds !== undefined && (
                <span>{String(event.metadata.durationSeconds)}s call</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
