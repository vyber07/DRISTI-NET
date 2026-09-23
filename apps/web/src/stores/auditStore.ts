import { create } from "zustand";
import type { AuditLogEntry, AuditActionType } from "@/types/audit";
import { listAuditLogs } from "@/services/api/auditApi";

export interface AuditState {
  logs: AuditLogEntry[];
  caseId: string;
  isLoading: boolean;
  error: string | null;

  // Filters
  searchQuery: string;
  selectedAction: AuditActionType | "ALL";
  selectedTargetType: string | "ALL";
  selectedActor: string | "ALL";
  selectedTargetId: string | null;
  sortOrder: "DESC" | "ASC";

  // Selection / Detail
  selectedLog: AuditLogEntry | null;
  isDrawerOpen: boolean;

  // Actions
  loadLogs: (caseId?: string) => Promise<void>;
  setSearchQuery: (q: string) => void;
  setActionFilter: (action: AuditActionType | "ALL") => void;
  setTargetTypeFilter: (targetType: string | "ALL") => void;
  setActorFilter: (actor: string | "ALL") => void;
  setTargetIdFilter: (targetId: string | null) => void;
  setSortOrder: (order: "DESC" | "ASC") => void;
  selectLog: (log: AuditLogEntry | null) => void;
  openDrawer: (log: AuditLogEntry) => void;
  closeDrawer: () => void;
  resetFilters: () => void;

  // Selector
  getFilteredLogs: () => AuditLogEntry[];
}

export const useAuditStore = create<AuditState>((set, get) => ({
  logs: [],
  caseId: "DR-2026-00421",
  isLoading: false,
  error: null,

  searchQuery: "",
  selectedAction: "ALL",
  selectedTargetType: "ALL",
  selectedActor: "ALL",
  selectedTargetId: null,
  sortOrder: "DESC",

  selectedLog: null,
  isDrawerOpen: false,

  loadLogs: async (caseId = "DR-2026-00421") => {
    set({ isLoading: true, error: null, caseId });
    try {
      const res = await listAuditLogs(caseId);
      if (res.data) {
        set({
          logs: res.data,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({
        isLoading: false,
        error: "Failed to retrieve audit logs.",
      });
    }
  },

  setSearchQuery: (searchQuery: string) => set({ searchQuery }),
  setActionFilter: (selectedAction) => set({ selectedAction }),
  setTargetTypeFilter: (selectedTargetType) => set({ selectedTargetType }),
  setActorFilter: (selectedActor) => set({ selectedActor }),
  setTargetIdFilter: (selectedTargetId) => set({ selectedTargetId }),
  setSortOrder: (sortOrder) => set({ sortOrder }),

  selectLog: (selectedLog) => set({ selectedLog }),
  openDrawer: (log) => set({ selectedLog: log, isDrawerOpen: true }),
  closeDrawer: () => set({ isDrawerOpen: false, selectedLog: null }),

  resetFilters: () =>
    set({
      searchQuery: "",
      selectedAction: "ALL",
      selectedTargetType: "ALL",
      selectedActor: "ALL",
      selectedTargetId: null,
    }),

  getFilteredLogs: () => {
    const {
      logs,
      searchQuery,
      selectedAction,
      selectedTargetType,
      selectedActor,
      selectedTargetId,
      sortOrder,
    } = get();

    let result = [...logs];

    if (selectedAction !== "ALL") {
      result = result.filter((l) => l.action === selectedAction);
    }
    if (selectedTargetType !== "ALL") {
      result = result.filter((l) => l.target_kind === selectedTargetType);
    }
    if (selectedActor !== "ALL") {
      result = result.filter((l) => l.actor_id === selectedActor);
    }
    if (selectedTargetId) {
      result = result.filter((l) => l.target_id === selectedTargetId);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (l) =>
          l.action.toLowerCase().includes(q) ||
          (l.actor_id || "").toLowerCase().includes(q) ||
          (l.target_id || "").toLowerCase().includes(q) ||
          (l.target_kind || "").toLowerCase().includes(q) ||
          (l.outcome || "").toLowerCase().includes(q)
      );
    }

    if (sortOrder === "ASC") {
      result.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    } else {
      result.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    return result;
  },
}));
