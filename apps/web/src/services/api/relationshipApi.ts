import { mockFetch, type ApiResponse } from "./client";
import { MOCK_RELATIONSHIPS } from "@/mock/caseGraphData";
import type { RelationshipDetail } from "@/types/entity";

export async function getRelationshipDetails(
  relId: string,
): Promise<ApiResponse<RelationshipDetail | null>> {
  const rel = MOCK_RELATIONSHIPS.find((r) => r.id === relId) || null;
  return mockFetch(rel, 150);
}

export async function listRelationships(caseId: string): Promise<ApiResponse<RelationshipDetail[]>> {
  void caseId;
  return mockFetch(MOCK_RELATIONSHIPS, 200);
}
