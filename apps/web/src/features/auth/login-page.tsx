import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, LogIn, Key, User, Server } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { Button } from "../../components/ui/button";

export function LoginPage() {
  const navigate = useNavigate();
  const {  login } = useAuthStore();
  
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
        navigate("/");
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
    <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center p-4">
      {/* Background Graphic */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 w-full h-[50vh] bg-gradient-to-b from-electric-blue/5 to-transparent border-b border-electric-blue/10" />
      </div>

      <div className="relative z-10 w-full max-w-md bg-surface-1 border border-border-subtle rounded-xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-border-subtle bg-surface-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-electric-blue text-white shadow-md">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-text-primary tracking-tight">DRISTI-NET</h1>
              <p className="text-xs text-text-secondary font-mono uppercase tracking-wider">Tactical Workstation</p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-md text-sm font-medium">
                {error}
              </div>
            )}
            
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider font-mono">
                Officer / User ID
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <input
                  id="officer-id"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full h-10 bg-surface-base border border-border-strong rounded-md pl-9 pr-3 text-sm focus:outline-none focus:border-electric-blue focus:ring-1 focus:ring-electric-blue transition-all"
                  placeholder="Enter User ID (e.g. investigator)"
                  autoCapitalize="none"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider font-mono">
                Station Key
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-10 bg-surface-base border border-border-strong rounded-md pl-9 pr-3 text-sm focus:outline-none focus:border-electric-blue focus:ring-1 focus:ring-electric-blue transition-all"
                  placeholder="Enter Station Key"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-10 mt-2 bg-electric-blue hover:bg-electric-blue-dim text-white font-medium text-xs font-mono tracking-wide uppercase flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              {isSubmitting ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  <span>Secure Login</span>
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-surface-2 border-t border-border-subtle flex items-center justify-between text-[11px] text-text-muted font-mono">
          <div className="flex items-center gap-1.5">
            <Server className="h-3.5 w-3.5" />
            <span>Connection Secure</span>
          </div>
          <span>v2.0 (Verified)</span>
        </div>
      </div>
      
      {/* Demo helper */}
      <div className="mt-8 text-center text-xs text-text-muted font-mono">
        Authorized SIH 2026 personnel only. <br/>
        Demo user example: <span className="text-text-primary">investigator</span> / <span className="text-text-primary">investigator-demo</span>
      </div>
    </div>
  );
}
