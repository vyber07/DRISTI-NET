import { post } from "./real_client";
import type { ApiResponse } from "./client";

export async function generateCaseReport(caseId: string, payload: any): Promise<ApiResponse<any>> {
  const data = await post(`/cases/${caseId}/report`, payload);
  return { data, meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}
