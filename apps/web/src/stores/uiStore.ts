import { create } from "zustand";

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  caseInfoPanelExpanded: boolean;
  toggleCaseInfoPanel: () => void;
  setCaseInfoPanelExpanded: (expanded: boolean) => void;
}

/**
 * Minimal Phase 1 slice. drawerOpen/provenancePanelOpen/toasts are added
 * in Phase 2+ once the Graph/Drawer/Provenance features that own them exist —
 * kept out for now to avoid speculative state with no consumer.
 */
export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  caseInfoPanelExpanded: true,
  toggleCaseInfoPanel: () => set((state) => ({ caseInfoPanelExpanded: !state.caseInfoPanelExpanded })),
  setCaseInfoPanelExpanded: (expanded) => set({ caseInfoPanelExpanded: expanded }),
}));
