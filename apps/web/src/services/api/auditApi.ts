import { get, type ApiResponse } from "./real_client";


export async function listAuditLogs(caseId: string): Promise<ApiResponse<any[]>> {
  const data = await get(`/cases/${caseId}/audit`);
  return { data, meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}
