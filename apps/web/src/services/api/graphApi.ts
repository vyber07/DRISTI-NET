import { get, type ApiResponse } from "./real_client";

import type { GraphNodeAttributes, GraphEdgeAttributes } from "@/types/entity";

export interface CaseGraphResponse {
  caseId: string;
  caseTitle: string;
  nodes: GraphNodeAttributes[];
  edges: GraphEdgeAttributes[];
  stats: {
    totalEntities: number;
    totalRelationships: number;
  };
}

export async function getCaseGraph(caseId: string): Promise<ApiResponse<CaseGraphResponse>> {
  const rawData = await get(`/cases/${caseId}/graph`);
  
  const mappedNodes = (rawData.nodes || []).map((n: any) => ({
    id: n.entity_id,
    label: n.label || n.entity_id,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 16,
    color: "#6b7280",
    entityType: n.kind,
    degree: n.degree || 0,
    isMasked: !!n.masked,
  }));

  const mappedEdges = (rawData.edges || []).map((e: any, i: number) => ({
    id: `${e.source}-${e.target}-${e.rel_type}-${i}`,
    source: e.source,
    target: e.target,
    label: e.rel_type,
    relationshipType: e.rel_type,
    count: e.count || 1,
    weight: e.weight || 1,
    minConfidence: e.min_confidence || 1.0,
    evidenceIds: e.evidence_ids || [],
    claimIds: e.claim_ids || [],
    firstSeen: e.first_seen || null,
    lastSeen: e.last_seen || null,
    relevance: e.relevance || "UNDATED",
    size: 2,
    color: "#9ca3af",
  }));

  const data = {
    caseId: rawData.case_id || caseId,
    caseTitle: `Case ${caseId}`,
    nodes: mappedNodes,
    edges: mappedEdges,
    stats: {
      totalEntities: mappedNodes.length,
      totalRelationships: mappedEdges.length,
    }
  };

  return { data, meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}
