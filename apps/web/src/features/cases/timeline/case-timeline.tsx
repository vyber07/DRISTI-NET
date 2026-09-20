import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Clock,
  Calendar,
  AlertCircle,
  FilterX,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TimelineFilterBar } from "./timeline-filter-bar";
import { TimelineEventRow } from "./timeline-event-row";
import { useTimelineStore } from "@/stores/timelineStore";
import type { TimelineEvent } from "@/types/timeline";

interface CaseTimelineProps {
  caseId: string;
}

export function CaseTimeline({ caseId }: CaseTimelineProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const entityIdFromUrl = searchParams.get("entityId");

  const {
    events,
    isLoading,
    error,
    entityScope,
    loadTimeline,
    setEntityScope,
    resetFilters,
    getFilteredEvents,
  } = useTimelineStore();

  // Sync entityId from URL param on mount or change
  useEffect(() => {
    loadTimeline(caseId, entityIdFromUrl);
  }, [caseId, entityIdFromUrl, loadTimeline]);

  const handleScopeEntity = (entityId: string) => {
    setEntityScope(entityId);
    setSearchParams({ tab: "timeline", entityId });
  };

  const handleClearScope = () => {
    setEntityScope(null);
    setSearchParams({ tab: "timeline" });
  };

  const filteredEvents = getFilteredEvents();

  // Group events by date key (YYYY-MM-DD)
  const groupedEvents = useMemo(() => {
    const groups: {
      dateKey: string;
      displayDate: string;
      events: TimelineEvent[];
    }[] = [];

    filteredEvents.forEach((evt) => {
      const d = new Date(evt.timestamp);
      const dateKey = isNaN(d.getTime()) ? "UNKNOWN" : d.toISOString().split("T")[0];
      const displayDate = isNaN(d.getTime())
        ? "Undated Events"
        : new Intl.DateTimeFormat("en-IN", {
            weekday: "short",
            day: "2-digit",
            month: "short",
            year: "numeric",
            timeZone: "Asia/Kolkata",
          }).format(d);

      let group = groups.find((g) => g.dateKey === dateKey);
      if (!group) {
        group = { dateKey, displayDate, events: [] };
        groups.push(group);
      }
      group.events.push(evt);
    });

    return groups;
  }, [filteredEvents]);

  return (
    <div className="flex flex-col h-full w-full max-w-full min-w-0 bg-background overflow-hidden">
      {/* Non-Technical Orientation Guide Bar */}
      <div className="border-b border-border-subtle bg-surface-1 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-text-secondary">
          <span className="font-semibold text-text-primary flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-teal-primary" />
            Case Timeline:
          </span>
          <span>Chronological order of verified events &bull; Bank transfers, phone calls, and sightings</span>
        </div>
        <div className="text-micro text-text-muted hidden md:inline">
          Click <strong>View Evidence</strong> on any event to inspect its original document.
        </div>
      </div>

      {/* Scrollable Container */}
      <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 space-y-4">
        {/* Timeline Header Banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-3">
          <div className="space-y-0.5">
            <h2 className="text-base font-semibold text-text-primary tracking-tight">
              Investigation Timeline &amp; Event Sequence
            </h2>
            <p className="text-xs text-text-muted">
              Step-by-step history of verified phone calls, cash transfers, and sightings across Jaipur, Mumbai, and Dubai.
            </p>
          </div>

          {entityScope && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">
                Showing clues for: <span className="font-mono font-semibold text-text-primary">{entityScope}</span>
              </span>
              <Button
                variant="secondary"
                size="sm"
                className="h-7 text-xs"
                onClick={handleClearScope}
              >
                Show All Events
              </Button>
            </div>
          )}
        </div>

        {/* Filter Bar */}
        <TimelineFilterBar
          totalCount={events.length}
          filteredCount={filteredEvents.length}
        />

        {/* State 1: Loading Skeleton */}
        {isLoading && (
          <div className="space-y-6 pt-4 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-3">
                <div className="h-5 w-36 bg-surface-2 rounded" />
                <div className="space-y-3 pl-8">
                  <div className="h-20 bg-surface-2 rounded-md border border-border-subtle" />
                  <div className="h-20 bg-surface-2 rounded-md border border-border-subtle" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* State 2: Error State */}
        {!isLoading && error && (
          <div className="rounded-lg border border-critical-red/40 bg-critical-red/10 p-6 text-center space-y-3 my-8">
            <AlertCircle className="h-8 w-8 text-critical-red mx-auto" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-text-primary">
                Unable to load timeline docket
              </h3>
              <p className="text-xs text-text-muted">{error}</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => loadTimeline(caseId, entityScope)}
              className="gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        )}

        {/* State 3: Empty State */}
        {!isLoading && !error && filteredEvents.length === 0 && (
          <div className="rounded-lg border border-border-subtle bg-surface-1/50 p-10 text-center space-y-3 my-8">
            <FilterX className="h-8 w-8 text-text-muted mx-auto" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-text-primary">
                {entityScope
                  ? `No timeline events recorded for entity ${entityScope}`
                  : "No events match current timeline filters"}
              </h3>
              <p className="text-xs text-text-muted max-w-md mx-auto">
                {entityScope
                  ? "This entity may not have direct CDR intercepts or recorded sightings in this specific investigation period."
                  : "Try broadening your filter criteria, resetting min tier requirements, or clearing the search query."}
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
                  View Case-Wide Timeline
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={resetFilters}
                className="text-xs"
              >
                Reset All Filters
              </Button>
            </div>
          </div>
        )}

        {/* Chronological Day Groups */}
        {!isLoading && !error && groupedEvents.length > 0 && (
          <div className="space-y-6 pt-2">
            {groupedEvents.map((group) => (
              <div key={group.dateKey} className="space-y-3">
                {/* Date Group Header */}
                <div className="sticky top-0 z-10 flex items-center gap-2 py-1.5 backdrop-blur-md bg-background/80 border-b border-border-subtle/80">
                  <span className="flex items-center gap-1.5 rounded-full border border-border-strong bg-surface-2 px-3 py-1 text-xs font-mono font-semibold text-text-primary shadow-xs">
                    <Calendar className="h-3.5 w-3.5 text-electric-blue-soft" />
                    <span>{group.displayDate}</span>
                  </span>
                  <span className="text-micro font-mono text-text-muted">
                    ({group.events.length} {group.events.length === 1 ? "event" : "events"})
                  </span>
                  <div className="flex-1 h-px bg-border-subtle/60" />
                </div>

                {/* Events in this day */}
                <div className="space-y-3 pl-2 sm:pl-4">
                  {group.events.map((evt, idx) => (
                    <TimelineEventRow
                      key={evt.id}
                      event={evt}
                      caseId={caseId}
                      isLast={idx === group.events.length - 1}
                      onScopeEntity={handleScopeEntity}
                      currentEntityScope={entityScope}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
