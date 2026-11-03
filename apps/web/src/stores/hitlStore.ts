import { create } from "zustand";
import type {
  HITLTask,
  HITLFilter,
  HITLTaskDecision,
  HITLStats,
} from "@/types/hitl";
import {
  listHITLTasks,
  getHITLTask,
  submitTaskDecision,
} from "@/services/api/hitlApi";

interface HITLState {
  tasks: HITLTask[];
  activeTaskId: string | null;
  activeTask: HITLTask | null;
  filter: HITLFilter;
  stats: HITLStats | null;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;

  // Actions
  loadTasks: (overrideFilter?: Partial<HITLFilter>) => Promise<void>;
  loadTaskById: (taskId: string) => Promise<HITLTask | null>;
  selectTask: (taskId: string | null) => void;
  setFilter: (patch: Partial<HITLFilter>) => void;
  resetFilter: () => void;
  submitDecision: (taskId: string, decision: HITLTaskDecision) => Promise<boolean>;
  assignAnalyst: (
    taskId: string,
    analyst: { name: string; badge: string },
  ) => Promise<void>;
  refreshStats: () => Promise<void>;
}

const DEFAULT_FILTER: HITLFilter = {
  status: "ALL",
  type: "ALL",
  priority: "ALL",
  searchQuery: "",
};


import { getHITLStats, assignTask } from "@/services/api/hitlApi";

export const useHITLStore = create<HITLState>((set, get) => ({
  tasks: [],
  activeTaskId: null,
  activeTask: null,
  filter: DEFAULT_FILTER,
  stats: null,
  isLoading: false,
  isSubmitting: false,
  error: null,

  loadTasks: async (overrideFilter) => {
    const activeFilter = { ...get().filter, ...overrideFilter };
    // DEF-067: clear the previous case's queue first; load stats independently. /stats is role-restricted, so with
    // Promise.all an analyst or auditor who may read the queue saw a false "queue clear" when stats returned 403.
    set({ isLoading: true, error: null, tasks: [], activeTask: null });
    try {
      const tasksRes = await listHITLTasks(activeFilter);
      const statsRes = await getHITLStats(activeFilter.caseId).catch(() => ({ data: get().stats }));

      const currentActiveId = get().activeTaskId;
      const matchedActive = currentActiveId
        ? tasksRes.data.find((t) => t.id === currentActiveId) || null
        : null;

      set({
        tasks: tasksRes.data,
        stats: statsRes.data,
        activeTask: matchedActive,
        filter: activeFilter,
        isLoading: false,
      });
    } catch (e: any) {
      set({ error: `Failed to load review tasks: ${e?.message || "error"}`, isLoading: false });
    }
  },

  loadTaskById: async (taskId: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await getHITLTask(taskId);
      if (res.data) {
        set({
          activeTaskId: taskId,
          activeTask: res.data,
          isLoading: false,
        });
        return res.data;
      } else {
        set({
          error: `Task ${taskId} not found`,
          isLoading: false,
          activeTask: null,
        });
        return null;
      }
    } catch {
      set({
        error: `Error loading task ${taskId}`,
        isLoading: false,
      });
      return null;
    }
  },

  selectTask: (taskId: string | null) => {
    if (!taskId) {
      set({ activeTaskId: null, activeTask: null });
      return;
    }
    const found = get().tasks.find((t) => t.id === taskId) || null;
    set({ activeTaskId: taskId, activeTask: found });
    if (!found) {
      // Fetch if not present in active list
      get().loadTaskById(taskId);
    }
  },

  setFilter: (patch) => {
    const updated = { ...get().filter, ...patch };
    set({ filter: updated });
    get().loadTasks(updated);
  },

  resetFilter: () => {
    // DEF-097: DEFAULT_FILTER has no caseId, so reset threw "caseId required" and emptied the queue.
    const reset = { ...DEFAULT_FILTER, caseId: get().filter.caseId };
    set({ filter: reset });
    get().loadTasks(reset);
  },

  submitDecision: async (taskId, decision) => {
    set({ isSubmitting: true, error: null });
    try {
      const res = await submitTaskDecision(taskId, decision);
      if (res.data) {
        // Update task locally in list
        const updatedList = get().tasks.map((t) =>
          t.id === taskId ? (res.data as unknown as HITLTask) : t,
        );
        set({
          tasks: updatedList,
          activeTask: res.data,
          isSubmitting: false,
        });
        // Refresh statistics
        get().refreshStats();
        return true;
      }
      set({ isSubmitting: false, error: "Decision submission failed" });
      return false;
    } catch {
      set({ isSubmitting: false, error: "Decision submission failed" });
      return false;
    }
  },

  assignAnalyst: async (taskId, analyst) => {
    try {
      const res = await assignTask(taskId, analyst);
      if (res.data) {
        const updatedList = get().tasks.map((t) =>
          t.id === taskId ? (res.data as unknown as HITLTask) : t,
        );
        set({
          tasks: updatedList,
          activeTask: get().activeTaskId === taskId ? res.data : get().activeTask,
        });
      }
    } catch {
      console.error('Failed to refresh stats')
    }
  },

  refreshStats: async () => {
    try {
      const statsRes = await getHITLStats(get().filter.caseId);
      if (statsRes.data) {
        set({ stats: statsRes.data });
      }
    } catch {
      console.error('Failed to refresh stats')
    }
  },
}));
