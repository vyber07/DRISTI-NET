import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { GraphCanvas } from "@/components/graph/GraphCanvas";
import { EntityDrawer } from "@/components/graph/drawers/EntityDrawer";
import { EdgeDrawer } from "@/components/graph/drawers/EdgeDrawer";
import { EmptyDrawer } from "@/components/graph/drawers/EmptyDrawer";
import { TemporalSlider } from "@/components/graph/TemporalSlider";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/layout/page";
import { useGraphStore } from "@/stores/graphStore";
import { useCase } from "./case-context";
import { cn } from "@/lib/utils";

/**
 * Relationship graph tab, inside the case layout. The detail panel is part of the layout (it used to be absolutely
 * positioned against the page and covered the top bar). Removed: an emoji colour legend that duplicated the real
 * legend, a "Share" button with no handler, and an "Export" button permanently disabled with an invented reason —
 * exports are on the Reports tab.
 */
export function CaseGraphPage() {
  const { caseId } = useCase();
  const { selectedNodeId, selectedEdgeId, loadGraph, isLoading, error, nodes, edges, graphBounds, selectNode } = useGraphStore();
  const [params] = useSearchParams();
  const focusEntity = params.get("entity");
  const [panelOpen, setPanelOpen] = useState(true);
  // FE-032: a selection opens the panel, but "Hide details" must still be able to close it afterwards.
  useEffect(() => { if (selectedNodeId || selectedEdgeId) setPanelOpen(true); }, [selectedNodeId, selectedEdgeId]);
  const showPanel = panelOpen;

  useEffect(() => {
    loadGraph(caseId);
    (window as any).__graphStore = useGraphStore; // used by the browser E2E to read the rendered graph
  }, [loadGraph, caseId]); // DEF-061: reload when the routed case changes

  // "Show in graph" from the timeline links here with ?entity=<id>; select it once the graph has loaded
  // (selecting before navigation was lost because loading clears the selection).
  useEffect(() => {
    if (!isLoading && focusEntity && nodes.some((n) => n.id === focusEntity)) selectNode(focusEntity);
  }, [isLoading, focusEntity, nodes, selectNode]);

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle bg-surface-1 px-4 sm:px-6 py-2">
        <p className="text-sm text-text-secondary">
          <span className="font-semibold text-text-primary" data-testid="graph-counts">{isLoading ? "Loading…" : `${nodes.length} entities · ${edges.length} relationships`}</span>
          <span className="hidden md:inline"> — candidate relationships from the case evidence. Click a line to see its sources.</span>
        </p>
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setPanelOpen(!showPanel)} aria-expanded={showPanel} aria-controls="graph-detail">
          {showPanel ? <PanelRightClose className="h-4 w-4" aria-hidden="true" /> : <PanelRightOpen className="h-4 w-4" aria-hidden="true" />}
          {showPanel ? "Hide details" : "Show details"}
        </Button>
      </div>
      {graphBounds && (graphBounds.truncated || graphBounds.projectionStale) && (
        <p role="status" className="border-b border-amber/40 bg-amber/10 px-4 sm:px-6 py-2 text-sm text-text-primary" data-testid="graph-bounds">
          {graphBounds.truncated && <>Showing {nodes.length} of {graphBounds.totalNodes} entities (the server limits one view to keep it readable). </>}
          {graphBounds.projectionStale && <>The graph is being rebuilt from recent changes; refresh in a moment for the current state.</>}
        </p>
      )}
      {error && <div className="px-4 sm:px-6 pt-3"><ErrorState message={`Could not load the graph: ${error}`} onRetry={() => loadGraph(caseId)} /></div>}
      <div className="relative flex flex-1 min-h-0">
        <div className="relative flex-1 min-w-0 min-h-[360px]">
          {isLoading ? <p className="p-6 text-sm text-text-secondary" role="status">Loading the relationship graph…</p> : <GraphCanvas />}
        </div>
        {showPanel && (
          <aside id="graph-detail" aria-label="Selection details"
            className={cn("min-h-0 border-l border-border-subtle bg-surface-1 shadow-drawer",
              "absolute inset-y-0 right-0 z-20 w-full max-w-sm lg:static lg:z-auto lg:w-[380px] lg:max-w-none lg:shadow-none")}>
            {selectedNodeId ? <EntityDrawer /> : selectedEdgeId ? <EdgeDrawer /> : <EmptyDrawer />}
          </aside>
        )}
      </div>
      <div className="border-t border-border-subtle bg-surface-1"><TemporalSlider /></div>
    </div>
  );
}
