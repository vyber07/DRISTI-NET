import { mockFetch, type ApiResponse } from "./client";
import { get } from "./real_client";
import {
  MOCK_CASE_ID,
  MOCK_CASE_TITLE,
  MOCK_GRAPH_NODES,
  MOCK_GRAPH_EDGES,
} from "@/mock/caseGraphData";
import type { GraphNodeAttributes, GraphEdgeAttributes } from "@/types/entity";

export interface CaseGraphResponse {
  caseId: string;
  caseTitle: string;
  nodes: GraphNodeAttributes[];
  edges: GraphEdgeAttributes[];
  stats: {
    totalEntities: number;
    totalRelationships: number;
    contradictionsCount: number;
    highestTier: number;
  };
}

export async function getCaseGraph(caseId: string): Promise<ApiResponse<CaseGraphResponse>> {
  try {
    const data = await get(`/cases/${caseId}/graph`);
    return { data, meta: { requestId: '1', timestamp: '', durationMs: 0, securityClassification: '' } };
  } catch(e) {
    console.warn('Backend failed, fallback to mock');

  const payload: CaseGraphResponse = {
    caseId: caseId || MOCK_CASE_ID,
    caseTitle: MOCK_CASE_TITLE,
    nodes: MOCK_GRAPH_NODES,
    edges: MOCK_GRAPH_EDGES,
    stats: {
      totalEntities: MOCK_GRAPH_NODES.length,
      totalRelationships: MOCK_GRAPH_EDGES.length,
      contradictionsCount: MOCK_GRAPH_EDGES.filter((e) => e.hasContradiction).length,
      highestTier: Math.max(...MOCK_GRAPH_EDGES.map((e) => e.evidenceTier)),
    },
  };

  return mockFetch(payload, 200);
}

  }
export interface ExpandNeighborsResponse {
  entityId: string;
  newNodes: GraphNodeAttributes[];
  newEdges: GraphEdgeAttributes[];
  totalNeighbors: number;
}

export async function expandNeighbors(
  entityId: string,
  currentVisibleNodeIds: string[] = [],
): Promise<ApiResponse<ExpandNeighborsResponse>> {
  const connectedEdges = MOCK_GRAPH_EDGES.filter(
    (edge) => edge.source === entityId || edge.target === entityId,
  );

  const neighborIds = new Set<string>();
  connectedEdges.forEach((edge) => {
    if (edge.source === entityId) neighborIds.add(edge.target);
    if (edge.target === entityId) neighborIds.add(edge.source);
  });

  const visibleSet = new Set(currentVisibleNodeIds);

  const newNodes = MOCK_GRAPH_NODES.filter(
    (node) => neighborIds.has(node.id) && !visibleSet.has(node.id),
  );

  const newEdges = connectedEdges.filter(
    (edge) =>
      !visibleSet.has(edge.source) ||
      !visibleSet.has(edge.target) ||
      edge.source === entityId ||
      edge.target === entityId,
  );

  return mockFetch(
    {
      entityId,
      newNodes,
      newEdges,
      totalNeighbors: neighborIds.size,
    },
    180,
  );
}

