import { get, type ApiResponse } from "./real_client";

export async function listAuditLogs(caseId: string): Promise<ApiResponse<any[]>> {
  const data = await get(`/cases/${caseId}/audit`);
  return { data: Array.isArray(data) ? data : [], meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}

export async function listGlobalAuditLogs(limit = 200, action?: string): Promise<ApiResponse<any[]>> {
  let url = `/audit?limit=${limit}`;
  if (action) url += `&action=${encodeURIComponent(action)}`;
  const data = await get(url);
  return { data: Array.isArray(data) ? data : [], meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}
