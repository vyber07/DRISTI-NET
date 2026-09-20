import { create } from "zustand";
import type { AuditLogEntry, AuditActionType, AuditTargetType } from "@/types/audit";
import {
  listAuditLogs,
  verifyAuditChain,
  type ChainVerificationResult,
} from "@/services/api/auditApi";

export interface AuditState {
  logs: AuditLogEntry[];
  caseId: string;
  isLoading: boolean;
  error: string | null;

  // Filters
  searchQuery: string;
  selectedAction: AuditActionType | "ALL";
  selectedTargetType: AuditTargetType | "ALL";
  selectedActor: string | "ALL";
  selectedTargetId: string | null;
  sortOrder: "DESC" | "ASC";

  // Selection / Detail
  selectedLog: AuditLogEntry | null;
  isDrawerOpen: boolean;

  // Verification
  isVerifying: boolean;
  verificationResult: ChainVerificationResult | null;
  lastVerifiedAt: string | null;

  // Actions
  loadLogs: (caseId?: string) => Promise<void>;
  setSearchQuery: (q: string) => void;
  setActionFilter: (action: AuditActionType | "ALL") => void;
  setTargetTypeFilter: (targetType: AuditTargetType | "ALL") => void;
  setActorFilter: (actor: string | "ALL") => void;
  setTargetIdFilter: (targetId: string | null) => void;
  setSortOrder: (order: "DESC" | "ASC") => void;
  selectLog: (log: AuditLogEntry | null) => void;
  openDrawer: (log: AuditLogEntry) => void;
  closeDrawer: () => void;
  verifyChain: () => Promise<ChainVerificationResult>;
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

  isVerifying: false,
  verificationResult: null,
  lastVerifiedAt: null,

  loadLogs: async (caseId = "DR-2026-00421") => {
    set({ isLoading: true, error: null, caseId });
    try {
      const res = await listAuditLogs(caseId);
      if (res.data) {
        const result = verifyAuditChain(res.data);
        set({
          logs: res.data,
          isLoading: false,
          verificationResult: result,
          lastVerifiedAt: result.verifiedAt,
        });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({
        isLoading: false,
        error: "Failed to retrieve statutory audit logs from judicial ledger.",
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

  verifyChain: async () => {
    set({ isVerifying: true });
    // Simulate brief cryptographic hash traversal latency
    await new Promise((resolve) => setTimeout(resolve, 350));
    const { logs } = get();
    const result = verifyAuditChain(logs);
    set({
      isVerifying: false,
      verificationResult: result,
      lastVerifiedAt: result.verifiedAt,
    });
    return result;
  },

  resetFilters: () =>
    set({
      searchQuery: "",
      selectedAction: "ALL",
      selectedTargetType: "ALL",
      selectedActor: "ALL",
      selectedTargetId: null,
      sortOrder: "DESC",
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

    // Filter by action
    if (selectedAction !== "ALL") {
      result = result.filter((l) => l.action === selectedAction);
    }

    // Filter by target type
    if (selectedTargetType !== "ALL") {
      result = result.filter((l) => l.targetType === selectedTargetType);
    }

    // Filter by actor
    if (selectedActor !== "ALL") {
      result = result.filter(
        (l) =>
          l.actorBadgeNumber === selectedActor ||
          l.actorName.toLowerCase().includes(selectedActor.toLowerCase()),
      );
    }

    // Filter by target ID (deep-link scope)
    if (selectedTargetId) {
      const tid = selectedTargetId.toLowerCase();
      result = result.filter(
        (l) => l.targetId && l.targetId.toLowerCase().includes(tid),
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((l) => {
        const idMatch = l.id.toLowerCase().includes(q);
        const actionMatch = l.action.toLowerCase().includes(q);
        const actorMatch =
          l.actorName.toLowerCase().includes(q) ||
          l.actorBadgeNumber.toLowerCase().includes(q) ||
          l.actorRole.toLowerCase().includes(q);
        const targetMatch =
          (l.targetId && l.targetId.toLowerCase().includes(q)) ||
          (l.targetType && l.targetType.toLowerCase().includes(q));
        const hashMatch =
          l.hash.toLowerCase().includes(q) ||
          (l.previousHash && l.previousHash.toLowerCase().includes(q));
        const detailsMatch = JSON.stringify(l.details).toLowerCase().includes(q);

        return (
          idMatch ||
          actionMatch ||
          actorMatch ||
          targetMatch ||
          hashMatch ||
          detailsMatch
        );
      });
    }

    // Sort order
    result.sort((a, b) => {
      const diff =
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      return sortOrder === "DESC" ? diff : -diff;
    });

    return result;
  },
}));
