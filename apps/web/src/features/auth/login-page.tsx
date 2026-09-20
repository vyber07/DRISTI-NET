import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  UserRound,
  Compass,
  AlertTriangle,
  ArrowRight,
  Fingerprint,
  Radio,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuthStore, DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/stores/authStore";

export function LoginPage() {
  const { isAuthenticated, login } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  // If redirected from a protected route, preserve target deep-link
  const from = (location.state as { from?: { pathname?: string; search?: string } })?.from;
  const targetPath = from ? `${from.pathname || ""}${from.search || ""}` : "/command-center";

  const [officerId, setOfficerId] = useState("USR-9921");
  const [password, setPassword] = useState("dristi2026");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [selectedBadge, setSelectedBadge] = useState("USR-9921");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already authenticated, redirect to destination
  useEffect(() => {
    if (isAuthenticated) {
      navigate(targetPath || "/command-center", { replace: true });
    }
  }, [isAuthenticated, navigate, targetPath]);

  const handleSelectRole = (badgeNumber: string, autoLogin = false) => {
    const acc = DEMO_ACCOUNTS[badgeNumber];
    if (!acc) return;
    setSelectedBadge(badgeNumber);
    setOfficerId(acc.badgeNumber);
    setPassword(DEMO_PASSWORD);
    setError(null);

    if (autoLogin) {
      executeLogin(acc.badgeNumber, DEMO_PASSWORD);
    }
  };

  const executeLogin = async (id: string, pass: string) => {
    setIsSubmitting(true);
    setError(null);

    // Minor tactical latency simulation (180ms) for responsive feel
    await new Promise((r) => setTimeout(r, 180));

    const result = await login(id, pass, rememberMe);
    setIsSubmitting(false);

    if (result.success) {
      navigate(targetPath || "/command-center", { replace: true });
    } else {
      setError(result.error || "Authentication failed. Please verify credentials.");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeLogin(officerId, password);
  };

  return (
    <div className="min-h-screen w-full bg-[#070b11] text-text-primary flex flex-col justify-between selection:bg-electric-blue selection:text-white font-sans relative overflow-x-hidden">
      {/* Background Tactical Grid & Ambient Glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #ffffff 1px, transparent 1px),
            linear-gradient(to bottom, #ffffff 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-electric-blue/10 blur-[130px] rounded-full" />
      <div className="pointer-events-none absolute bottom-0 right-10 w-[450px] h-[300px] bg-verified-emerald/5 blur-[120px] rounded-full" />

      {/* Top Tactical Status Header */}
      <header className="relative z-10 w-full border-b border-border-subtle/80 bg-surface-1/90 backdrop-blur-md px-4 lg:px-8 py-2.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-electric-blue/15 border border-electric-blue/30 text-electric-blue">
            <Compass className="h-4 w-4" />
          </div>
          <div>
            <span className="font-mono text-[11px] uppercase tracking-widest text-text-muted">
              LAW ENFORCEMENT • INVESTIGATION &amp; INTELLIGENCE
            </span>
            <div className="flex items-center gap-2">
              <span className="font-semibold tracking-tight text-text-primary text-xs">
                DRISTI-NET
              </span>
              <span className="text-text-muted">•</span>
              <span className="text-[11px] font-mono text-text-secondary">
                SIH 2026 Prototype • Evaluation Environment
              </span>
            </div>
          </div>
        </div>

        {/* Global Security Badges */}
        <div className="hidden sm:flex items-center gap-2">
          <Badge tone="neutral" className="font-mono text-[10px] px-2 py-0.5">
            DRISTI-NET Local Mock Mode
          </Badge>
          <Badge tone="amber" className="font-mono text-[10px] px-2 py-0.5">
            PII Masking: Strict
          </Badge>
          <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 rounded border border-border-subtle bg-surface-2 text-[10px] font-mono text-text-muted">
            <Radio className="h-3 w-3 text-verified-emerald animate-pulse" />
            <span>Zero-Trust Access Model • Demo</span>
          </div>
        </div>
      </header>

      {/* Main Login Workspace Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 md:p-6 lg:p-8">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-6 bg-surface-1/95 border border-border-strong rounded-xl shadow-2xl overflow-hidden backdrop-blur-sm">
          
          {/* Left / Main Authentication Form (7 cols) */}
          <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-border-subtle">
            <div>
              {/* Station Emblem & Header */}
              <div className="flex items-center justify-between gap-4 mb-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-electric-blue/15 border border-electric-blue/40 flex items-center justify-center text-electric-blue shadow-inner">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold tracking-tight text-text-primary flex items-center gap-2">
                      Secure Intelligence Workstation
                    </h1>
                    <p className="text-xs text-text-muted font-mono">
                      Restricted Access Portal • Authorized Analysts Only
                    </p>
                  </div>
                </div>
              </div>

              {/* Error Banner */}
              {error && (
                <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-critical-red/40 bg-critical-red/10 p-3 text-xs text-critical-red animate-in fade-in slide-in-from-top-1 duration-200">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="flex-1 font-medium">{error}</div>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Officer ID Field */}
                <div>
                  <label
                    htmlFor="officer-id"
                    className="block text-xs font-mono font-medium text-text-secondary mb-1.5 uppercase tracking-wider"
                  >
                    Officer ID / Badge Number
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-text-muted">
                      <UserRound className="h-4 w-4" />
                    </div>
                    <input
                      id="officer-id"
                      type="text"
                      required
                      value={officerId}
                      onChange={(e) => {
                        setOfficerId(e.target.value);
                        setError(null);
                      }}
                      placeholder="e.g. USR-9921"
                      className="w-full rounded-lg border border-border-strong bg-surface-2 pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted font-mono focus:border-electric-blue focus:outline-none focus:ring-1 focus:ring-electric-blue transition-colors"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="password"
                      className="block text-xs font-mono font-medium text-text-secondary uppercase tracking-wider"
                    >
                      Station Access Key / Password
                    </label>
                    <span className="text-[11px] font-mono text-text-muted">
                      Demo: <code className="text-electric-blue font-bold">{DEMO_PASSWORD}</code>
                    </span>
                  </div>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-text-muted">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError(null);
                      }}
                      placeholder="Enter workstation access key"
                      className="w-full rounded-lg border border-border-strong bg-surface-2 pl-9 pr-10 py-2 text-sm text-text-primary placeholder:text-text-muted font-mono focus:border-electric-blue focus:outline-none focus:ring-1 focus:ring-electric-blue transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-text-muted hover:text-text-primary focus:outline-none transition-colors"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Remember Station & Policy Note */}
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <Checkbox
                      checked={rememberMe}
                      onCheckedChange={(v) => setRememberMe(Boolean(v))}
                      id="remember-me"
                    />
                    <span className="text-xs text-text-secondary">
                      Remember this workstation session
                    </span>
                  </label>
                </div>

                {/* Sign In Button */}
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-2 h-10 bg-electric-blue hover:bg-electric-blue-dim text-white font-medium text-xs font-mono tracking-wide uppercase flex items-center justify-center gap-2 shadow-lg shadow-electric-blue/15 transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Authenticating Credentials...</span>
                    </>
                  ) : (
                    <>
                      <Fingerprint className="h-4 w-4" />
                      <span>Sign In to Tactical Workstation</span>
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </>
                  )}
                </Button>
              </form>
            </div>

            {/* Bottom Security Context Note */}
            <div className="mt-6 pt-4 border-t border-border-subtle text-[11px] text-text-muted space-y-1.5">
              <div className="flex items-center gap-2 text-text-secondary">
                <ShieldCheck className="h-3.5 w-3.5 text-verified-emerald shrink-0" />
                <span className="font-medium">Evidence Integrity • Demo Policy Mapping</span>
              </div>
              <p className="leading-relaxed">
                Workstation transactions and evidence graph queries are sealed with cryptographic
                hashes under <span className="text-text-secondary font-mono">BSA §63 — DEMO POLICY MAPPING</span> for demonstration auditing.
              </p>
            </div>
          </div>

          {/* Right Column: SIH 2026 Evaluation Role Selector (5 cols) */}
          <div className="lg:col-span-5 bg-surface-2/60 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-verified-emerald animate-pulse" />
                  <h2 className="text-xs font-bold font-mono tracking-wider uppercase text-text-primary">
                    Quick Demo Access
                  </h2>
                </div>
                <Badge tone="blue" className="text-[10px] font-mono">
                  SIH 2026 EVALUATION
                </Badge>
              </div>

              <p className="text-[11.5px] text-text-secondary mb-3 leading-relaxed">
                Select any verified investigator role to immediately populate test credentials and evaluate role-based clearance permissions:
              </p>

              {/* 4 Role Profile Cards */}
              <div className="space-y-2.5">
                {Object.values(DEMO_ACCOUNTS).map((account) => {
                  const isSelected = selectedBadge === account.badgeNumber;
                  return (
                    <div
                      key={account.badgeNumber}
                      onClick={() => handleSelectRole(account.badgeNumber, false)}
                      className={`group relative rounded-lg border p-2.5 text-left cursor-pointer transition-all duration-150 ${
                        isSelected
                          ? "border-electric-blue bg-electric-blue/10 shadow-sm"
                          : "border-border-subtle bg-surface-1 hover:border-border-strong hover:bg-surface-2"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-text-primary truncate">
                              {account.fullName}
                            </span>
                            <code className="text-[10px] font-mono px-1 py-0.2 rounded bg-surface-3 text-text-muted border border-border-subtle">
                              {account.badgeNumber}
                            </code>
                          </div>
                          <p className="text-[11px] font-medium text-electric-blue mt-0.5">
                            {account.roleLabel}
                          </p>
                          <p className="text-[10px] text-text-muted truncate mt-0.5">
                            {account.jurisdiction}
                          </p>
                        </div>

                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <Badge
                            tone={
                              account.clearanceLevel >= 4
                                ? "purple"
                                : account.clearanceLevel === 3
                                ? "emerald"
                                : "blue"
                            }
                            className="text-[9.5px] font-mono px-1.5 py-0"
                          >
                            CLR {account.clearanceLevel}
                          </Badge>
                          <Button
                            type="button"
                            size="sm"
                            variant={isSelected ? "primary" : "secondary"}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectRole(account.badgeNumber, true);
                            }}
                            className="h-6 px-2 text-[10px] font-mono"
                          >
                            Sign In
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

              {/* Interactive Demo Help Note */}
              <div className="mt-4 pt-3 border-t border-border-subtle/80 bg-surface-3/60 rounded-md p-2.5 border">
              <div className="flex items-center gap-1.5 text-text-primary text-[11px] font-semibold mb-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-verified-emerald" />
                <span>Evaluation Shortcut</span>
              </div>
              <p className="text-[10.5px] text-text-muted leading-relaxed">
                Click any profile card above to auto-fill Officer ID, or click its{" "}
                <span className="text-text-primary font-mono font-medium">"Sign In"</span> button to bypass typing and test immediately with clearance levels 2, 3, or 4.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer / Regulatory Notice */}
      <footer className="relative z-10 w-full border-t border-border-subtle/80 bg-surface-1/90 px-4 py-2.5 text-center text-[10.5px] text-text-muted flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-verified-emerald" />
          <span>DRISTI-NET Core Workstation • Air-Gapped Simulation Engine</span>
        </div>
        <div className="font-mono text-[10px] text-text-secondary">
          Cryptographic Audit Trail • Demo Environment • BUILD 2026.09.18
        </div>
      </footer>
    </div>
  );
}
