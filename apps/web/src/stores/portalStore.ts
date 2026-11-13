import { create } from "zustand";

/**
 * Where Radix portals (dialogs, tooltips) render. Normally document.body. While a page shows an element in full screen
 * (P1.5, the relationship graph), only that element's subtree is drawn by the browser, so a dialog portalled to <body>
 * (for example the reveal-reason dialog, which is mounted in the app shell) would be invisible. The full-screen page
 * sets this to its element for as long as it is full screen; ui/dialog.tsx and ui/tooltip.tsx read it.
 */
interface PortalState {
  container: HTMLElement | null;
  setContainer: (el: HTMLElement | null) => void;
}

export const usePortalStore = create<PortalState>((set) => ({
  container: null,
  setContainer: (el) => set({ container: el }),
}));
