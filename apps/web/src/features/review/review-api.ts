import { get, post } from "@/services/api/real_client";

/** Identity-match candidate exactly as the API returns it (routes/review_routes.py candidate_out). */
export interface RecordProfile {
  entity_id: string; kind: string; label: string;
  names?: string[]; aliases?: string[]; phones?: string[]; accounts?: string[]; orgs?: string[];
  dob?: string[]; address?: string[]; evidence_ids?: string[];
}
export interface Signal { signal?: string; attribute?: string; detail?: string; weight?: number; caveat?: string; [k: string]: unknown }
export interface ReviewRecord { review_id: string; decision: string; reason: string; reviewer_id: string; created_at: string; supersedes_id: string | null }
export interface Candidate {
  candidate_id: string; case_id: string; state: string; confidence: number; matcher_version: string; block_key: string;
  positive_signals: Signal[]; counter_evidence: Signal[]; conflicts: Signal[]; missing: { attribute: string; missing_on?: string[] }[];
  evidence_ids: string[]; created_at: string; assigned_to: string | null;
  left: RecordProfile; right: RecordProfile; reviews: ReviewRecord[]; new_evidence_since_snapshot?: string[];
}
export type Decision = "APPROVE" | "REJECT" | "DEFER" | "REVERSE";

export const listCandidates = (caseId: string) => get<Candidate[]>(`/cases/${encodeURIComponent(caseId)}/candidates`);
export const getCandidate = (id: string) => get<Candidate>(`/candidates/${encodeURIComponent(id)}`);
export const decide = (id: string, decision: Decision, reason: string) =>
  post<Candidate>(`/candidates/${encodeURIComponent(id)}/decision`, { decision, reason });
