import { MousePointerClick } from "lucide-react";
import { useGraphStore } from "@/stores/graphStore";

/** Graph side panel before anything is selected: real counts and how to read the graph. */
export function EmptyDrawer() {
  const { nodes, edges } = useGraphStore();
  return (
    <div data-testid="empty-drawer" className="h-full w-full bg-surface-1 flex flex-col gap-5 p-5 overflow-y-auto">
      <div>
        <h3 className="text-[15px] font-semibold text-text-primary">Nothing selected</h3>
        <p className="mt-1 text-sm text-text-secondary">
          <MousePointerClick className="mr-1 inline h-4 w-4 align-text-bottom" aria-hidden="true" />
          Click a person, phone, account or a line between them to see why they are linked and open the exact source.
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border-subtle px-3 py-2">
          <dt className="text-xs font-medium text-text-secondary">Entities shown</dt>
          <dd className="text-2xl font-semibold tabular-nums text-text-primary">{nodes.length}</dd>
        </div>
        <div className="rounded-lg border border-border-subtle px-3 py-2">
          <dt className="text-xs font-medium text-text-secondary">Relationships</dt>
          <dd className="text-2xl font-semibold tabular-nums text-text-primary">{edges.length}</dd>
        </div>
      </dl>
      <p className="text-sm text-text-secondary">
        Each line aggregates one or more source-linked claims. Lines are candidate relationships; identity merges appear only after a reviewer approves them.
      </p>
    </div>
  );
}
