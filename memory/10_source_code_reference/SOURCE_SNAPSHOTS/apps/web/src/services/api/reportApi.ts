import { post, type ApiResponse } from "./real_client";


export async function generateCaseReport(caseId: string, payload: any): Promise<ApiResponse<any>> {
  const data = await post(`/cases/${caseId}/report`, payload);
  return { data, meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}

export async function generateCourtPdf(caseId: string, payload: any): Promise<ApiResponse<any>> {
  const data = await post(`/cases/${caseId}/report/court-pdf`, payload);
  return { data, meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}
