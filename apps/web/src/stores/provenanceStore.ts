import { create } from "zustand";
import type { ContextResponse } from "@/types/entity";
import { get, post } from "@/services/api/real_client";

interface ProvenanceState {
  isModalOpen: boolean;
  activeRecordId: string | null;
  isLoading: boolean;
  error: string | null;
  record: ContextResponse | null;
  
  isRevealing: boolean;
  revealError: string | null;

  openProvenanceForRecord: (evidenceId: string) => Promise<void>;
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

  openProvenanceForRecord: async (evidenceId: string) => {
    set({ isModalOpen: true, activeRecordId: evidenceId, isLoading: true, error: null, revealError: null });
    try {
      const res = await get(`/evidence/${evidenceId}/context`);
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
