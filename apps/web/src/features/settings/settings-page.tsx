import { useState } from "react";
import { ShieldCheck, HardDrive, FileTerminal, RotateCcw, LockKeyhole } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";

export function SettingsPage() {
  const { user } = useAuthStore();

  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const handleResetSession = () => {
    setResetMessage("Demonstration session state refreshed to factory defaults.");
    setTimeout(() => setResetMessage(null), 3000);
  };

  if (!user) return null;

  return (
    <div className="p-6 max-w-4xl mx-auto pb-20 lg:pb-6 space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold font-mono tracking-tight text-text-primary flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-electric-blue" />
            WORKSTATION SETTINGS & DIAGNOSTICS
          </h1>
          <p className="text-xs text-text-secondary mt-1">Configure local environment variables and system overrides</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-surface-1 border border-border-subtle rounded-lg overflow-hidden">
            <div className="border-b border-border-subtle bg-surface-2 px-4 py-2.5">
              <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-text-primary">Current Operator Profile</h2>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded bg-surface-3 border border-border-strong flex items-center justify-center shrink-0">
                  <UserAvatar fallback={user.username.substring(0, 2).toUpperCase()} />
                </div>
                <div>
                  <p className="text-text-primary font-semibold text-sm">{user.display_name}</p>
                  <p className="text-text-primary font-semibold text-sm">{user.username}</p>
                  <p className="text-electric-blue-soft font-semibold">{user.role}</p>
                </div>
              </div>
              <div className="space-y-1.5 pt-3 border-t border-border-subtle text-xs">
                <div className="flex justify-between">
                  <span className="text-text-muted">Jurisdiction:</span>
                  <span className="font-mono text-text-primary">{user.jurisdiction}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
           <div className="bg-surface-1 border border-border-subtle rounded-lg overflow-hidden opacity-75">
             <div className="border-b border-border-subtle bg-surface-2 px-4 py-2.5">
               <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-text-primary flex items-center gap-2">
                 <HardDrive className="h-3.5 w-3.5" />
                 Local Storage Management
               </h2>
             </div>
             <div className="p-4">
               <p className="text-sm text-text-secondary mb-4 leading-relaxed">
                 DRISTI-NET caches graph representations and offline evidence slices locally to ensure workstation performance during bandwidth-degraded field operations.
               </p>
               
               <div className="flex gap-3">
                 <Button variant="secondary" onClick={handleResetSession} className="text-xs h-8">
                   <RotateCcw className="h-3.5 w-3.5 mr-2" />
                   Clear Local Cache
                 </Button>
               </div>
               {resetMessage && <p className="text-verified-emerald text-xs mt-3 font-mono">{resetMessage}</p>}
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function UserAvatar({ fallback }: { fallback: string }) {
  return <span className="font-mono text-xs font-bold text-text-muted">{fallback}</span>;
}
