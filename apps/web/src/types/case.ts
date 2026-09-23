export interface InvestigatorInfo {
  username: string;
  name: string;
  role: string;
}

export interface CaseStats {
  totalEvidence: number;
  pendingTasks?: number;
}

export interface CaseSummary {
  id: string;
  title: string;
  classification: string;
  jurisdiction: string;
  purpose: string;
  authority_reference: string;
  owner_id: string;
  opened_at: string;
  evidence_count: number;
  pending_reviews: number;
  assigned: string[];
}

export interface CaseDetail extends CaseSummary {
  // same fields, just explicit for detail view in case it expands later
}
