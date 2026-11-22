import { create } from "zustand";
import type {
  GraphNodeAttributes,
  GraphEdgeAttributes,
  EntityType,
  EntityDetail,
  RelationshipDetail,
  RelationshipType,
} from "@/types/entity";
import { RELATIONSHIP_TYPES } from "@/types/entity";
import { recordedTimeMs } from "@/lib/utils";
import type { EvidenceTier } from "@/constants/evidenceTiers";
import { getEntityDetails } from "@/services/api/entityApi";
import { getCaseGraph, getEdgeDetails } from "@/services/api/graphApi";

interface GraphState {
  caseId: string;
  caseTitle: string;
  nodes: GraphNodeAttributes[];
  edges: GraphEdgeAttributes[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  hoveredNodeId: string | null;
  hoveredEdgeId: string | null;
  selectedEntityDetail: EntityDetail | null;
  selectedRelationshipDetail: RelationshipDetail | null;
  isLoading: boolean;
  error: string | null;

  activeTiers: Set<EvidenceTier>;
  activeEntityTypes: Set<EntityType>;
  activeRelationshipTypes: Set<RelationshipType>;
  onlyContradictions: boolean;
  minConfidence: number;
  dateRange: [number, number];
  searchTerm: string;
  isFilterPanelOpen: boolean;
  showCoreConnectionsOnly: boolean;

  minTimestamp: number;
  maxTimestamp: number;
  currentTimestamp: number;
  isPlaying: boolean;
  playbackSpeed: number;

  isLayoutRunning: boolean;

  loadGraph: (caseId: string) => Promise<void>;
  /** Server-reported bounds of the last load (GET /cases/{id}/graph). */
  graphBounds: { truncated: boolean; totalNodes: number; projectionStale: boolean; hasDatedEdges: boolean } | null;
  selectNode: (nodeId: string | null) => Promise<void>;
  selectEdge: (edgeId: string | null) => Promise<void>;
  clearSelection: () => void;
  setHoveredNode: (nodeId: string | null) => void;
  setHoveredEdge: (edgeId: string | null) => void;
  toggleShowCoreConnectionsOnly: () => void;
  setShowCoreConnectionsOnly: (show: boolean) => void;
  toggleTier: (tier: EvidenceTier) => void;
  selectAllTiers: () => void;
  clearTiers: () => void;
  toggleEntityType: (type: EntityType) => void;
  selectAllEntityTypes: () => void;
  clearEntityTypes: () => void;
  toggleRelationshipType: (type: RelationshipType) => void;
  selectAllRelationshipTypes: () => void;
  clearRelationshipTypes: () => void;
  setOnlyContradictions: (enabled: boolean) => void;
  setMinConfidence: (confidence: number) => void;
  setDateRange: (range: [number, number]) => void;
  setSearchTerm: (term: string) => void;
  toggleFilterPanel: () => void;
  setFilterPanelOpen: (open: boolean) => void;
  resetFilters: () => void;
  setCurrentTimestamp: (time: number) => void;
  togglePlay: () => void;
  stepTemporal: (deltaSteps: number) => void;
  setLayoutRunning: (running: boolean) => void;
  toggleLayout: () => void;
}

const DEFAULT_TIERS: EvidenceTier[] = [2, 3, 4, 5, 6];
const ALL_ENTITY_TYPES: EntityType[] = [
  "PERSON",
  "ORGANIZATION",
  "LOCATION",
  "EVENT",
  "FINANCIAL",
  "CYBER",
];
const ALL_RELATIONSHIP_TYPES: RelationshipType[] = [...RELATIONSHIP_TYPES];

const INITIAL_MIN_TIME = new Date("2026-02-10T00:00:00Z").getTime();
const INITIAL_MAX_TIME = new Date("2026-02-25T00:00:00Z").getTime();

export const useGraphStore = create<GraphState>((set, get) => ({
  caseId: "",
  caseTitle: "",
  nodes: [],
  edges: [],
  selectedNodeId: null,
  graphBounds: null,
  selectedEdgeId: null,
  hoveredNodeId: null,
  hoveredEdgeId: null,
  selectedEntityDetail: null,
  selectedRelationshipDetail: null,
  isLoading: false,
  error: null,

  activeTiers: new Set(DEFAULT_TIERS),
  activeEntityTypes: new Set(ALL_ENTITY_TYPES),
  activeRelationshipTypes: new Set(ALL_RELATIONSHIP_TYPES),
  onlyContradictions: false,
  minConfidence: 0,
  dateRange: [INITIAL_MIN_TIME, INITIAL_MAX_TIME],
  searchTerm: "",
  isFilterPanelOpen: false,
  showCoreConnectionsOnly: false,

  minTimestamp: INITIAL_MIN_TIME,
  maxTimestamp: INITIAL_MAX_TIME,
  currentTimestamp: INITIAL_MAX_TIME,
  isPlaying: false,
  playbackSpeed: 1,

  isLayoutRunning: false,

  loadGraph: async (caseId: string) => {
    // DEF-061: clear the previous case's (or previous user's) graph before loading. On a 403 the old nodes,
    // edges and selection used to stay on screen, attributed to the newly requested case.
    if (caseId !== get().caseId) {
      // FE-048: type/confidence/search filters from another case must not silently hide this case's graph
      set({ activeEntityTypes: new Set(ALL_ENTITY_TYPES), activeRelationshipTypes: new Set(ALL_RELATIONSHIP_TYPES), minConfidence: 0, searchTerm: "", onlyContradictions: false });
    }
    set({ isLoading: true, error: null, caseId, nodes: [], edges: [], selectedNodeId: null, selectedEdgeId: null, selectedEntityDetail: null } as any);
    try {
      const response = await getCaseGraph(caseId);
      const {  nodes, edges, caseTitle } = response.data;
      const { truncated, totalNodes, projectionStale } = response.data as { truncated?: boolean; totalNodes?: number; projectionStale?: boolean };

      // Undated edges are excluded from the time range (they used to become 1970-01-01 via `|| 0`).
      const edgeTimes = edges.map((e) => recordedTimeMs(e.firstSeen || e.lastSeen)).filter((t) => !isNaN(t));
      // FE-058: with no dated relationship there is no time range; the slider says so instead of showing
      // invented Feb-2026 dates (the INITIAL_* values only fill the store until a graph has loaded).
      const minT = edgeTimes.length > 0 ? Math.min(...edgeTimes) : 0;
      const maxT = edgeTimes.length > 0 ? Math.max(...edgeTimes) : 0;

      set({
        caseId,
        caseTitle,
        nodes,
        edges,
        minTimestamp: minT,
        maxTimestamp: maxT,
        currentTimestamp: maxT,
        dateRange: [minT, maxT],
        isLoading: false,
        graphBounds: { truncated: !!truncated, totalNodes: totalNodes ?? nodes.length, projectionStale: !!projectionStale, hasDatedEdges: edgeTimes.length > 0 },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load case graph";
      set({ error: msg, isLoading: false });
    }
  },

  selectNode: async (nodeId: string | null) => {
    if (!nodeId) {
      set({ selectedNodeId: null, selectedEntityDetail: null });
      return;
    }
    // DEF-077: clear the previous entity while the new one loads, and never fall back to a hard-coded case id
    // (the timeline's "View in graph" can select a node before any graph has loaded).
    set({
      selectedNodeId: nodeId,
      selectedEdgeId: null,
      selectedRelationshipDetail: null,
      selectedEntityDetail: null,
    } as any);
    const caseId = get().caseId;
    if (!caseId) return;
    try {
      const res = await getEntityDetails(nodeId, caseId);
      set({ selectedEntityDetail: res.data });
    } catch {
      // Keep selectedNodeId
    }
  },

  selectEdge: async (edgeId: string | null) => {
    if (!edgeId) {
      set({ selectedEdgeId: null, selectedRelationshipDetail: null });
      return;
    }
    set({
      selectedEdgeId: edgeId,
      selectedNodeId: null,
      selectedEntityDetail: null,
    });
    
    // Simulate fetching edge details by looking up the edge in the graph
    const edge = get().edges.find(e => e.id === edgeId);
    if (edge) {
      const sourceNode = get().nodes.find(n => n.id === edge.source);
      const targetNode = get().nodes.find(n => n.id === edge.target);
      set({ 
        selectedRelationshipDetail: {
          id: edge.id,
          type: edge.relationshipType,
          label: edge.label,
          sourceId: edge.source,
          targetId: edge.target,
          sourceLabel: sourceNode?.label || edge.source,
          targetLabel: targetNode?.label || edge.target,
          count: edge.count,
          weight: edge.weight,
          minConfidence: edge.minConfidence,
          evidenceIds: edge.evidenceIds,
          claimIds: edge.claimIds,
          firstSeen: edge.firstSeen,
          lastSeen: edge.lastSeen,
          relevance: edge.relevance,
          claims: undefined,
          claimsError: null,
        } as any 
      });
      // Fetch per-claim provenance (exact page/line/row/json_path) for the evidence drawer.
      try {
        const res = await getEdgeDetails(get().caseId, edge.source, edge.target, edge.relationshipType);
        if (get().selectedEdgeId !== edgeId) return; // selection changed while loading
        const cur = get().selectedRelationshipDetail;
        if (cur) set({ selectedRelationshipDetail: { ...cur, claims: res.data?.claims ?? [] } });
      } catch (err: unknown) {
        if (get().selectedEdgeId !== edgeId) return;
        const cur = get().selectedRelationshipDetail;
        if (cur) set({ selectedRelationshipDetail: { ...cur, claims: [], claimsError: (err as Error).message || "Failed to load provenance" } });
      }
    }
  },

  clearSelection: () => {
    set({
      selectedNodeId: null,
      selectedEdgeId: null,
      selectedEntityDetail: null,
      selectedRelationshipDetail: null,
    });
  },

  setHoveredNode: (nodeId) => set({ hoveredNodeId: nodeId }),
  setHoveredEdge: (edgeId) => set({ hoveredEdgeId: edgeId }),

  toggleShowCoreConnectionsOnly: () =>
    set((state) => ({ showCoreConnectionsOnly: !state.showCoreConnectionsOnly })),
  setShowCoreConnectionsOnly: (show) => set({ showCoreConnectionsOnly: show }),

  toggleTier: (tier) =>
    set((state) => {
      const next = new Set(state.activeTiers);
      if (next.has(tier)) {
        if (next.size > 1) next.delete(tier);
      } else {
        next.add(tier);
      }
      return { activeTiers: next };
    }),

  selectAllTiers: () => set({ activeTiers: new Set(DEFAULT_TIERS) }),
  clearTiers: () => set({ activeTiers: new Set([4]) }),

  toggleEntityType: (type) =>
    set((state) => {
      const next = new Set(state.activeEntityTypes);
      if (next.has(type)) next.delete(type); // FE-045: removing the last type was silently refused
      else next.add(type);
      return { activeEntityTypes: next };
    }),

  selectAllEntityTypes: () => set({ activeEntityTypes: new Set(ALL_ENTITY_TYPES) }),
  clearEntityTypes: () => set({ activeEntityTypes: new Set<EntityType>() }), // FE-045: "Clear" used to mean "Person only"

  toggleRelationshipType: (type) =>
    set((state) => {
      const next = new Set(state.activeRelationshipTypes);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return { activeRelationshipTypes: next };
    }),

  selectAllRelationshipTypes: () =>
    set({ activeRelationshipTypes: new Set(ALL_RELATIONSHIP_TYPES) }),
  clearRelationshipTypes: () => set({ activeRelationshipTypes: new Set<RelationshipType>() }), // was "Called only"

  setOnlyContradictions: (only) => set({ onlyContradictions: only }),
  setMinConfidence: (conf) => set({ minConfidence: conf }),
  setDateRange: (range) => set({ dateRange: range }),
  setSearchTerm: (term) => set({ searchTerm: term }),

  toggleFilterPanel: () => set((state) => ({ isFilterPanelOpen: !state.isFilterPanelOpen })),
  setFilterPanelOpen: (open) => set({ isFilterPanelOpen: open }),

  resetFilters: () => {
    const {  minTimestamp, maxTimestamp } = get();
    set({
      activeTiers: new Set(DEFAULT_TIERS),
      activeEntityTypes: new Set(ALL_ENTITY_TYPES),
      activeRelationshipTypes: new Set(ALL_RELATIONSHIP_TYPES),
      onlyContradictions: false,
      minConfidence: 0,
      searchTerm: "",
      dateRange: [minTimestamp, maxTimestamp],
      currentTimestamp: maxTimestamp,
    });
  },

  setCurrentTimestamp: (time) => set({ currentTimestamp: time }),

  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

  stepTemporal: (deltaSteps) => {
    const {  minTimestamp, maxTimestamp, currentTimestamp } = get();
    const stepSizeMs = (maxTimestamp - minTimestamp) / 20;
    const nextTime = Math.min(
      maxTimestamp,
      Math.max(minTimestamp, currentTimestamp + deltaSteps * stepSizeMs),
    );
    set({ currentTimestamp: nextTime });
  },

  setLayoutRunning: (running) => set({ isLayoutRunning: running }),
  toggleLayout: () => set((state) => ({ isLayoutRunning: !state.isLayoutRunning })),
}));

/** FE-045: how many filters narrow the graph (the old count assumed 6 relationship types; there are 7). */
export function countActiveFilters(st: { activeEntityTypes: Set<string>; activeRelationshipTypes: Set<string>; minConfidence: number }): number {
  return (st.activeEntityTypes.size < ALL_ENTITY_TYPES.length ? 1 : 0)
    + (st.activeRelationshipTypes.size < ALL_RELATIONSHIP_TYPES.length ? 1 : 0)
    + (st.minConfidence > 0 ? 1 : 0);
}
