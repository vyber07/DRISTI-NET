import { useNavigate } from "react-router-dom";
import {
  User,
  ShieldCheck,
  Settings,
  LogOut,
  KeyRound,
  BadgeCheck,
  MapPin,
  Hash,
  Briefcase,
  ChevronRight,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";

const ROLE_META: Record<string, { label: string; color: string; description: string }> = {
  INVESTIGATOR:     { label: "Investigator",     color: "blue",   description: "Full case access: graph, evidence, reports" },
  EVIDENCE_OFFICER: { label: "Evidence Officer", color: "amber",  description: "Upload, quarantine, hash verification, scan gate" },
  REVIEWER:         { label: "Reviewer",         color: "purple", description: "Accept / reject / defer / reverse candidates" },
  ANALYST:          { label: "Analyst",          color: "cyan",   description: "Analysis, timeline, graph intelligence" },
  AUDITOR:          { label: "Auditor",          color: "green",  description: "Global audit trail access, read-only" },
  ADMIN:            { label: "Administrator",    color: "red",    description: "Full platform administration, assignments" },
};

function AvatarCircle({ initials, role }: { initials: string; role: string }) {
  const colorMap: Record<string, string> = {
    blue: "bg-electric-blue/20 text-electric-blue border-electric-blue/30",
    amber: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    purple: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    cyan: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    green: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    red: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  const meta = ROLE_META[role];
  const colorClass = meta ? (colorMap[meta.color] ?? colorMap.blue) : colorMap.blue;
  return (
    <div className={cn(
      "h-20 w-20 rounded-full border-2 flex items-center justify-center shrink-0 select-none",
      colorClass
    )}>
      <span className="font-mono text-2xl font-bold">{initials}</span>
    </div>
  );
}

function ActionCard({
  icon: Icon,
  label,
  description,
  onClick,
  variant = "default",
}: {
  icon: typeof User;
  label: string;
  description: string;
  onClick?: () => void;
  variant?: "default" | "danger";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 rounded-lg border p-4 text-left transition-all duration-150 group",
        variant === "danger"
          ? "border-red-500/20 bg-red-500/5 hover:bg-red-500/10 hover:border-red-500/40"
          : "border-border-subtle bg-surface-1 hover:bg-surface-2 hover:border-border-strong"
      )}
    >
      <div className={cn(
        "h-9 w-9 rounded-md flex items-center justify-center shrink-0",
        variant === "danger"
          ? "bg-red-500/10 text-red-400"
          : "bg-electric-blue/10 text-electric-blue"
      )}>
        <Icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm font-semibold",
          variant === "danger" ? "text-red-400" : "text-text-primary"
        )}>{label}</p>
        <p className="text-xs text-text-muted mt-0.5">{description}</p>
      </div>
      <ChevronRight className={cn(
        "h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5",
        variant === "danger" ? "text-red-400/60" : "text-text-muted"
      )} />
    </button>
  );
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout, piiMasked, setPiiMasked } = useAuthStore();

  if (!user) return null;

  const meta = ROLE_META[user.role] ?? { label: user.role, color: "blue", description: "" };
  const initials = user.display_name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-full flex-col bg-bg-base overflow-y-auto">
      {/* Header */}
      <div className="shrink-0 border-b border-border-subtle bg-surface-1 px-5 py-3.5 flex items-center gap-2">
        <User className="h-4 w-4 text-electric-blue-soft" />
        <h2 className="text-sm font-bold font-mono tracking-wide uppercase text-text-primary">
          Operator Profile
        </h2>
      </div>

      <div className="flex-1 p-5 max-w-3xl mx-auto w-full space-y-6 pb-12">

        {/* Identity Card */}
        <div className="bg-surface-1 border border-border-subtle rounded-xl overflow-hidden">
          <div className="bg-gradient-to-r from-electric-blue/5 to-transparent border-b border-border-subtle px-6 py-5">
            <div className="flex items-center gap-5 flex-wrap">
              <AvatarCircle initials={initials} role={user.role} />
              <div className="flex-1 min-w-0 space-y-1">
                <h1 className="text-xl font-bold text-text-primary truncate">{user.display_name}</h1>
                <p className="text-sm font-mono text-text-secondary">@{user.username}</p>
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <Badge tone="blue" className="font-mono text-xs px-2 py-0.5 flex items-center gap-1">
                    <BadgeCheck className="h-3 w-3" />
                    {meta.label}
                  </Badge>
                  <span className="text-xs text-text-muted">{meta.description}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Details grid */}
          <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <Hash className="h-4 w-4 text-text-muted mt-0.5 shrink-0" />
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-text-muted">User ID</p>
                <p className="text-xs font-mono text-text-primary mt-0.5">{user.user_id}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 text-text-muted mt-0.5 shrink-0" />
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-text-muted">Jurisdiction</p>
                <p className="text-xs font-mono text-text-primary mt-0.5">{user.jurisdiction}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-4 w-4 text-text-muted mt-0.5 shrink-0" />
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-text-muted">Access Role</p>
                <p className="text-xs font-mono text-text-primary mt-0.5">{user.role}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Briefcase className="h-4 w-4 text-text-muted mt-0.5 shrink-0" />
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-text-muted">Assigned Cases</p>
                <p className="text-xs font-mono text-text-primary mt-0.5">
                  {user.assigned_cases?.length ?? "—"} cases
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* PII Masking toggle */}
        <div className="bg-surface-1 border border-border-subtle rounded-xl px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-amber-500/10 flex items-center justify-center shrink-0">
              {piiMasked ? <EyeOff className="h-4 w-4 text-amber-400" /> : <Eye className="h-4 w-4 text-amber-400" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">PII Masking</p>
              <p className="text-xs text-text-muted">
                {piiMasked
                  ? "Sensitive identity fields are masked. Click Reveal to expose individual fields."
                  : "PII masking is off — all identity fields are visible."}
              </p>
            </div>
          </div>
          <button
            onClick={() => setPiiMasked(!piiMasked)}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
              piiMasked ? "bg-electric-blue" : "bg-surface-3"
            )}
            role="switch"
            aria-checked={piiMasked}
            aria-label="Toggle PII masking"
          >
            <span className={cn(
              "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out",
              piiMasked ? "translate-x-5" : "translate-x-0"
            )} />
          </button>
        </div>

        <Separator />

        {/* Action buttons */}
        <div className="space-y-2">
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-text-muted px-1 pb-1">
            Account Actions
          </p>

          <ActionCard
            icon={User}
            label="Manage Profile"
            description="Update display name, contact details, and preferences"
            onClick={() => {}}
          />
          <ActionCard
            icon={Settings}
            label="Workstation Settings"
            description="Local cache, session preferences, diagnostics"
            onClick={() => navigate("/settings")}
          />
          <ActionCard
            icon={KeyRound}
            label="Change Password"
            description="Update your authentication credentials"
            onClick={() => {}}
          />
          <ActionCard
            icon={Lock}
            label="Security & Sessions"
            description="View active sessions, audit your own access log"
            onClick={() => {}}
          />
          <ActionCard
            icon={ShieldCheck}
            label="Role & Permissions"
            description={`You are ${meta.label} — ${meta.description}`}
            onClick={() => {}}
          />
        </div>

        <Separator />

        {/* Logout */}
        <div className="space-y-2">
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-text-muted px-1 pb-1">
            Session
          </p>
          <ActionCard
            icon={LogOut}
            label="Sign Out"
            description="End this investigation session and clear local credentials"
            onClick={handleLogout}
            variant="danger"
          />
        </div>

      </div>
    </div>
  );
}
