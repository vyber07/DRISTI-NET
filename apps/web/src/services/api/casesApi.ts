import { get, getPaged, post, type ApiResponse, type Paged } from "./real_client";
import type { CaseDetail, CasePerson, CaseSummary } from "@/types/case";

/** Response contract shared with apps/api/app/schemas.py::CaseOut. */
interface BackendCase {
  case_id: string;
  title: string;
  purpose: string;
  classification: string;
  jurisdiction: string;
  authority_reference: string;
  owner_id: string;
  opened_at: string;
  evidence_count: number;
  pending_reviews: number;
  assigned: string[];
  people: CasePerson[];
  sensitivity: string;
}

function mapBackendCaseToFrontend(backend: BackendCase): CaseDetail {
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
    assigned: backend.assigned || [],
    people: Array.isArray(backend.people) ? backend.people : [],
    sensitivity: backend.sensitivity,
  };
}

export async function getCaseDetails(caseId: string): Promise<ApiResponse<CaseDetail | null>> {
  const data = await get<BackendCase>(`/cases/${caseId}`);
  return { data: mapBackendCaseToFrontend(data), meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}

export async function listCases(): Promise<ApiResponse<CaseSummary[]>> {
  const data = await get<BackendCase[]>(`/cases`);
  const mapped = Array.isArray(data) ? data.map(mapBackendCaseToFrontend) : [];
  return { data: mapped, meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}

export async function getCaseStats(caseId: string): Promise<ApiResponse<any>> {
  const data = await get(`/cases/${caseId}/stats`);
  return { data, meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}

export async function getCaseContradictions(caseId: string): Promise<ApiResponse<any[]>> {
  const data = await get(`/cases/${caseId}/contradictions`);
  return { data: Array.isArray(data) ? data : [], meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}

export async function getCaseLocations(caseId: string): Promise<ApiResponse<any>> {
  const data = await get(`/cases/${caseId}/locations`);
  return { data, meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}

export async function getCaseAnalysis(caseId: string, tFrom?: string, tTo?: string): Promise<ApiResponse<any>> {
  let url = `/cases/${caseId}/analysis`;
  const params = new URLSearchParams();
  if (tFrom) params.append("t_from", tFrom);
  if (tTo) params.append("t_to", tTo);
  const qs = params.toString();
  if (qs) url += `?${qs}`;
  const data = await get(url);
  return { data, meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}

export async function getCaseReviews(caseId: string): Promise<ApiResponse<any[]>> {
  const data = await get(`/cases/${caseId}/reviews`);
  return { data: Array.isArray(data) ? data : [], meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}

export async function assignCase(caseId: string, username: string, purpose = "investigator"): Promise<ApiResponse<any>> {
  const data = await post(`/cases/${caseId}/assign`, { username, purpose });
  return { data, meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}

/** Server-side search and paging over the cases this account may open (X-Total-Count = all matches). */
export async function searchCases(opts: { q?: string; awaitingReview?: boolean; limit?: number; offset?: number }): Promise<Paged<CaseSummary>> {
  const r = await getPaged<BackendCase>(`/cases`, { q: opts.q, awaiting_review: opts.awaitingReview, limit: opts.limit, offset: opts.offset });
  return { items: r.items.map(mapBackendCaseToFrontend), total: r.total };
}

export async function createCase(body: { case_id: string; title: string; jurisdiction: string; purpose: string; authority_reference: string }): Promise<CaseDetail> {
  return mapBackendCaseToFrontend(await post<BackendCase>(`/cases`, body));
}

export interface UserSummary { user_id: string; username: string; display_name: string; role: string; jurisdiction: string }
/** GET /users — allowed for ADMIN, AUDITOR, INVESTIGATOR (others get 403; the assign dialog then asks for a username). */
export function listUsers(): Promise<UserSummary[]> {
  return get(`/users`);
}
