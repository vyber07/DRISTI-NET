import { post } from "./real_client";
import type { ApiResponse } from "./client";

export async function tamperEvidence(evidenceId: string): Promise<ApiResponse<void>> {
  const data = await post(`/demo/tamper/${evidenceId}`);
  return { data, meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}
