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

// Backend node kinds (graph/README.md) -> UI entity categories. The UI groups phones/devices as CYBER and accounts
// as FINANCIAL; the original kind is kept on `sourceKind`. Unmapped kinds (VEHICLE, CASE, ...) pass through as-is.
const KIND_TO_ENTITY_TYPE: Record<string, string> = { PHONE: "CYBER", DEVICE: "CYBER", ACCOUNT: "FINANCIAL" };

export async function getCaseGraph(caseId: string): Promise<ApiResponse<CaseGraphResponse>> {
  const rawData = await get(`/cases/${caseId}/graph`);
  
  const mappedNodes = (rawData.nodes || []).map((n: any) => ({
    id: n.entity_id,
    label: n.label || n.entity_id,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 16,
    color: "#6b7280",
    entityType: KIND_TO_ENTITY_TYPE[n.kind] ?? n.kind,
    sourceKind: n.kind,
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
    // `??` not `||`: a real 0 must stay 0, and a missing value must never be displayed as 100 % confidence.
    minConfidence: typeof e.min_confidence === "number" ? e.min_confidence : 0,
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
    caseTitle: rawData.case_title || `Case ${caseId}`,
    // Bounds reported by the server. Previously dropped, so a partial graph looked complete.
    truncated: !!rawData.truncated,
    totalNodes: typeof rawData.total_nodes === "number" ? rawData.total_nodes : mappedNodes.length,
    projectionStale: !!rawData.projection_stale,
    nodes: mappedNodes,
    edges: mappedEdges,
    stats: {
      totalEntities: mappedNodes.length,
      totalRelationships: mappedEdges.length,
    }
  };

  return { data, meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}


// Takes the endpoints explicitly. Entity IDs contain hyphens (ENT-4af05a30f230), so re-parsing the composite
// edge ID by splitting on '-' sends source="ENT" and the API correctly answers 200 with zero claims -- a silent,
// wrong "no supporting evidence" result.
export async function getEdgeDetails(caseId: string, source: string, target: string, relType: string): Promise<ApiResponse<any>> {
  const qs = new URLSearchParams({ source, target, rel_type: relType });
  const data = await get(`/cases/${encodeURIComponent(caseId)}/edge?${qs.toString()}`);
  return { data, meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}

