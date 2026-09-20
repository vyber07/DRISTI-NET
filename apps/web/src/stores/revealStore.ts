import { create } from "zustand";
import type { RevealResult } from "@/types/reveal";
import { requestPiiReveal, revokePiiReveal } from "@/services/api/revealApi";

interface RevealModalTarget {
  entityId: string;
  entityLabel: string;
  identifierType: string;
  maskedValue: string;
  rawValue: string;
}

interface RevealState {
  activeReveals: Record<string, RevealResult>; // key: `${entityId}:${identifierType}`
  officerClearance: number; // 1: Constable/Observer, 2: Investigator, 3: Supervisory DySP
  officerBadge: string;
  officerName: string;
  officerRole: string;

  // Modal State
  isModalOpen: boolean;
  modalTarget: RevealModalTarget | null;
  isSubmitting: boolean;
  submissionError: string | null;
  lastResult: RevealResult | null;

  // Actions
  openRevealModal: (target: RevealModalTarget) => void;
  closeRevealModal: () => void;
  setOfficerClearance: (level: number) => void;
  submitRevealRequest: (justification: string, emergencyBypass?: boolean) => Promise<RevealResult>;
  revokeReveal: (entityId: string, identifierType: string) => Promise<void>;
  isRevealed: (entityId: string, identifierType: string) => boolean;
  getRevealedValue: (entityId: string, identifierType: string) => string | null;
}

function buildKey(entityId: string, identifierType: string): string {
  return `${entityId}:${identifierType}`;
}

export const useRevealStore = create<RevealState>((set, get) => ({
  activeReveals: {},
  officerClearance: 2, // Default: Level 2 (Investigator)
  officerBadge: "USR-9921",
  officerName: "Insp. V. Rathore",
  officerRole: "Lead Investigating Officer",

  isModalOpen: false,
  modalTarget: null,
  isSubmitting: false,
  submissionError: null,
  lastResult: null,

  openRevealModal: (target) =>
    set({
      isModalOpen: true,
      modalTarget: target,
      submissionError: null,
      lastResult: null,
    }),

  closeRevealModal: () =>
    set({
      isModalOpen: false,
      modalTarget: null,
      submissionError: null,
      lastResult: null,
    }),

  setOfficerClearance: (officerClearance) => set({ officerClearance }),

  submitRevealRequest: async (justification: string, emergencyBypass = false) => {
    const { modalTarget, officerClearance, officerBadge, officerName, officerRole } = get();
    if (!modalTarget) {
      throw new Error("No target selected for identity reveal");
    }

    set({ isSubmitting: true, submissionError: null });

    try {
      const res = await requestPiiReveal({
        caseId: "DR-2026-00421",
        entityId: modalTarget.entityId,
        identifierType: modalTarget.identifierType as import("@/types/entity").EntityIdentifier["type"],
        maskedValue: modalTarget.maskedValue,
        justification: justification.trim(),
        requesterBadge: officerBadge,
        requesterName: officerName,
        requesterRole: officerRole,
        officerClearance,
        emergencyBypass,
      });

      const result = res.data;
      set({ isSubmitting: false, lastResult: result });

      if (result.status === "APPROVED" && result.unmaskedValue) {
        const key = buildKey(modalTarget.entityId, modalTarget.identifierType);
        set((state) => ({
          activeReveals: {
            ...state.activeReveals,
            [key]: result,
          },
        }));
      } else if (result.status === "DENIED") {
        set({
          submissionError: result.denialReason || "Requisition denied: Insufficient legal authorization.",
        });
      }

      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to process identity requisition";
      set({ isSubmitting: false, submissionError: msg });
      throw err;
    }
  },

  revokeReveal: async (entityId: string, identifierType: string) => {
    const key = buildKey(entityId, identifierType);
    const { officerBadge } = get();
    await revokePiiReveal(entityId, identifierType, officerBadge);

    set((state) => {
      const updated = { ...state.activeReveals };
      delete updated[key];
      return { activeReveals: updated };
    });
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
  },
}));
