import { create } from "zustand";

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  /** Navigation drawer on screens narrower than 1024px. */
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  caseInfoPanelExpanded: boolean;
  toggleCaseInfoPanel: () => void;
  setCaseInfoPanelExpanded: (expanded: boolean) => void;
}

/**
 * Minimal Phase 1 slice. drawerOpen/provenancePanelOpen/toasts are added
 * in Phase 2+ once the Graph/Drawer/Provenance features that own them exist —
 * kept out for now to avoid speculative state with no consumer.
 */
// P2.2: the collapsed sidebar is a per-browser preference, remembered across reloads. Storage can be unavailable
// (private mode, blocked site data); then it simply is not remembered.
const COLLAPSE_KEY = "drishti.sidebarCollapsed";
function readCollapsed(): boolean {
  try { return localStorage.getItem(COLLAPSE_KEY) === "1"; } catch { return false; }
}
function writeCollapsed(collapsed: boolean): void {
  try { localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0"); } catch { /* not remembered */ }
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: readCollapsed(),
  toggleSidebar: () => set((state) => { writeCollapsed(!state.sidebarCollapsed); return { sidebarCollapsed: !state.sidebarCollapsed }; }),
  setSidebarCollapsed: (collapsed) => { writeCollapsed(collapsed); set({ sidebarCollapsed: collapsed }); },
  mobileNavOpen: false,
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
  caseInfoPanelExpanded: true,
  toggleCaseInfoPanel: () => set((state) => ({ caseInfoPanelExpanded: !state.caseInfoPanelExpanded })),
  setCaseInfoPanelExpanded: (expanded) => set({ caseInfoPanelExpanded: expanded }),
}));
