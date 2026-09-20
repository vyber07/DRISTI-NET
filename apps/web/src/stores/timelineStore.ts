import { create } from "zustand";
import type { TimelineEvent, TimelineEventType, TimelineCategory } from "@/types/timeline";
import type { EvidenceTier } from "@/constants/evidenceTiers";
import { getTimelineEvents } from "@/services/api/timelineApi";

interface TimelineFilterState {
  activeTypes: Set<TimelineEventType>;
  activeCategories: Set<TimelineCategory>;
  minTier: EvidenceTier | null;
  startDate: string | null;
  endDate: string | null;
  onlyContradictions: boolean;
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
  toggleType: (type: TimelineEventType) => void;
  selectAllTypes: () => void;
  clearTypes: () => void;
  toggleCategory: (cat: TimelineCategory) => void;
  setMinTier: (tier: EvidenceTier | null) => void;
  setDateRange: (start: string | null, end: string | null) => void;
  setOnlyContradictions: (only: boolean) => void;
  setSearchQuery: (query: string) => void;
  resetFilters: () => void;

  // Selectors
  getFilteredEvents: () => TimelineEvent[];
}

const ALL_EVENT_TYPES: TimelineEventType[] = [
  "COMMUNICATION",
  "FINANCIAL_TRANSACTION",
  "PHYSICAL_MOVEMENT",
  "INCIDENT",
  "SURVEILLANCE",
  "FORENSIC_INGESTION",
  "CONTRADICTION_FLAGGED",
  "PROCEDURAL_ACTION",
];

const ALL_CATEGORIES: TimelineCategory[] = ["CRIME_EVENT", "EVIDENTIARY", "PROCEDURAL"];

const INITIAL_FILTERS: TimelineFilterState = {
  activeTypes: new Set(ALL_EVENT_TYPES),
  activeCategories: new Set(ALL_CATEGORIES),
  minTier: null,
  startDate: null,
  endDate: null,
  onlyContradictions: false,
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
        entityId: entityId || undefined,
      });
      set({
        events: response.data || [],
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

  toggleType: (type: TimelineEventType) =>
    set((state) => {
      const next = new Set(state.filters.activeTypes);
      if (next.has(type)) {
        if (next.size > 1) next.delete(type);
      } else {
        next.add(type);
      }
      return { filters: { ...state.filters, activeTypes: next } };
    }),

  selectAllTypes: () =>
    set((state) => ({
      filters: { ...state.filters, activeTypes: new Set(ALL_EVENT_TYPES) },
    })),

  clearTypes: () =>
    set((state) => ({
      filters: { ...state.filters, activeTypes: new Set(["COMMUNICATION"]) },
    })),

  toggleCategory: (cat: TimelineCategory) =>
    set((state) => {
      const next = new Set(state.filters.activeCategories);
      if (next.has(cat)) {
        if (next.size > 1) next.delete(cat);
      } else {
        next.add(cat);
      }
      return { filters: { ...state.filters, activeCategories: next } };
    }),

  setMinTier: (tier: EvidenceTier | null) =>
    set((state) => ({
      filters: { ...state.filters, minTier: tier },
    })),

  setDateRange: (start: string | null, end: string | null) =>
    set((state) => ({
      filters: { ...state.filters, startDate: start, endDate: end },
    })),

  setOnlyContradictions: (only: boolean) =>
    set((state) => ({
      filters: { ...state.filters, onlyContradictions: only },
    })),

  setSearchQuery: (query: string) =>
    set((state) => ({
      filters: { ...state.filters, searchQuery: query },
    })),

  resetFilters: () =>
    set({
      filters: {
        activeTypes: new Set(ALL_EVENT_TYPES),
        activeCategories: new Set(ALL_CATEGORIES),
        minTier: null,
        startDate: null,
        endDate: null,
        onlyContradictions: false,
        searchQuery: "",
      },
    }),

  getFilteredEvents: () => {
    const { events, filters, entityScope } = get();

    return events.filter((e) => {
      // Entity Scope filter
      if (entityScope && !e.entityIds.includes(entityScope)) {
        return false;
      }

      // Event Type filter
      if (!filters.activeTypes.has(e.type)) {
        return false;
      }

      // Category filter
      if (!filters.activeCategories.has(e.category)) {
        return false;
      }

      // Min Tier filter
      if (filters.minTier !== null && e.evidenceTier < filters.minTier) {
        return false;
      }

      // Contradictions only
      if (filters.onlyContradictions && !e.hasContradiction) {
        return false;
      }

      // Date Range filter
      const eventTime = new Date(e.timestamp).getTime();
      if (filters.startDate) {
        const startMs = new Date(filters.startDate).getTime();
        if (eventTime < startMs) return false;
      }
      if (filters.endDate) {
        const endMs = new Date(filters.endDate).getTime();
        if (eventTime > endMs) return false;
      }

      // Search Query filter
      if (filters.searchQuery.trim()) {
        const q = filters.searchQuery.toLowerCase();
        const matchTitle = e.title.toLowerCase().includes(q);
        const matchDesc = e.description.toLowerCase().includes(q);
        const matchEntities = e.entityIds.some((id) => id.toLowerCase().includes(q));
        const matchLocation = e.location?.name.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchEntities && !matchLocation) {
          return false;
        }
      }

      return true;
    });
  },
}));
