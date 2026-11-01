import { create } from "zustand";
import type { ContextResponse, SourceLocator } from "@/types/entity";
import { get, post } from "@/services/api/real_client";

interface ProvenanceState {
  isModalOpen: boolean;
  activeRecordId: string | null;
  isLoading: boolean;
  error: string | null;
  record: ContextResponse | null;
  
  isRevealing: boolean;
  revealError: string | null;

  /** Opens the source context; with a locator it opens AT the claim's page/line/row/json_path. */
  openProvenanceForRecord: (evidenceId: string, locator?: SourceLocator) => Promise<void>;
  revealContext: (reason: string) => Promise<void>;
  closeModal: () => void;
}

export const useProvenanceStore = create<ProvenanceState>((set, getStore) => ({
  isModalOpen: false,
  activeRecordId: null,
  isLoading: false,
  error: null,
  record: null,
  isRevealing: false,
  revealError: null,

  openProvenanceForRecord: async (evidenceId: string, locator?: SourceLocator) => {
    set({ isModalOpen: true, activeRecordId: evidenceId, isLoading: true, error: null, revealError: null });
    try {
      const qs = new URLSearchParams();
      for (const key of ["page", "line", "row", "json_path"] as const) {
        const v = locator?.[key];
        if (v !== undefined && v !== null) qs.set(key, String(v));
      }
      const q = qs.toString();
      const res = await get(`/evidence/${encodeURIComponent(evidenceId)}/context${q ? `?${q}` : ""}`);
      set({ record: res || null, isLoading: false });
    } catch (err: unknown) {
      set({ error: (err as Error).message, isLoading: false, record: null });
    }
  },

  revealContext: async (reason: string) => {
     const { activeRecordId, record } = getStore();
     if (!activeRecordId || !record) return;
     set({ isRevealing: true, revealError: null });
     try {
        const body = {
           reason,
           ...record.locator,
           window: 2
        };
        const res = await post(`/evidence/${activeRecordId}/context/reveal`, body);
        set({ record: res, isRevealing: false });
     } catch (err: any) {
        set({ revealError: err.message || "Failed to reveal", isRevealing: false });
     }
  },

  closeModal: () => set({ isModalOpen: false, record: null }),
}));
