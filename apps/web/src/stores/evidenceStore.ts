import { create } from "zustand";
import type { EvidenceItem } from "@/types/evidence";
import { listEvidence } from "@/services/api/evidenceApi";

interface EvidenceFilterState {
  searchQuery: string;
}

interface EvidenceState {
  evidence: EvidenceItem[];
  caseId: string;
  entityScope: string | null;
  selectedEvidenceId: string | null;
  viewMode: "grid" | "table";
  isLoading: boolean;
  error: string | null;

  // Filters
  filters: EvidenceFilterState;

  // Actions
  loadEvidence: (caseId: string, entityId?: string | null) => Promise<void>;
  setEntityScope: (entityId: string | null) => void;
  selectEvidence: (evidenceId: string | null) => void;
  setViewMode: (mode: "grid" | "table") => void;

  setSearchQuery: (query: string) => void;
  resetFilters: () => void;

  // Selectors
  getFilteredEvidence: () => EvidenceItem[];
}

const INITIAL_FILTERS: EvidenceFilterState = {
  searchQuery: "",
};

export const useEvidenceStore = create<EvidenceState>((set, get) => ({
  evidence: [],
  caseId: "",
  entityScope: null,
  selectedEvidenceId: null,
  viewMode: "grid",
  isLoading: false,
  error: null,
  filters: { ...INITIAL_FILTERS },

  loadEvidence: async (caseId: string, entityId?: string | null) => {
    set({ isLoading: true, error: null, caseId, entityScope: entityId || null });
    try {
      const response = await listEvidence(caseId);
      set({
        evidence: response.data || [],
        isLoading: false,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load evidence docket";
      set({ error: msg, isLoading: false });
    }
  },

  setEntityScope: (entityId: string | null) => {
    const { caseId } = get();
    get().loadEvidence(caseId, entityId);
  },

  selectEvidence: (evidenceId: string | null) => set({ selectedEvidenceId: evidenceId }),

  setViewMode: (mode: "grid" | "table") => set({ viewMode: mode }),

  setSearchQuery: (query: string) =>
    set((state) => ({
      filters: { ...state.filters, searchQuery: query },
    })),

  resetFilters: () =>
    set({
      filters: {
        searchQuery: "",
      },
    }),

  getFilteredEvidence: () => {
    const { evidence, filters } = get();

    return evidence.filter((item) => {
      // Search Query filter
      if (filters.searchQuery.trim()) {
        const q = filters.searchQuery.toLowerCase();
        const matchTitle = item.filename?.toLowerCase().includes(q);
        const matchHash = item.sha256?.toLowerCase().includes(q);
        
        if (!matchTitle && !matchHash) {
          return false;
        }
      }

      return true;
    });
  },
}));
