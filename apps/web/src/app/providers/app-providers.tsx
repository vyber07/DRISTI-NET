import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Root provider composition. Only TooltipProvider is needed in Phase 1.
 * Future phases add auth/session hydration, query client, etc. here rather
 * than scattering providers across feature entry points.
 */
function AppProviders({ children }: { children: ReactNode }) {
  return <TooltipProvider delayDuration={200}>{children}</TooltipProvider>;
}

export { AppProviders };
