import { create } from "zustand";
import type { ProvenanceRecord } from "@/types/entity";

interface ProvenanceState {
  isModalOpen: boolean;
  activeRecordId: string | null;
  activeRelationshipId: string | null;
  isLoading: boolean;
  error: string | null;
  record: ProvenanceRecord | null;

  openProvenanceForRecord: (recordId: string) => Promise<void>;
  openProvenanceForRelationship: (relationshipId: string) => Promise<void>;
  closeModal: () => void;
}

export const useProvenanceStore = create<ProvenanceState>((set) => ({
  isModalOpen: false,
  activeRecordId: null,
  activeRelationshipId: null,
  isLoading: false,
  error: null,
  record: null,

  openProvenanceForRecord: async (recordId: string) => {
    set({ isModalOpen: true, activeRecordId: recordId, isLoading: true, error: null });
    try {
      let res: any = null; // await getProvenanceByRecordId(recordId);
      set({ record: res?.data || null, isLoading: false });
    } catch (err: unknown) {
      set({ error: (err as Error).message, isLoading: false, record: null });
    }
  },

  openProvenanceForRelationship: async (relId: string) => {
    set({ isModalOpen: true, activeRelationshipId: relId, isLoading: true, error: null });
    try {
      let res: any = null; // await getProvenanceByRelationshipId(relId);
      set({ record: res?.data || null, isLoading: false });
    } catch (err: unknown) {
      set({ error: (err as Error).message, isLoading: false, record: null });
    }
  },

  closeModal: () => set({ isModalOpen: false }),
}));
