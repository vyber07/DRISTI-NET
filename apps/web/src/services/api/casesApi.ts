import { get } from "./real_client";
import type { ApiResponse } from "./client";
import type { CaseDetail, CaseSummary } from "@/types/case";

function mapBackendCaseToFrontend(backend: any): CaseDetail {
  return {
    id: backend.case_id || "",
    caseNumber: backend.case_id || "",
    title: backend.title || "Untitled Case",
    description: backend.purpose || "",
    status: "ACTIVE",
    priority: "HIGH",
    classification: backend.classification || "RESTRICTED",
    jurisdiction: backend.jurisdiction || "",
    leadInvestigator: { 
      badgeNumber: backend.owner_id || "Unknown", 
      name: backend.owner_id || "Unknown", 
      role: "Investigator" 
    },
    registeredDate: backend.opened_at || new Date().toISOString(),
    lastUpdated: backend.opened_at || new Date().toISOString(),
    stats: {
       totalEntities: 0,
       totalRelationships: 0,
       totalEvidence: backend.evidence_count || 0,
       contradictionsCount: 0,
       highestTier: "TIER_4",
       pendingTasks: backend.pending_reviews || 0
    },
    firNumber: backend.authority_reference || "",
    policeStation: backend.jurisdiction || "",
    incidentDate: backend.opened_at || new Date().toISOString(),
    actsAndSections: [],
    assignedTeam: (backend.assigned || []).map((u: string) => ({ badgeNumber: u, name: u, role: "Assigned" })),
    summaryNarrative: "",
    tags: []
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
