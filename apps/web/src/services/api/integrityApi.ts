import { get, post } from "./real_client";
import type { ApiResponse } from "./client";

export async function createIntegrityAnchor(caseId: string): Promise<ApiResponse<any>> {
  const data = await post(`/cases/${caseId}/integrity/anchor`);
  return { data, meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}

export async function listIntegrityAnchors(caseId: string): Promise<ApiResponse<any[]>> {
  const data = await get(`/cases/${caseId}/integrity/anchors`);
  return { data, meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}

export async function getIntegrityProof(caseId: string, anchorId: string, leafSha256: string): Promise<ApiResponse<any>> {
  const data = await get(`/cases/${caseId}/integrity/anchors/${anchorId}/proof/${leafSha256}`);
  return { data, meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}

export async function generateCourtPdf(caseId: string): Promise<ApiResponse<any>> {
  const data = await post(`/cases/${caseId}/report/court-pdf`);
  return { data, meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}
