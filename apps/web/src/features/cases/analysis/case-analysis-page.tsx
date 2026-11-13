import { useEffect, useState } from "react";
import { useCase } from "../case-context";
import { GitBranch, Users, Repeat, RefreshCw, Network, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CaseTabBody, EmptyState, ErrorState, LoadingState, Section } from "@/components/layout/page";
import { getCaseAnalysis } from "@/services/api/casesApi";

const KIND_LABEL: Record<string, string> = {
  PERSON: "Person", ORGANIZATION: "Organization", PHONE: "Phone", ACCOUNT: "Account", VEHICLE: "Vehicle",
  LOCATION: "Location", DEVICE: "Device", EVENT: "Event", CASE: "Case",
};
const kindLabel = (k: string) => KIND_LABEL[k] ?? k;

/** Entity type in a fixed-width column, so a long type ("Organization") never runs into the name (P2.1). */
function KindBadge({ kind }: { kind: string }) {
  return <Badge tone="neutral" className="w-24 shrink-0 justify-center">{kindLabel(kind)}</Badge>;
}

/**
 * Patterns tab (P2.1): the shared tab layout and section cards, plain-language headings with the technical measure as
 * secondary text (design system §1.5), the shared loading/error/empty states, tokens instead of palette colours.
 * The analysis is unchanged: the same /cases/{id}/analysis response, masked by the server.
 */
export function CaseAnalysisPage() {
  const { caseId } = useCase();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    if (!caseId) return;
    setIsLoading(true);
    setError("");
    getCaseAnalysis(caseId)
      .then((r) => setData(r.data))
      .catch((e) => setError(e.message || "Failed to load analysis"))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { load(); }, [caseId]);

  const degree = (data?.degree || []).slice(0, 8);
  const maxDegree = Math.max(1, ...degree.map((n: any) => n.degree || 0));
  const bridges = data?.bridge_candidates || [];
  const communities = data?.communities || [];
  const rules = data?.rules || [];

  return (
    <CaseTabBody title="Patterns"
      description="Structural observations from the case graph: well-connected entities, possible bridges between groups, groups and repeated activity. They are review priorities, not findings about any person."
      actions={<Button variant="secondary" size="sm" className="gap-1.5" onClick={load} disabled={isLoading}>
        <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "motion-safe:animate-spin" : ""}`} aria-hidden="true" /> Refresh
      </Button>}>
      {error ? <ErrorState message={error} onRetry={load} />
        : isLoading || !data ? <LoadingState label="Analysing the case graph…" rows={4} />
        : (
          <>
            <Section id="most-connected" icon={<Hash className="h-4 w-4" />} title="Most connected entities"
              description="Entities with the most distinct links in the case graph (degree centrality).">
              {degree.length === 0 ? <EmptyState title="No connected entities yet" /> : (
                <ol className="space-y-2">
                  {degree.map((n: any) => (
                    <li key={n.entity_id} className="flex items-center gap-3 text-sm">
                      <KindBadge kind={n.kind} />
                      <span className="min-w-0 flex-1 truncate text-text-primary">{n.label}</span>
                      <span className="hidden sm:block h-2 rounded-full bg-electric-blue/30" style={{ width: `${Math.round(((n.degree || 0) / maxDegree) * 120)}px` }} aria-hidden="true" />
                      <span className="w-16 shrink-0 text-right text-xs text-text-secondary"><span className="font-mono text-text-primary">{n.degree}</span> links</span>
                    </li>
                  ))}
                </ol>
              )}
            </Section>

            <Section id="bridges" icon={<GitBranch className="h-4 w-4" />} title="Possible bridges between groups"
              description="Entities that connect otherwise separate groups (betweenness centrality). Worth checking, not evidence of a role.">
              {bridges.length === 0 ? <EmptyState title="No bridges between groups detected" /> : (
                <ul className="divide-y divide-border-subtle">
                  {bridges.map((n: any) => (
                    <li key={n.entity_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                      <KindBadge kind={n.kind} />
                      <span className="min-w-0 flex-1 truncate text-text-primary">{n.label}</span>
                      <span className="text-xs text-text-secondary">
                        links <strong className="text-text-primary">{Array.isArray(n.touches_communities) ? n.touches_communities.length : (n.touches_communities ?? "—")}</strong> groups
                        <span className="mx-1.5" aria-hidden="true">·</span>
                        betweenness <strong className="font-mono text-text-primary">{(n.betweenness || 0).toFixed(3)}</strong>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section id="groups" icon={<Users className="h-4 w-4" />} title={`Groups (${communities.length})`}
              description="Entities more connected to each other than to the rest (community detection, greedy modularity).">
              {communities.length === 0 ? <EmptyState title="No groups detected" /> : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {communities.map((comm: any, idx: number) => (
                    <div key={idx} className="rounded-md border border-border-subtle bg-surface-2 p-3 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-text-primary">Group {idx + 1}</span>
                        <span className="text-xs text-text-secondary">{comm.size ?? (comm.members || []).length} members</span>
                      </div>
                      <ul className="flex flex-wrap gap-1">
                        {(comm.members || []).slice(0, 5).map((m: any) => (
                          <li key={m.entity_id} className="max-w-[160px] truncate rounded border border-border-subtle bg-surface-1 px-1.5 py-0.5 font-mono text-xs text-text-secondary" title={m.label}>{m.label}</li>
                        ))}
                        {(comm.members || []).length > 5 && <li className="text-xs text-text-secondary">+{(comm.members || []).length - 5} more</li>}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {rules.length > 0 && (
              <Section id="repeated" icon={<Repeat className="h-4 w-4" />} title={`Repeated activity to review (${rules.length})`}
                description="Rule-based patterns in the case data. Each is a lead for review, not a conclusion.">
                <ul className="space-y-2">
                  {rules.map((r: any, idx: number) => (
                    <li key={idx} className="flex items-start gap-2 rounded-md border border-amber/40 bg-amber/10 px-3 py-2 text-sm">
                      <Badge tone="amber" className="shrink-0">Review</Badge>
                      <span><span className="font-semibold text-text-primary">{r.rule}</span>{r.subject && <span className="text-text-secondary"> · {r.subject}</span>}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {data.language_note && (
              <p className="flex items-center gap-2 rounded-md border border-border-subtle bg-surface-2 px-4 py-2 text-xs text-text-secondary">
                <Network className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {data.language_note}
              </p>
            )}
          </>
        )}
    </CaseTabBody>
  );
}
