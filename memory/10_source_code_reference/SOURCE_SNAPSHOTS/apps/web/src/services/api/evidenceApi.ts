import { get, getPaged, post, postForm, ApiError, TOKEN_KEY, type ApiResponse, type Paged } from "./real_client";
import type { EvidenceItem, EvidenceFilter } from "@/types/evidence";
import type { ContextResponse } from "@/types/entity";

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

export async function getEvidenceContext(evidenceId: string, params?: { row?: number; page?: number; line?: number; window?: number }): Promise<ApiResponse<ContextResponse>> {
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

export async function revealEvidenceContext(evidenceId: string, reason: string, params?: { row?: number; page?: number; line?: number }): Promise<ApiResponse<ContextResponse>> {
  const data = await post(`/evidence/${evidenceId}/context/reveal`, { reason, ...params });
  return { data, meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}

/**
 * Authenticated download of the original evidence bytes (DEF-029).
 * `window.open()` cannot send the Bearer token, and the previous call sites also built the URL from an
 * escaped template literal, so the request went to the literal path `/evidence/${item.evidence_id}/download`.
 * The server returns 409 while the item is quarantined; that error surfaces to the caller as an ApiError.
 */
/** DEF-101: roles that may download raw (unmasked) evidence -- the same roles that may reveal masked values. */
export const RAW_DOWNLOAD_ROLES = ["INVESTIGATOR", "REVIEWER", "ADMIN"];

export async function downloadEvidence(evidenceId: string, fallbackName: string, reason: string): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const t = localStorage.getItem(TOKEN_KEY);
    if (t) headers.Authorization = `Bearer ${t}`;
  } catch { /* storage unavailable: request goes unauthenticated and the server answers 401 */ }
  const base = import.meta.env.VITE_API_BASE_URL || "/api/v1";
  // POST so the audited reason travels in the body, never in a URL or access log (DEF-101)
  const res = await fetch(`${base}/evidence/${encodeURIComponent(evidenceId)}/download`, { method: "POST", headers, body: JSON.stringify({ reason }) });
  if (!res.ok) {
    let detail = res.statusText;
    try { const j = await res.json(); if (typeof j.detail === "string") detail = j.detail; } catch { /* non-JSON error body */ }
    throw new ApiError(res.status, detail, res.headers.get("X-Trace-Id") || undefined);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fallbackName || evidenceId;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Server-side search (file name, evidence id, start of SHA-256), status filter and paging. */
export function searchEvidence(caseId: string, opts: { q?: string; status?: string; limit?: number; offset?: number }): Promise<Paged<EvidenceItem>> {
  return getPaged<EvidenceItem>(`/cases/${encodeURIComponent(caseId)}/evidence`, opts);
}

export function getEvidenceSummary(caseId: string): Promise<{ case_id: string; total: number; by_status: Record<string, number> }> {
  return get(`/cases/${encodeURIComponent(caseId)}/evidence/summary`);
}
