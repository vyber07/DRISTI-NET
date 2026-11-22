import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { EyeOff, LogOut, MapPin, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";
import { roleLabel } from "@/lib/permissions";

/**
 * Top bar: who is signed in, their role and jurisdiction (the context every request is authorized against),
 * and Sign out. Removed: a notification bell with no handler or backend, and the duplicated role text.
 * "Sensitive values masked" reflects the server's behaviour: API responses are masked unless a reveal with a reason
 * is made, and revealed values are shown only inside the dialog that requested them.
 */
export function SecurityStatusBar() {
  const { user, logout } = useAuthStore();
  const { setMobileNavOpen } = useUIStore();
  const { pathname } = useLocation();
  useEffect(() => { setMobileNavOpen(false); }, [pathname, setMobileNavOpen]);
  if (!user) return null;

  return (
    <header className="flex h-12 items-center gap-3 border-b border-border-subtle bg-surface-1 px-3 sm:px-4 shrink-0 min-w-0">
      <button type="button" className="lg:hidden rounded-md p-1.5 text-text-secondary hover:bg-surface-2" aria-label="Open navigation"
        onClick={() => setMobileNavOpen(true)}>
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-x-3 text-sm">
        <span className="font-semibold text-text-primary truncate" data-testid="current-user">{user.display_name}</span>
        <span className="hidden sm:inline text-text-secondary whitespace-nowrap">{roleLabel(user.role)}</span>
        <span className="hidden md:inline-flex items-center gap-1 text-text-secondary whitespace-nowrap">
          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />{user.jurisdiction}
        </span>
      </div>
      <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-text-secondary whitespace-nowrap" title="Phone numbers and account numbers are masked by the server unless revealed with a recorded reason">
        <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> Sensitive values masked
      </span>
      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => logout()} aria-label="Sign out">
        <LogOut className="h-4 w-4" aria-hidden="true" />
        <span className="hidden md:inline">Sign out</span>
      </Button>
    </header>
  );
}
