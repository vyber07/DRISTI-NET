import { create } from "zustand";
import { requestPiiReveal } from "@/services/api/revealApi";
import type { RevealResult } from "@/types/reveal";

interface RevealModalTarget {
  entityId: string;
  entityLabel: string;
  identifierType: string;
  maskedValue: string;
  rawValue: string;
}

interface RevealState {
  activeReveals: Record<string, RevealResult>;
  officerClearance: number;
  officerName: string;
  officerRole: string;

  isModalOpen: boolean;
  modalTarget: RevealModalTarget | null;
  isSubmitting: boolean;
  submissionError: string | null;
  lastResult: RevealResult | null;

  openRevealModal: (target: RevealModalTarget) => void;
  closeRevealModal: () => void;
  setOfficerClearance: (level: number) => void;
  submitRevealRequest: (justification: string, emergencyBypass?: boolean) => Promise<RevealResult>;
  isRevealed: (entityId: string, identifierType: string) => boolean;
  getRevealedValue: (entityId: string, identifierType: string) => string | null;
}

const buildKey = (entityId: string, identifierType: string) => `${entityId}:${identifierType}`;

export const useRevealStore = create<RevealState>((set, get) => ({
  activeReveals: {},
  officerClearance: 3,
  officerName: "",
  officerRole: "",

  isModalOpen: false,
  modalTarget: null,
  isSubmitting: false,
  submissionError: null,
  lastResult: null,

  openRevealModal: (target) => {
    set({
      isModalOpen: true,
      modalTarget: target,
      submissionError: null,
      lastResult: null,
    });
  },

  closeRevealModal: () => {
    set({ isModalOpen: false });
    setTimeout(() => {
      set({ modalTarget: null, isSubmitting: false, submissionError: null });
    }, 200);
  },

  setOfficerClearance: (level) => {
    set({ officerClearance: level });
  },

  submitRevealRequest: async (justification: string, emergencyBypass = false) => {
    const state = get();
    if (!state.modalTarget) throw new Error("No target selected");

    set({ isSubmitting: true, submissionError: null });

    try {
      const res = await requestPiiReveal({
        caseId: "unknown", maskedValue: "unknown", requesterBadge: "unknown", requesterName: "unknown", requesterRole: "unknown", officerClearance: 3,
        entityId: state.modalTarget.entityId,
        identifierType: state.modalTarget.identifierType as any,
        justification,
        emergencyBypass,
      });
      const result = res.data;
      if (result.status === "APPROVED") {
        const key = buildKey(state.modalTarget.entityId, state.modalTarget.identifierType);
        set((s) => ({
          activeReveals: {
            ...s.activeReveals,
            [key]: result,
          },
        }));
      }

      set({ lastResult: result, isSubmitting: false });
      return result;
    } catch (e: any) {
      set({ submissionError: e.message, isSubmitting: false });
      throw e;
    }
  },

  isRevealed: (entityId: string, identifierType: string) => {
    const key = buildKey(entityId, identifierType);
    const reveal = get().activeReveals[key];
    if (!reveal || !reveal.expiresAt) return false;
    const isNotExpired = new Date(reveal.expiresAt).getTime() > Date.now();
    return reveal.status === "APPROVED" && isNotExpired;
  },

  getRevealedValue: (entityId: string, identifierType: string) => {
    const key = buildKey(entityId, identifierType);
    const reveal = get().activeReveals[key];
    if (!reveal || !reveal.expiresAt) return null;
    const isNotExpired = new Date(reveal.expiresAt).getTime() > Date.now();
    return isNotExpired ? reveal.unmaskedValue : null;
  }
}));
