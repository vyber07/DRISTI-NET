import { get, type ApiResponse } from "./real_client";

import type { CaseDetail, CaseSummary } from "@/types/case";

function mapBackendCaseToFrontend(backend: any): CaseDetail {
  return {
    id: backend.case_id || "",
    title: backend.title || "Untitled Case",
    purpose: backend.purpose || "",
    classification: backend.classification || "RESTRICTED",
    jurisdiction: backend.jurisdiction || "",
    authority_reference: backend.authority_reference || "",
    owner_id: backend.owner_id || "",
    opened_at: backend.opened_at || new Date().toISOString(),
    evidence_count: backend.evidence_count || 0,
    pending_reviews: backend.pending_reviews || 0,
    assigned: backend.assigned || []
  };
}

export async function getCaseDetails(caseId: string): Promise<ApiResponse<CaseDetail | null>> {
  const data = await get(`/cases/${caseId}`);
  return { data: mapBackendCaseToFrontend(data), meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}

export async function listCases(): Promise<ApiResponse<CaseSummary[]>> {
  const data = await get(`/cases`);
  const mapped = Array.isArray(data) ? data.map(mapBackendCaseToFrontend) : [];
  return { data: mapped, meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}
