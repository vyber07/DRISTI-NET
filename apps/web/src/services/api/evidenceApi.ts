import { get, post, postForm, type ApiResponse } from "./real_client";
import type { EvidenceItem, EvidenceFilter } from "@/types/evidence";

export async function listEvidence(caseId: string, _filter?: EvidenceFilter): Promise<ApiResponse<EvidenceItem[]>> {
  const data = await get(`/cases/${caseId}/evidence`);
  return { data: Array.isArray(data) ? data : [], meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}

export async function getEvidenceById(evidenceId: string): Promise<ApiResponse<EvidenceItem | null>> {
  const data = await get(`/evidence/${evidenceId}`);
  return { data, meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}

export async function uploadEvidence(caseId: string, file: File, sourceLabel = "manual"): Promise<ApiResponse<any>> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("source_label", sourceLabel);
  const data = await postForm(`/cases/${caseId}/evidence`, fd);
  return { data, meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}

export async function processEvidence(evidenceId: string): Promise<ApiResponse<any>> {
  const data = await post(`/evidence/${evidenceId}/process`);
  return { data, meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}

export async function verifyEvidence(evidenceId: string): Promise<ApiResponse<any>> {
  const data = await get(`/evidence/${evidenceId}/verify`);
  return { data, meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}

export async function getEvidenceClaims(evidenceId: string, limit = 100): Promise<ApiResponse<any[]>> {
  const data = await get(`/evidence/${evidenceId}/claims?limit=${limit}`);
  return { data: Array.isArray(data) ? data : [], meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}

export async function getEvidenceContext(evidenceId: string, params?: { row?: number; page?: number; line?: number; window?: number }): Promise<ApiResponse<any>> {
  let url = `/evidence/${evidenceId}/context`;
  if (params) {
    const p = new URLSearchParams();
    if (params.row !== undefined) p.append("row", String(params.row));
    if (params.page !== undefined) p.append("page", String(params.page));
    if (params.line !== undefined) p.append("line", String(params.line));
    if (params.window !== undefined) p.append("window", String(params.window));
    const qs = p.toString();
    if (qs) url += `?${qs}`;
  }
  const data = await get(url);
  return { data, meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}

export async function revealEvidenceContext(evidenceId: string, reason: string, params?: { row?: number; page?: number; line?: number }): Promise<ApiResponse<any>> {
  const data = await post(`/evidence/${evidenceId}/context/reveal`, { reason, ...params });
  return { data, meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}
