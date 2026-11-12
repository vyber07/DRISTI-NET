import { create } from "zustand";
import { getMyPermissions } from "@/services/api/overridesApi";

type CapabilityMap = Record<string, boolean>;

/**
 * The signed-in user's effective permissions as the server computes them (role + permission overrides), globally and
 * for the case being viewed. `can()` in lib/permissions.ts reads this. It only decides which controls are shown:
 * the server still authorizes every request, so a stale or missing entry can only hide or show a button, never grant.
 */
interface PermissionsState {
  role: string | null;
  global: CapabilityMap | null;
  currentCaseId: string | null;
  byCase: Record<string, CapabilityMap>;
  /** Bumped whenever a map changes, so components that read can() can re-render. */
  version: number;
  loadGlobal: () => Promise<void>;
  enterCase: (caseId: string) => Promise<void>;
  leaveCase: (caseId: string) => void;
  clear: () => void;
}

const toMap = (caps: Record<string, { allowed: boolean }>): CapabilityMap =>
  Object.fromEntries(Object.entries(caps).map(([k, v]) => [k, !!v.allowed]));

export const usePermissionsStore = create<PermissionsState>((set, get) => ({
  role: null,
  global: null,
  currentCaseId: null,
  byCase: {},
  version: 0,

  loadGlobal: async () => {
    try {
      const res = await getMyPermissions();
      set((s) => ({ role: res.role, global: toMap(res.capabilities), version: s.version + 1 }));
    } catch {
      // Fall back to the static role table; the server decides every request anyway.
      set((s) => ({ global: null, version: s.version + 1 }));
    }
  },

  enterCase: async (caseId) => {
    set((s) => ({ currentCaseId: caseId, version: s.version + 1 }));
    try {
      const res = await getMyPermissions(caseId);
      if (get().currentCaseId !== caseId) return; // the user moved on while this loaded
      set((s) => ({ role: res.role, byCase: { ...s.byCase, [caseId]: toMap(res.capabilities) }, version: s.version + 1 }));
    } catch {
      /* keep global / static presentation */
    }
  },

  leaveCase: (caseId) => {
    if (get().currentCaseId === caseId) set((s) => ({ currentCaseId: null, version: s.version + 1 }));
  },

  clear: () => set((s) => ({ role: null, global: null, currentCaseId: null, byCase: {}, version: s.version + 1 })),
}));
