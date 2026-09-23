import { Info, Users, Link as LinkIcon } from "lucide-react";
import { useGraphStore } from "@/stores/graphStore";
import { Badge } from "@/components/ui/badge";

export function EmptyDrawer() {
  const { nodes, edges, caseId } = useGraphStore();

  return (
    <div
      data-testid="empty-drawer"
      className="absolute top-0 right-0 h-full w-[400px] border-l border-border-subtle bg-surface-1 shadow-panel flex flex-col z-10 p-5 space-y-6"
    >
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-text-primary tracking-tight">
          Investigation Overview
        </h2>
        <p className="text-xs text-text-muted">
          Select any node or connection on the map to inspect its evidence provenance.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border-subtle bg-surface-2 p-3 space-y-2">
          <Users className="h-4 w-4 text-electric-blue" />
          <div className="space-y-0.5">
            <p className="text-2xl font-bold text-text-primary">{nodes.length}</p>
            <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">
              Indexed Entities
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-border-subtle bg-surface-2 p-3 space-y-2">
          <LinkIcon className="h-4 w-4 text-teal-primary" />
          <div className="space-y-0.5">
            <p className="text-2xl font-bold text-text-primary">{edges.length}</p>
            <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">
              Indexed Claims
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-md border border-border-subtle bg-surface-2/50 p-3 space-y-2 text-xs text-text-muted">
        <p className="font-semibold text-text-secondary flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5" />
          Graph Analytics Enabled
        </p>
        <p className="leading-relaxed">
          The map currently displays the exact subgraph structure derived from real evidentiary claims. No fabricated mock data is injected.
        </p>
      </div>
    </div>
  );
}
