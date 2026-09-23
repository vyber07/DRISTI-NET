import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuthStore } from "@/stores/authStore";

function AppProviders({ children }: { children: ReactNode }) {
  const { restoreSession } = useAuthStore();
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    restoreSession().finally(() => {
      setIsRestoring(false);
    });
  }, [restoreSession]);

  if (isRestoring) {
    return <div className="min-h-screen bg-bg-base flex items-center justify-center text-sm font-mono text-text-muted">Authenticating...</div>;
  }

  return <TooltipProvider delayDuration={200}>{children}</TooltipProvider>;
}

export { AppProviders };
