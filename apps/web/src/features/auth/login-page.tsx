import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ShieldAlert, LogIn, Key, User, Server } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { Button } from "../../components/ui/button";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {  login } = useAuthStore();
  // Return to the page that required sign-in (ProtectedRoute stores it); only same-app paths, never an external URL.
  const params = new URLSearchParams(location.search);
  const from = (location.state as any)?.from;
  const candidate = typeof from?.pathname === "string" ? `${from.pathname}${from.search || ""}` : params.get("next") || "";
  const returnTo = /^\/(?!\/)/.test(candidate) && !candidate.startsWith("/login") && !candidate.includes("\\") ? candidate : "/";
  const expired = params.get("expired") === "1";
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Credentials required.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    
    try {
      const result = await login(username, password);
      if (result.success) {
        navigate(returnTo, { replace: true });
      } else {
        setError(result.error || "Authentication failed");
      }
    } catch (e: any) {
      setError("An unexpected error occurred during login.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Brand panel: what the system is for, in the project's neutral language */}
      <aside className="relative hidden overflow-hidden bg-[#0f2a3d] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        {/* decorative rings: plain borders, drawn identically by every engine (blurred shapes were not) */}
        <div className="pointer-events-none absolute -right-28 -top-28 h-96 w-96 rounded-full border-[40px] border-[#2b8f8b]/15" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-64 -left-32 h-[28rem] w-[28rem] rounded-full border-[56px] border-[#5fc4bd]/10" aria-hidden="true" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#21706e] bg-gradient-to-br from-[#2b8f8b] to-[#1b5e5c] shadow-lg" aria-hidden="true">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <p className="text-lg font-bold tracking-wide">DRISTI&#8209;NET</p>
            <p className="text-sm text-[#9fb4c3]">Evidence-linked case review</p>
          </div>
        </div>
        <div className="relative max-w-md space-y-6">
          <h2 className="text-3xl font-semibold leading-tight" style={{ color: "#ffffff" }}>Review relationships across authorised cases, with every link traced to its source.</h2>
          <ul className="space-y-4 text-[15px] text-[#d6e2ea]">
            {[
              ["Evidence-linked", "Each candidate relationship opens the exact line of the file it came from."],
              ["Human decisions", "Nothing is merged without a recorded reason; every decision can be reversed."],
              ["Accountable", "Access, reveals and exports are written to a signed audit log."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#5fc4bd]" aria-hidden="true" />
                <span><strong className="text-white">{t}.</strong> {d}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-[#9fb4c3]">Synthetic demonstration data only · not for operational use</p>
      </aside>

      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#21706e] bg-gradient-to-br from-[#2b8f8b] to-[#1b5e5c] text-white" aria-hidden="true">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-bold text-text-primary">DRISTI&#8209;NET</p>
              <p className="text-xs text-text-secondary">Evidence-linked case review</p>
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-text-primary">Sign in</h1>
          <p className="mt-1 text-sm text-text-secondary">Use the account issued to you. Every sign-in, successful or not, is recorded in the audit log.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-2xl border border-border-subtle bg-surface-1 p-6 shadow-[0_1px_2px_rgba(16,42,61,0.06),0_8px_24px_rgba(16,42,61,0.06)]">
            {expired && !error && (
              <div role="status" className="rounded-md border border-amber/40 bg-amber/10 p-3 text-sm text-text-primary">
                Your session expired. Sign in again to return to the page you were on.
              </div>
            )}
            {error && (
              <div role="alert" className="rounded-md border border-critical-red/30 bg-critical-red/5 p-3 text-sm font-medium text-critical-red">
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <label htmlFor="officer-id" className="text-sm font-medium text-text-primary">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
                <input id="officer-id" type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                  className="h-11 w-full rounded-lg border border-border-strong bg-surface-1 pl-9 pr-3 text-sm focus:border-electric-blue focus:outline-none focus:ring-2 focus:ring-electric-blue-soft"
                  autoCapitalize="none" autoComplete="username" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-text-primary">Password</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
                <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  className="h-11 w-full rounded-lg border border-border-strong bg-surface-1 pl-9 pr-3 text-sm focus:border-electric-blue focus:outline-none focus:ring-2 focus:ring-electric-blue-soft"
                  autoComplete="current-password" required />
              </div>
            </div>
            <Button type="submit" variant="primary" disabled={isSubmitting} className="h-11 w-full gap-2 text-sm font-semibold">
              {isSubmitting ? (
                <><div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" /><span>Signing in…</span></>
              ) : (
                <><LogIn className="h-4 w-4" aria-hidden="true" /><span>Sign in</span></>
              )}
            </Button>
          </form>
          {/* FE-010: the demo password used to be printed here; demo accounts are documented in the README only. */}
          <p className="mt-6 flex items-center gap-1.5 text-xs text-text-secondary"><Server className="h-3.5 w-3.5" aria-hidden="true" />Authorised users of this synthetic demonstration only.</p>
        </div>
      </main>
    </div>
  );
}
