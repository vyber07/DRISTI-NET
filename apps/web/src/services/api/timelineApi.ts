import { mockFetch, type ApiResponse } from "./client";
import { get } from "./real_client";
import { MOCK_TIMELINE_EVENTS } from "@/mock/timeline";
import type { TimelineEvent, TimelineFilter } from "@/types/timeline";

export async function getTimelineEvents(
  caseId: string,
  filter?: TimelineFilter,
): Promise<ApiResponse<TimelineEvent[]>> {
  try {
    const data = await get(`/cases/${caseId}/timeline`);
    return { data, meta: { requestId: '1', timestamp: '', durationMs: 0, securityClassification: '' } };
  } catch(e) {
    console.warn('Backend failed, fallback to mock');

  let events = MOCK_TIMELINE_EVENTS.filter((e) => !caseId || e.caseId === caseId);

  if (filter) {
    if (filter.types && filter.types.length > 0) {
      events = events.filter((e) => filter.types!.includes(e.type));
    }
    if (filter.categories && filter.categories.length > 0) {
      events = events.filter((e) => filter.categories!.includes(e.category));
    }
    if (filter.minTier !== undefined) {
      events = events.filter((e) => e.evidenceTier >= filter.minTier!);
    }
    if (filter.entityId) {
      events = events.filter((e) => e.entityIds.includes(filter.entityId!));
    }
    if (filter.onlyContradictions) {
      events = events.filter((e) => Boolean(e.hasContradiction));
    }
    if (filter.startTime) {
      const startMs = new Date(filter.startTime).getTime();
      events = events.filter((e) => new Date(e.timestamp).getTime() >= startMs);
    }
    if (filter.endTime) {
      const endMs = new Date(filter.endTime).getTime();
      events = events.filter((e) => new Date(e.timestamp).getTime() <= endMs);
    }
  }

  // Ensure chronological order
  events = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  return mockFetch(events, 160);
  }
}

export async function getTimelineEventById(
  eventId: string,
): Promise<ApiResponse<TimelineEvent | null>> {
  const event = MOCK_TIMELINE_EVENTS.find((e) => e.id === eventId) || null;
  return mockFetch(event, 120);
}
