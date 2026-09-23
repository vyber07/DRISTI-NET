import { useEffect, useRef, useState, useCallback } from "react";
import { GraphEngine } from "./engine/GraphEngine";
import { GraphToolbar } from "./GraphToolbar";
import { GraphLegend } from "./GraphLegend";
import { GraphFilterPanel } from "./filters/GraphFilterPanel";
import { useGraphStore } from "@/stores/graphStore";
import { cn } from "@/lib/utils";

interface GraphCanvasProps {
  className?: string;
}

export function GraphCanvas({ className }: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GraphEngine | null>(null);
  const prevNodesCountRef = useRef(0);

  const { 
    nodes,
    edges,
    selectedNodeId,
    selectedEdgeId,
    activeEntityTypes,
    activeRelationshipTypes,
    onlyContradictions,
    dateRange,
    searchTerm,
    currentTimestamp,
    showCoreConnectionsOnly,
    isLayoutRunning,
    selectNode,
    selectEdge,
    clearSelection,
  } = useGraphStore();

  const [engineReady, setEngineReady] = useState(false);

  // Initialize GraphEngine
  useEffect(() => {
    if (!containerRef.current) return;

    const engine = new GraphEngine(containerRef.current, {
      onNodeClick: (nodeId) => selectNode(nodeId),
      onEdgeClick: (edgeId) => selectEdge(edgeId),
      onStageClick: () => clearSelection(),
    });

    engineRef.current = engine;
    setEngineReady(true);

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [selectNode, selectEdge, clearSelection]);

  // Load graph data when nodes/edges change: use loadGraphData initially, applyDelta on expansions
  useEffect(() => {
    if (engineRef.current && nodes.length > 0) {
      if (
        engineRef.current.getNodeCount() === 0 ||
        nodes.length < prevNodesCountRef.current
      ) {
        engineRef.current.loadGraphData(nodes, edges);
      } else {
        engineRef.current.applyDelta(nodes, edges);
      }
      prevNodesCountRef.current = nodes.length;
    }
  }, [nodes, edges, engineReady]);

  // Update filters when store filter states change
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setFilters({
        activeEntityTypes,
        activeRelationshipTypes,
        onlyContradictions,
        dateRange,
        searchTerm,
        currentTimestamp,
        showCoreConnectionsOnly,
      });
    }
  }, [
    activeEntityTypes,
    activeRelationshipTypes,
    onlyContradictions,
    dateRange,
    searchTerm,
    currentTimestamp,
    showCoreConnectionsOnly,
    engineReady,
  ]);

  const prevSelectionRef = useRef<{ node: string | null; edge: string | null }>({ node: null, edge: null });

  // Update selection
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setSelection(selectedNodeId, selectedEdgeId);
      if (selectedNodeId) {
        engineRef.current.focusNode(selectedNodeId);
      } else if (
        !selectedNodeId &&
        !selectedEdgeId &&
        (prevSelectionRef.current.node || prevSelectionRef.current.edge)
      ) {
        engineRef.current.updateCustomBBoxAndFit(true);
      }
      prevSelectionRef.current = { node: selectedNodeId, edge: selectedEdgeId };
    }
  }, [selectedNodeId, selectedEdgeId, engineReady]);

  // Sync layout state
  useEffect(() => {
    if (!engineRef.current) return;
    if (isLayoutRunning) {
      engineRef.current.organizeMap(() => {
        useGraphStore.getState().setLayoutRunning(false);
      });
    }
  }, [isLayoutRunning, engineReady]);

  const handleZoomIn = useCallback(() => {
    engineRef.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    engineRef.current?.zoomOut();
  }, []);

  const handleReset = useCallback(() => {
    engineRef.current?.resetCamera();
  }, []);

  const handleToggleLayout = useCallback(() => {
    if (!engineRef.current) return;
    useGraphStore.getState().setLayoutRunning(true);
    engineRef.current.organizeMap(() => {
      useGraphStore.getState().setLayoutRunning(false);
    });
  }, []);

  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-background", className)}>
      {/* Sigma + Canvas container */}
      <div ref={containerRef} className="h-full w-full" />

      {/* Floating Toolbar */}
      <GraphToolbar
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onReset={handleReset}
        onToggleLayout={handleToggleLayout}
        isLayoutRunning={isLayoutRunning}
      />

      {/* Floating Filter Panel Overlay */}
      <GraphFilterPanel />

      {/* Floating Collapsible Legend */}
      <GraphLegend />
    </div>
  );
}
