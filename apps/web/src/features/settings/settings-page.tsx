import { useState } from "react";
import {
  Settings,
  ShieldCheck,
  User,
  Lock,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";

export function SettingsPage() {
  const {
    fullName,
    badgeNumber,
    roleLabel,
    jurisdiction,
    clearanceLevel,
  } = useAuthStore();

  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const handleResetSession = () => {
    setResetMessage("Demonstration session state refreshed to factory defaults.");
    setTimeout(() => setResetMessage(null), 3000);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-background overflow-hidden">
      {/* Top Header */}
      <header className="flex h-14 items-center justify-between border-b border-border-subtle bg-surface-1 px-5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-surface-3 border border-border-strong text-text-secondary">
            <Settings className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-text-primary">
                System Configuration &amp; Security Policy Management
              </h1>
              <Badge tone="blue" className="text-micro font-mono">
                CLEARANCE LEVEL {clearanceLevel}
              </Badge>
              <Badge tone="emerald" className="text-micro font-mono">
                ZERO-TRUST ACTIVE
              </Badge>
            </div>
            <p className="text-micro font-mono text-text-muted mt-0.5">
              Analyst Workstation Environment &bull; Rajasthan Police Cyber Command
            </p>
          </div>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={handleResetSession}
          className="text-xs font-mono gap-1.5"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Reset Demo Session</span>
        </Button>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6 max-w-5xl mx-auto w-full space-y-6">
        {resetMessage && (
          <div className="rounded-md border border-verified-emerald/50 bg-verified-emerald/10 p-3 flex items-center gap-2 text-xs text-verified-emerald">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{resetMessage}</span>
          </div>
        )}

        {/* 1. Officer Profile & Credential Tile */}
        <div className="rounded-lg border border-border-subtle bg-surface-1 p-5 space-y-4 shadow-panel">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <User className="h-4 w-4 text-electric-blue-soft" />
              <span>Investigating Officer Profile</span>
            </div>
            <Badge tone="blue" className="font-mono text-micro">
              AUTH USR-9921
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div className="rounded bg-surface-2 p-3 border border-border-subtle space-y-1">
              <span className="text-micro text-text-muted uppercase">Officer Name</span>
              <p className="text-text-primary font-semibold text-sm">{fullName}</p>
            </div>
            <div className="rounded bg-surface-2 p-3 border border-border-subtle space-y-1">
              <span className="text-micro text-text-muted uppercase">Official Badge Number</span>
              <p className="text-text-primary font-semibold text-sm">{badgeNumber}</p>
            </div>
            <div className="rounded bg-surface-2 p-3 border border-border-subtle space-y-1">
              <span className="text-micro text-text-muted uppercase">Role Assignment</span>
              <p className="text-electric-blue-soft font-semibold">{roleLabel}</p>
            </div>
            <div className="rounded bg-surface-2 p-3 border border-border-subtle space-y-1">
              <span className="text-micro text-text-muted uppercase">Jurisdiction Boundary</span>
              <p className="text-text-primary font-semibold">{jurisdiction}</p>
            </div>
          </div>
        </div>

        {/* 2. Privacy by Default & PII Masking Controls */}
        <div className="rounded-lg border border-border-subtle bg-surface-1 p-5 space-y-4 shadow-panel">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <Lock className="h-4 w-4 text-amber" />
              <span>Privacy by Default &amp; PII Protection (Spec P4)</span>
            </div>
            <Badge tone="amber" className="font-mono text-micro">
              ENFORCED BY POLICY
            </Badge>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded bg-surface-2 border border-border-subtle">
              <div>
                <span className="font-semibold text-text-primary block">Default PII Masking</span>
                <p className="text-micro text-text-muted">
                  All MSISDNs, Aadhaar numbers, PANs, and IMEI suffixes are masked by default across all views.
                </p>
              </div>
              <Badge tone="emerald" className="font-mono text-micro">LOCKED ON</Badge>
            </div>

            <div className="flex items-center justify-between p-3 rounded bg-surface-2 border border-border-subtle">
              <div>
                <span className="font-semibold text-text-primary block">Justification-Gated Reveal</span>
                <p className="text-micro text-text-muted">
                  Unmasking requires session-only authorization, statutory legal reason, and permanent audit entry.
                </p>
              </div>
              <Badge tone="emerald" className="font-mono text-micro">ACTIVE</Badge>
            </div>
          </div>
        </div>

        {/* 3. Evidence Tiers & Ground Truth Guardrails */}
        <div className="rounded-lg border border-border-subtle bg-surface-1 p-5 space-y-4 shadow-panel">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <ShieldCheck className="h-4 w-4 text-verified-emerald" />
              <span>Forensic Provenance &amp; Evidence Ground Truth</span>
            </div>
            <Badge tone="emerald" className="font-mono text-micro">
              TAMPER-EVIDENT ACTIVE
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-3 rounded bg-surface-2 border border-border-subtle space-y-1">
              <span className="text-micro text-text-muted uppercase">SHA-256 Check</span>
              <p className="text-verified-emerald font-semibold">Continuous Verification</p>
            </div>
            <div className="p-3 rounded bg-surface-2 border border-border-subtle space-y-1">
              <span className="text-micro text-text-muted uppercase">Provenance Speed</span>
              <p className="text-electric-blue-soft font-semibold">&lt; 400ms 1-Click Trace</p>
            </div>
            <div className="p-3 rounded bg-surface-2 border border-border-subtle space-y-1">
              <span className="text-micro text-text-muted uppercase">Evidence Tiers</span>
              <p className="text-text-primary font-semibold">Tiers 2–6 Supported</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
