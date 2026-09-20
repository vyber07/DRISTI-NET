import { mockFetch, type ApiResponse } from "./client";
import { get } from "./real_client";
import { MOCK_ENTITIES } from "@/mock/caseGraphData";
import type { EntityDetail } from "@/types/entity";

export async function getEntityDetails(entityId: string): Promise<ApiResponse<EntityDetail | null>> {
  try {
    const data = await get(`/entities/${entityId}`);
    return { data, meta: { requestId: '1', timestamp: '', durationMs: 0, securityClassification: '' } };
  } catch(e) {
    console.warn('Backend failed, fallback to mock');

  const entity = MOCK_ENTITIES.find((e) => e.id === entityId) || null;
  return mockFetch(entity, 150);
  }
}

export async function listEntities(caseId: string): Promise<ApiResponse<EntityDetail[]>> {
  // Can filter by caseId in future
  void caseId;
  return mockFetch(MOCK_ENTITIES, 200);
}
