import { api, get, getPaged, post, request, type ApiResponse, type Paged } from "./real_client";
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

/**
 * Streaming upload (POST /cases/{id}/evidence/stream): the file is the raw request body, so the browser streams it
 * and sets Content-Length, and the server hashes and size-checks it as it arrives. Works for any size the upload
 * policy allows (large CCTV and disk images included). The server decides; the client-side check is a courtesy.
 */
export async function uploadEvidence(caseId: string, file: File, sourceLabel = "manual"): Promise<ApiResponse<any>> {
  const qs = new URLSearchParams({ filename: file.name, source_label: sourceLabel, process: "true" });
  const data = await api(`/cases/${encodeURIComponent(caseId)}/evidence/stream?${qs.toString()}`, {
    method: "POST",
    body: file,
    headers: { "Content-Type": "application/octet-stream" },
  });
  return { data, meta: { requestId: "req", timestamp: new Date().toISOString(), durationMs: 0, securityClassification: "REAL" } };
}

/** Mirrors routes/upload_policy_routes.py list_policies(). */
export interface UploadCategoryPolicy {
  category: string;
  description: string;
  extensions: string[];
  max_mb: number;
  max_bytes: number;
  enabled: boolean;
  content_extracted: boolean;
}

export async function getUploadPolicies(): Promise<{ policies: UploadCategoryPolicy[]; scanner_max_mb: number }> {
  return get(`/upload-policies`);
}

/** Client-side courtesy check against the server's policy, so an oversized or unsupported file fails before it is sent. */
export function checkUploadAgainstPolicy(file: File, policies: UploadCategoryPolicy[]): string | null {
  const dot = file.name.lastIndexOf(".");
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : "";
  const pol = policies.find((p) => p.extensions.includes(ext));
  if (!pol) return `Files of type ${ext || "(no extension)"} are not accepted.`;
  if (!pol.enabled) return `${pol.description} uploads are currently disabled by an administrator.`;
  if (file.size === 0) return "The file is empty.";
  if (file.size > pol.max_bytes) return `${file.name} is larger than the ${pol.max_mb.toLocaleString()} MB limit for ${pol.description.toLowerCase()}.`;
  return null;
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
// Mirrors the server's default RAW_FILE masking policy (ADMIN can never hold it). UI only: the server decides.
export const RAW_DOWNLOAD_ROLES = ["INVESTIGATOR", "REVIEWER"];

export async function downloadEvidence(evidenceId: string, fallbackName: string, reason: string): Promise<void> {
  // POST so the audited reason travels in the body, never in a URL or access log (DEF-101). Sent through the shared
  // client: session expiry, network failures and the request ID are handled as for every other call; never retried.
  const res = await request(`/evidence/${encodeURIComponent(evidenceId)}/download`, { method: "POST", body: JSON.stringify({ reason }) });
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
