import { useId, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGraphStore } from "@/stores/graphStore";
import { recordedDateKey } from "@/lib/utils";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<string, string> = {
  PERSON: "Person", ORGANIZATION: "Organisation", LOCATION: "Location", EVENT: "Event", FINANCIAL: "Bank account", CYBER: "Phone / device",
};

/**
 * The relationship graph as tables: the accessible equivalent of the canvas (keyboard and screen readers cannot use the
 * WebGL canvas). Same data as the canvas; choosing a row selects it in the shared graph store, so the detail panel shows
 * its claims and each claim opens its exact source — exactly as a click in the canvas would.
 */
export function GraphListView() {
  const { nodes, edges, selectedNodeId, selectedEdgeId, selectNode, selectEdge } = useGraphStore();
  const [tab, setTab] = useState<"rel" | "ent">("rel");
  const [query, setQuery] = useState("");
  const searchId = useId();
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const t = query.trim().toLowerCase();

  const rels = useMemo(() => edges
    .map((e) => ({ e, s: byId.get(e.source), d: byId.get(e.target) }))
    .filter(({ e, s, d }) => !t || [s?.label, d?.label, e.relationshipType].some((x) => (x || "").toLowerCase().includes(t)))
    .sort((a, b) => b.e.count - a.e.count), [edges, byId, t]);
  const ents = useMemo(() => nodes
    .filter((n) => !t || n.label.toLowerCase().includes(t) || (KIND_LABEL[n.entityType] || n.entityType).toLowerCase().includes(t))
    .sort((a, b) => b.degree - a.degree), [nodes, t]);

  const day = (x: string | null) => (x ? recordedDateKey(x) ?? x : "—");

  return (
    <div className="h-full overflow-y-auto p-4 space-y-3" data-testid="graph-list-view">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div role="tablist" aria-label="List contents" className="inline-flex gap-1 rounded-lg bg-surface-2 p-1">
          {([["rel", `Relationships (${edges.length})`], ["ent", `Entities (${nodes.length})`]] as const).map(([id, label]) => (
            <button key={id} role="tab" type="button" aria-selected={tab === id} onClick={() => setTab(id)}
              className={cn("rounded-md px-3 py-1.5 text-sm", tab === id ? "bg-surface-1 font-semibold shadow-xs" : "text-text-secondary hover:text-text-primary")}>{label}</button>
          ))}
        </div>
        <div className="min-w-[14rem]">
          <label htmlFor={searchId} className="sr-only">Filter the list</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <input id={searchId} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by name or type"
              className="w-full rounded-md border border-border-strong bg-surface-1 py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-electric-blue-soft" />
          </div>
        </div>
      </div>

      {tab === "rel" ? (
        <div className="overflow-x-auto rounded-lg border border-border-subtle bg-surface-1">
          <table className="w-full text-sm" data-testid="graph-relationships-table">
            <caption className="sr-only">Candidate relationships in this case, most claims first</caption>
            <thead className="bg-surface-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
              <tr>
                <th scope="col" className="px-3 py-2">From</th><th scope="col" className="px-3 py-2">Relationship</th><th scope="col" className="px-3 py-2">To</th>
                <th scope="col" className="px-3 py-2 text-right">Claims</th><th scope="col" className="px-3 py-2 hidden md:table-cell">Seen</th>
                <th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {rels.map(({ e, s, d }) => (
                <tr key={e.id} className={selectedEdgeId === e.id ? "bg-electric-blue/5" : undefined} aria-selected={selectedEdgeId === e.id}>
                  <td className="px-3 py-2">{s?.label ?? e.source}</td>
                  <td className="px-3 py-2 text-text-secondary">{e.relationshipType.toLowerCase().replace(/_/g, " ")}</td>
                  <td className="px-3 py-2">{d?.label ?? e.target}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{e.count}</td>
                  <td className="px-3 py-2 hidden md:table-cell text-text-secondary whitespace-nowrap">{day(e.firstSeen)}{e.lastSeen && e.lastSeen !== e.firstSeen ? ` – ${day(e.lastSeen)}` : ""}</td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="ghost" size="sm" onClick={() => selectEdge(e.id)} aria-label={`Show sources: ${s?.label ?? e.source} ${e.relationshipType.toLowerCase()} ${d?.label ?? e.target}`}>Sources</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rels.length === 0 && <p className="p-4 text-sm text-text-secondary">No relationships match.</p>}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-subtle bg-surface-1">
          <table className="w-full text-sm" data-testid="graph-entities-table">
            <caption className="sr-only">Entities in this case, most connected first</caption>
            <thead className="bg-surface-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
              <tr><th scope="col" className="px-3 py-2">Entity</th><th scope="col" className="px-3 py-2">Type</th><th scope="col" className="px-3 py-2 text-right">Connections</th><th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {ents.map((n) => (
                <tr key={n.id} className={selectedNodeId === n.id ? "bg-electric-blue/5" : undefined} aria-selected={selectedNodeId === n.id}>
                  <td className="px-3 py-2">{n.label}</td>
                  <td className="px-3 py-2 text-text-secondary">{KIND_LABEL[n.entityType] ?? n.entityType}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{n.degree}</td>
                  <td className="px-3 py-2 text-right"><Button variant="ghost" size="sm" onClick={() => selectNode(n.id)} aria-label={`Show details of ${n.label}`}>Details</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {ents.length === 0 && <p className="p-4 text-sm text-text-secondary">No entities match.</p>}
        </div>
      )}
      <p className="text-xs text-text-secondary">Relationships are candidates built from source-linked claims, not established facts. Masked values stay masked.</p>
    </div>
  );
}
