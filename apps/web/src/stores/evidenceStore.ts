import { create } from "zustand";
import type { EvidenceItem, EvidenceSourceType, ExtractionStatus } from "@/types/evidence";
import type { EvidenceTier } from "@/constants/evidenceTiers";
import { listEvidence } from "@/services/api/evidenceApi";
import { maskSensitiveText } from "@/lib/pii";

interface EvidenceFilterState {
  tiers: Set<EvidenceTier>;
  sourceTypes: Set<EvidenceSourceType>;
  extractionStatus: ExtractionStatus | null;
  courtAdmissibleOnly: boolean;
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

  toggleTier: (tier: EvidenceTier) => void;
  selectAllTiers: () => void;
  clearTiers: () => void;

  toggleSourceType: (source: EvidenceSourceType) => void;
  selectAllSourceTypes: () => void;
  clearSourceTypes: () => void;

  setExtractionStatus: (status: ExtractionStatus | null) => void;
  setCourtAdmissibleOnly: (only: boolean) => void;
  setSearchQuery: (query: string) => void;
  resetFilters: () => void;

  // Selectors
  getFilteredEvidence: () => EvidenceItem[];
}

const ALL_SOURCE_TYPES: EvidenceSourceType[] = [
  "TELECOM",
  "BANKING",
  "LAW_ENFORCEMENT",
  "SPATIAL_ANPR",
  "SURVEILLANCE",
  "CYBER_INTERCEPT",
];

const ALL_TIERS: EvidenceTier[] = [2, 3, 4, 5, 6];

const INITIAL_FILTERS: EvidenceFilterState = {
  tiers: new Set(ALL_TIERS),
  sourceTypes: new Set(ALL_SOURCE_TYPES),
  extractionStatus: null,
  courtAdmissibleOnly: false,
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
      const response = await listEvidence(caseId, {
        relatedEntityId: entityId || undefined,
      });
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

  toggleTier: (tier: EvidenceTier) =>
    set((state) => {
      const next = new Set(state.filters.tiers);
      if (next.has(tier)) {
        if (next.size > 1) next.delete(tier);
      } else {
        next.add(tier);
      }
      return { filters: { ...state.filters, tiers: next } };
    }),

  selectAllTiers: () =>
    set((state) => ({
      filters: { ...state.filters, tiers: new Set(ALL_TIERS) },
    })),

  clearTiers: () =>
    set((state) => ({
      filters: { ...state.filters, tiers: new Set([4]) },
    })),

  toggleSourceType: (source: EvidenceSourceType) =>
    set((state) => {
      const next = new Set(state.filters.sourceTypes);
      if (next.has(source)) {
        if (next.size > 1) next.delete(source);
      } else {
        next.add(source);
      }
      return { filters: { ...state.filters, sourceTypes: next } };
    }),

  selectAllSourceTypes: () =>
    set((state) => ({
      filters: { ...state.filters, sourceTypes: new Set(ALL_SOURCE_TYPES) },
    })),

  clearSourceTypes: () =>
    set((state) => ({
      filters: { ...state.filters, sourceTypes: new Set(["TELECOM"]) },
    })),

  setExtractionStatus: (status: ExtractionStatus | null) =>
    set((state) => ({
      filters: { ...state.filters, extractionStatus: status },
    })),

  setCourtAdmissibleOnly: (only: boolean) =>
    set((state) => ({
      filters: { ...state.filters, courtAdmissibleOnly: only },
    })),

  setSearchQuery: (query: string) =>
    set((state) => ({
      filters: { ...state.filters, searchQuery: query },
    })),

  resetFilters: () =>
    set({
      filters: {
        tiers: new Set(ALL_TIERS),
        sourceTypes: new Set(ALL_SOURCE_TYPES),
        extractionStatus: null,
        courtAdmissibleOnly: false,
        searchQuery: "",
      },
    }),

  getFilteredEvidence: () => {
    const { evidence, filters, entityScope } = get();

    return evidence.filter((item) => {
      // Entity Scope filter
      if (entityScope && !item.relatedEntityIds.includes(entityScope)) {
        return false;
      }

      // Tier filter
      if (!filters.tiers.has(item.evidenceTier)) {
        return false;
      }

      // Source Type filter
      if (!filters.sourceTypes.has(item.sourceType)) {
        return false;
      }

      // Extraction Status filter
      if (filters.extractionStatus && item.extractionStatus !== filters.extractionStatus) {
        return false;
      }

      // Court Admissible filter
      if (filters.courtAdmissibleOnly && !item.isCourtAdmissible) {
        return false;
      }

      // Search Query filter
      if (filters.searchQuery.trim()) {
        const q = filters.searchQuery.toLowerCase();
        const matchTitle = maskSensitiveText(item.title).toLowerCase().includes(q) || item.title.toLowerCase().includes(q);
        const matchFile = item.fileName.toLowerCase().includes(q);
        const matchAgency = maskSensitiveText(item.sourceAgency).toLowerCase().includes(q) || item.sourceAgency.toLowerCase().includes(q);
        const matchHash = item.sha256Hash.toLowerCase().includes(q);
        const matchDocId = item.documentId.toLowerCase().includes(q);
        const matchEntities = item.relatedEntityIds.some((id) => id.toLowerCase().includes(q));
        const matchSnippet = maskSensitiveText(item.extractedSnippet).toLowerCase().includes(q) || item.extractedSnippet.toLowerCase().includes(q);

        if (!matchTitle && !matchFile && !matchAgency && !matchHash && !matchDocId && !matchEntities && !matchSnippet) {
          return false;
        }
      }

      return true;
    });
  },
}));
