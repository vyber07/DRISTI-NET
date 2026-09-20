import { create } from "zustand";
import type { ProvenanceRecord } from "@/types/entity";
import {
  getProvenanceByRecordId,
  getProvenanceByRelationshipId,
} from "@/services/api/provenanceApi";

interface ProvenanceState {
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  activeRecord: ProvenanceRecord | null;
  selectedPage: number;
  totalPages: number;
  zoom: number;
  activeBoundingBoxId: string | null;

  // Actions
  openProvenanceForRelationship: (relId: string) => Promise<void>;
  openProvenanceForRecord: (recordId: string) => Promise<void>;
  closeProvenance: () => void;
  setPage: (page: number) => void;
  setZoom: (zoom: number) => void;
  setActiveBoundingBox: (boxId: string | null) => void;
}

export const useProvenanceStore = create<ProvenanceState>((set) => ({
  isOpen: false,
  isLoading: false,
  error: null,
  activeRecord: null,
  selectedPage: 1,
  totalPages: 1,
  zoom: 1.0,
  activeBoundingBoxId: null,

  openProvenanceForRelationship: async (relId: string) => {
    set({ isOpen: true, isLoading: true, error: null });
    try {
      const res = await getProvenanceByRelationshipId(relId);
      if (res.data) {
        set({
          activeRecord: res.data,
          selectedPage: 1,
          totalPages: 1,
          activeBoundingBoxId: res.data.boundingBoxes[0]?.id || null,
          isLoading: false,
        });
      } else {
        set({
          error: "No source document available for this relationship.",
          isLoading: false,
        });
      }
    } catch {
      set({
        error: "Failed to load provenance record.",
        isLoading: false,
      });
    }
  },

  openProvenanceForRecord: async (recordId: string) => {
    set({ isOpen: true, isLoading: true, error: null });
    try {
      const res = await getProvenanceByRecordId(recordId);
      if (res.data) {
        set({
          activeRecord: res.data,
          selectedPage: 1,
          totalPages: 1,
          activeBoundingBoxId: res.data.boundingBoxes[0]?.id || null,
          isLoading: false,
        });
      } else {
        set({
          error: "Document record not found.",
          isLoading: false,
        });
      }
    } catch {
      set({
        error: "Failed to load document.",
        isLoading: false,
      });
    }
  },

  closeProvenance: () => {
    set({ isOpen: false, activeRecord: null, error: null });
  },

  setPage: (page) => set({ selectedPage: page }),
  setZoom: (zoom) => set({ zoom: Math.min(2.0, Math.max(0.5, zoom)) }),
  setActiveBoundingBox: (boxId) => set({ activeBoundingBoxId: boxId }),
}));
