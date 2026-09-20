import { get } from "./real_client";
import type { ApiResponse } from "./client";
import type { EvidenceItem, EvidenceFilter } from "@/types/evidence";

export async function listEvidence(caseId: string, filter?: EvidenceFilter): Promise<ApiResponse<EvidenceItem[]>> {
  const data = await get(`/cases/${caseId}/evidence`);
  return { data, meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}
export async function getEvidenceById(evidenceId: string): Promise<ApiResponse<EvidenceItem | null>> {
  const data = await get(`/evidence/${evidenceId}`);
  return { data, meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}
