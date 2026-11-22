import { get, type ApiResponse } from "./real_client";


export async function getEntityDetails(entityId: string, caseId: string): Promise<ApiResponse<any | null>> {
  const data = await get(`/entities/${entityId}?case_id=${encodeURIComponent(caseId)}`);
  return { data, meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}
