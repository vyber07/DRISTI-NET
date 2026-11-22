import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, LogOut, Minus, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FactList, PageBody, PageHeader, Section } from "@/components/layout/page";
import { useAuthStore } from "@/stores/authStore";
import { ALL_CAPABILITIES, CAPABILITY_TEXT, can, roleLabel } from "@/lib/permissions";
import { listCases } from "@/services/api/casesApi";
import type { CaseSummary } from "@/types/case";

/**
 * Account page (merges the old Profile and Settings pages).
 * Removed: four action cards whose handlers were `() => {}`, a "PII masking" switch that only changed a client flag
 * (the server masks regardless), and Settings' "reset session" button that showed a fake success message.
 */
export function ProfilePage() {
  const { user, logout } = useAuthStore();
  const [cases, setCases] = useState<CaseSummary[] | null>(null);
  const [casesError, setCasesError] = useState<string | null>(null);

  useEffect(() => {
    listCases().then((r) => setCases(r.data)).catch((e) => setCasesError(e?.message || "unavailable"));
  }, []);

  if (!user) return null;
  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <PageHeader icon={<UserRound className="h-5 w-5" />} title="Account" description="Who you are signed in as and what your role allows." />
      <PageBody>
        <Section title="Signed in as">
          <FactList columns={2} items={[
            { label: "Name", value: user.display_name },
            { label: "Username", value: <span className="font-mono">{user.username}</span> },
            { label: "Role", value: roleLabel(user.role) },
            { label: "Jurisdiction", value: user.jurisdiction },
            { label: "User ID", value: <span className="font-mono text-xs">{user.user_id}</span> },
          ]} />
        </Section>

        <Section title="What your role allows" description="The server checks every request; this list explains why some buttons are unavailable to you.">
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {ALL_CAPABILITIES.map((c) => {
              const ok = can(user.role, c);
              return (
                <li key={c} className="flex items-start gap-2 text-sm">
                  {ok ? <Check className="h-4 w-4 text-verified-emerald mt-0.5 shrink-0" aria-hidden="true" />
                      : <Minus className="h-4 w-4 text-text-muted mt-0.5 shrink-0" aria-hidden="true" />}
                  <span className={ok ? "text-text-primary" : "text-text-secondary"}>
                    {CAPABILITY_TEXT[c]}<span className="sr-only">{ok ? " — allowed" : " — not allowed"}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </Section>

        <Section title="Your cases" description="Cases are visible only through assignment within your jurisdiction (administrators and auditors see all).">
          {casesError ? <p className="text-sm text-text-secondary">Case list unavailable: {casesError}</p>
            : cases === null ? <p className="text-sm text-text-secondary">Loading…</p>
            : cases.length === 0 ? <p className="text-sm text-text-secondary">No cases are assigned to you.</p>
            : (
              <ul className="divide-y divide-border-subtle">
                {cases.map((c) => (
                  <li key={c.id} className="py-2 flex items-center justify-between gap-3">
                    <Link to={`/cases/${encodeURIComponent(c.id)}`} className="text-sm text-electric-blue hover:underline min-w-0 truncate">
                      {c.title} <span className="font-mono text-xs text-text-secondary">{c.id}</span>
                    </Link>
                    <span className="text-xs text-text-secondary shrink-0">{c.jurisdiction}</span>
                  </li>
                ))}
              </ul>
            )}
        </Section>

        <Section title="Session">
          <p className="text-sm text-text-secondary mb-3">
            Signing out clears this browser's session and every loaded case view. Your session token is kept in this browser's local storage until you sign out.
          </p>
          <Button variant="secondary" className="gap-1.5" onClick={() => logout()}>
            <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
          </Button>
        </Section>
      </PageBody>
    </div>
  );
}
