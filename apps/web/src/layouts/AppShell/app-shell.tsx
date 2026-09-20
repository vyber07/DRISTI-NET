import { Outlet } from "react-router-dom";
import { Sidebar } from "./sidebar";
import { SecurityStatusBar } from "@/components/security/security-status-bar";
import { RevealIdentityModal } from "@/components/intelligence/reveal-identity-modal";

/**
 * Root application shell. Every authenticated route renders inside this —
 * the sidebar and security status bar are never absent, since losing track
 * of clearance/jurisdiction/case context is exactly what the spec's
 * "persistent system bar" requirement exists to prevent.
 */
function AppShell() {
  return (
    <div className="flex h-screen w-full max-w-full overflow-hidden bg-background text-text-primary">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <SecurityStatusBar />
        <main className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col">
          <Outlet />
        </main>
      </div>
      <RevealIdentityModal />
    </div>
  );
}

export { AppShell };
