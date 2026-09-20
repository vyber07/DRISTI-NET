import { get } from "./real_client";
import type { ApiResponse } from "./client";

export async function getEntityDetails(entityId: string): Promise<ApiResponse<any | null>> {
  const data = await get(`/entities/${entityId}`);
  return { data, meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}
