import { mockFetch, type ApiResponse } from "./client";
import { get } from "./real_client";
import {
  MOCK_CASE_DETAIL,
  MOCK_CASES_LIST,
  MOCK_CASE_STATS,
} from "@/mock/cases";
import type { CaseDetail, CaseSummary, CaseStats } from "@/types/case";

export async function getCaseDetails(
  caseId: string,
): Promise<ApiResponse<CaseDetail | null>> {
  try {
    const data = await get(`/cases/${caseId}`);
    return { data, meta: { requestId: '1', timestamp: '', durationMs: 0, securityClassification: '' } };
  } catch(e) {
    console.warn('Backend failed, fallback to mock');

  if (caseId === MOCK_CASE_DETAIL.id) {
    return mockFetch(MOCK_CASE_DETAIL, 150);
  }
  const found = MOCK_CASES_LIST.find((c) => c.id === caseId);
  if (found) {
    return mockFetch(
      {
        ...found,
        firNumber: `FIR No. ${found.caseNumber}`,
        policeStation: "District Cyber Police Station",
        incidentDate: found.registeredDate,
        actsAndSections: ["Sec 308(2) BNS 2023"],
        assignedTeam: [found.leadInvestigator],
        summaryNarrative: found.description,
        tags: ["INVESTIGATION"],
      },
      150,
    );
  }
  return mockFetch(null, 150);
  }
}

export async function listCases(): Promise<ApiResponse<CaseSummary[]>> {
  try {
    const data = await get(`/cases`);
    return { data, meta: { requestId: '1', timestamp: '', durationMs: 0, securityClassification: '' } };
  } catch(e) {
    console.warn('Backend failed, fallback to mock');

  return mockFetch(MOCK_CASES_LIST, 180);
  }
}

export async function getCaseStats(
  caseId: string,
): Promise<ApiResponse<CaseStats>> {
  void caseId;
  return mockFetch(MOCK_CASE_STATS, 120);
}
