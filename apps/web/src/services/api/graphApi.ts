import { get } from "./real_client";
import type { ApiResponse } from "./client";
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

export interface ExpandNeighborsResponse {
  entityId: string;
  newNodes: GraphNodeAttributes[];
  newEdges: GraphEdgeAttributes[];
  totalNeighbors: number;
}

export async function getCaseGraph(caseId: string): Promise<ApiResponse<CaseGraphResponse>> {
  const data = await get(`/cases/${caseId}/graph`);
  return { data, meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}
