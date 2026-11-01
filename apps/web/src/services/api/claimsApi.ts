import { get, post, type ApiResponse } from "./real_client";

export async function getClaimById(claimId: string): Promise<ApiResponse<any>> {
  const data = await get(`/claims/${claimId}`);
  return { data, meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}

export async function makeClaimDecision(claimId: string, decision: string, reason?: string): Promise<ApiResponse<any>> {
  const data = await post(`/claims/${claimId}/decision`, { decision, reason: reason || "" });
  return { data, meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}
