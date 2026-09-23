import { Bell, Eye, EyeOff, Lock, MapPin, ShieldCheck, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";

interface StatusSegmentProps {
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

function StatusSegment({ icon, children, className }: StatusSegmentProps) {
  return (
    <div className={cn("flex items-center gap-1.5 text-xs text-text-secondary whitespace-nowrap", className)}>
      {icon}
      <span className="font-medium tracking-wide">{children}</span>
    </div>
  );
}

function SecurityStatusBar() {
  const navigate = useNavigate();
  const { 
    user,
    piiMasked,
    logout,
  } = useAuthStore();

  const zeroTrustActive = true;

  if (!user) return null;

  return (
    <header className="flex h-10 items-center border-b border-border-subtle bg-surface-1 px-4 w-full min-w-0 shrink-0 overflow-hidden select-none">
      <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden text-xs">
        <StatusSegment icon={<UserRound className="h-3.5 w-3.5 text-text-muted shrink-0" />}>
          <span className="font-semibold text-text-primary">{user.display_name} ({user.role})</span>
        </StatusSegment>

        <Separator orientation="vertical" className="h-3.5" />

        <StatusSegment icon={<ShieldCheck className="h-3.5 w-3.5 text-text-muted shrink-0" />}>
          <span>{user.role}</span>
        </StatusSegment>

        <Separator orientation="vertical" className="h-3.5 hidden md:block" />

        <StatusSegment
          icon={<MapPin className="h-3.5 w-3.5 text-text-muted shrink-0" />}
          className="hidden md:flex"
        >
          <span>{user.jurisdiction}</span>
        </StatusSegment>
      </div>

      <div className="flex shrink-0 items-center gap-2.5 pl-3">
        <Separator orientation="vertical" className="h-3.5" />

        <StatusSegment
          icon={
            piiMasked ? (
              <EyeOff className="h-3.5 w-3.5 text-amber shrink-0" />
            ) : (
              <Eye className="h-3.5 w-3.5 text-critical-red shrink-0" />
            )
          }
          className={piiMasked ? "text-amber font-semibold" : "text-critical-red font-semibold"}
        >
          <span className="hidden sm:inline">{piiMasked ? "PII MASKED (STRICT)" : "PII REVEALED"}</span>
        </StatusSegment>

        <Separator orientation="vertical" className="h-3.5" />

        <StatusSegment
          icon={
            <span
              className={cn(
                "inline-block h-2 w-2 rounded-full shrink-0",
                zeroTrustActive ? "bg-verified-emerald" : "bg-critical-red",
              )}
            />
          }
          className={zeroTrustActive ? "text-text-secondary" : "text-critical-red font-semibold"}
        >
          <span className="hidden lg:inline text-xs">
            {zeroTrustActive ? "Zero-Trust Active" : "Policy Engine Down"}
          </span>
        </StatusSegment>

        <Separator orientation="vertical" className="h-3.5" />

        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Notifications">
          <Bell className="h-3.5 w-3.5 text-text-secondary" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-2"
          aria-label="Lock workstation session"
          onClick={() => {
            logout();
            navigate("/login");
          }}
        >
          <Lock className="h-3 w-3 mr-1" />
          <span className="hidden lg:inline">Lock</span>
        </Button>
      </div>
    </header>
  );
}

export { SecurityStatusBar };
