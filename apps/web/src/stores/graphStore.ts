import { create } from "zustand";
import type {
  GraphNodeAttributes,
  GraphEdgeAttributes,
  EntityType,
  EntityDetail,
  RelationshipDetail,
  RelationshipType,
} from "@/types/entity";
import type { EvidenceTier } from "@/constants/evidenceTiers";
import { getEntityDetails } from "@/services/api/entityApi";
import { getCaseGraph } from "@/services/api/graphApi";

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
const ALL_RELATIONSHIP_TYPES: RelationshipType[] = [
  "COMMUNICATED_WITH",
  "TRANSFERRED_FUNDS",
  "USED_DEVICE",
  "USED_PHONE",
  "CO_LOCATED_AT",
  "ASSOCIATED_IN_CASE",
];

const INITIAL_MIN_TIME = new Date("2026-02-10T00:00:00Z").getTime();
const INITIAL_MAX_TIME = new Date("2026-02-25T00:00:00Z").getTime();

export const useGraphStore = create<GraphState>((set, get) => ({
  caseId: "DR-2026-00421",
  caseTitle: "Interstate Extortion Syndicate",
  nodes: [],
  edges: [],
  selectedNodeId: null,
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
    set({ isLoading: true, error: null });
    try {
      const response = await getCaseGraph(caseId);
      const {  nodes, edges, caseTitle } = response.data;

      const edgeTimes = edges.map((e) => new Date(e.firstSeen || e.lastSeen || 0).getTime()).filter((t) => !isNaN(t));
      const minT = edgeTimes.length > 0 ? Math.min(...edgeTimes) : INITIAL_MIN_TIME;
      const maxT = edgeTimes.length > 0 ? Math.max(...edgeTimes) : INITIAL_MAX_TIME;

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
    set({
      selectedNodeId: nodeId,
      selectedEdgeId: null,
      selectedRelationshipDetail: null,
    });
    try {
      const res = await getEntityDetails(nodeId);
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
          relevance: edge.relevance
        } as any 
      });
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
      if (next.has(type)) {
        if (next.size > 1) next.delete(type);
      } else {
        next.add(type);
      }
      return { activeEntityTypes: next };
    }),

  selectAllEntityTypes: () => set({ activeEntityTypes: new Set(ALL_ENTITY_TYPES) }),
  clearEntityTypes: () => set({ activeEntityTypes: new Set(["PERSON"]) }),

  toggleRelationshipType: (type) =>
    set((state) => {
      const next = new Set(state.activeRelationshipTypes);
      if (next.has(type)) {
        if (next.size > 1) next.delete(type);
      } else {
        next.add(type);
      }
      return { activeRelationshipTypes: next };
    }),

  selectAllRelationshipTypes: () =>
    set({ activeRelationshipTypes: new Set(ALL_RELATIONSHIP_TYPES) }),
  clearRelationshipTypes: () =>
    set({ activeRelationshipTypes: new Set(["COMMUNICATED_WITH"]) }),

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
