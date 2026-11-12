import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/** Shown across the top of every signed-in page while the browser reports no network connection. Pages that failed
 *  to load while offline reload their data by themselves when the connection returns (ErrorState). */
export function ConnectionBanner() {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine !== false);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);
  if (online) return null;
  return (
    <div role="status" aria-live="polite"
         className="flex items-center gap-2 border-b border-critical-red/40 bg-critical-red/10 px-4 py-2 text-sm text-text-primary">
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      You are offline. Changes cannot be saved until the connection returns; this page reloads its data when it does.
    </div>
  );
}
