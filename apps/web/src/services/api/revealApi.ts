import { post, type ApiResponse } from "./real_client";

import type { RevealRequest, RevealResult } from "@/types/reveal";

export async function requestPiiReveal(request: RevealRequest): Promise<ApiResponse<RevealResult>> {
  const data = await post(`/entities/${request.entityId}/reveal`, request);
  return { data, meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}
