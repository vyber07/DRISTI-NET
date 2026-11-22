import { Outlet } from "react-router-dom";
import { Sidebar } from "./sidebar";
import { SecurityStatusBar } from "@/components/security/security-status-bar";
import { RevealIdentityModal } from "@/components/intelligence/reveal-identity-modal";
import { ConnectionBanner } from "@/components/layout/connection-banner";

/**
 * Root shell for every signed-in page: skip link, sidebar (drawer below 1024px), top bar with the signed-in
 * identity, and the page in <main>.
 */
function AppShell() {
  return (
    <div className="flex h-screen w-full max-w-full overflow-hidden bg-background text-text-primary">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface-1 focus:px-3 focus:py-2 focus:shadow-panel focus:text-sm">
        Skip to content
      </a>
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <SecurityStatusBar />
        <ConnectionBanner />
        <main id="main" tabIndex={-1} className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col focus:outline-none">
          <Outlet />
        </main>
      </div>
      <RevealIdentityModal />
    </div>
  );
}

export { AppShell };
