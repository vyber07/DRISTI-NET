import { recordedDateKey } from "@/lib/utils";
import { create } from "zustand";
import type { TimelineEvent } from "@/types/timeline";
import { getTimelineEvents } from "@/services/api/timelineApi";

interface TimelineFilterState {
  startDate: string | null;
  endDate: string | null;
  searchQuery: string;
}

interface TimelineState {
  events: TimelineEvent[];
  caseId: string;
  entityScope: string | null;
  selectedEventId: string | null;
  isLoading: boolean;
  error: string | null;

  // Filters
  filters: TimelineFilterState;

  // Actions
  loadTimeline: (caseId: string, entityId?: string | null) => Promise<void>;
  setEntityScope: (entityId: string | null) => void;
  selectEvent: (eventId: string | null) => void;
  setDateRange: (start: string | null, end: string | null) => void;
  setSearchQuery: (query: string) => void;
  resetFilters: () => void;

  // Selectors
  getFilteredEvents: () => TimelineEvent[];
}

const INITIAL_FILTERS: TimelineFilterState = {
  startDate: null,
  endDate: null,
  searchQuery: "",
};

export const useTimelineStore = create<TimelineState>((set, get) => ({
  events: [],
  caseId: "",
  entityScope: null,
  selectedEventId: null,
  isLoading: false,
  error: null,
  filters: { ...INITIAL_FILTERS },

  loadTimeline: async (caseId: string, entityId?: string | null) => {
    set({ isLoading: true, error: null, caseId, entityScope: entityId || null });
    try {
      const response = await getTimelineEvents(caseId, {
        entity_id: entityId || undefined,
      });
      set({
        events: response.data?.events || [],
        isLoading: false,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load timeline";
      set({ error: msg, isLoading: false });
    }
  },

  setEntityScope: (entityId: string | null) => {
    const { caseId } = get();
    get().loadTimeline(caseId, entityId);
  },

  selectEvent: (eventId: string | null) => set({ selectedEventId: eventId }),

  setDateRange: (start: string | null, end: string | null) =>
    set((state) => ({
      filters: { ...state.filters, startDate: start, endDate: end },
    })),

  setSearchQuery: (query: string) =>
    set((state) => ({
      filters: { ...state.filters, searchQuery: query },
    })),

  resetFilters: () =>
    set({
      filters: {
        startDate: null,
        endDate: null,
        searchQuery: "",
      },
    }),

  getFilteredEvents: () => {
    const { events, filters } = get();

    return events.filter((e) => {
      // Date Range filter
      // FE-028: compare recorded calendar dates (YYYY-MM-DD strings), inclusive at both ends. Parsing the naive event
      // time in the browser's zone against a UTC-midnight filter date mixed zones and dropped the end day itself.
      if (filters.startDate || filters.endDate) {
        const day = recordedDateKey(e.time);
        if (!day) return false; // undated events are excluded once a date range is set
        if (filters.startDate && day < filters.startDate) return false;
        if (filters.endDate && day > filters.endDate) return false;
      }

      // Search Query filter
      if (filters.searchQuery.trim()) {
        const q = filters.searchQuery.toLowerCase();
        const matchType = e.rel_type.toLowerCase().includes(q);
        const matchSource = e.source.label.toLowerCase().includes(q);
        const matchTarget = e.target?.label.toLowerCase().includes(q);
        if (!matchType && !matchSource && !matchTarget) {
          return false;
        }
      }

      return true;
    });
  },
}));
