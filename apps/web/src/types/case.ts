export interface InvestigatorInfo {
  username: string;
  name: string;
  role: string;
}

export interface CaseStats {
  totalEvidence: number;
  pendingTasks?: number;
}

/** A person assigned to the case, as returned by the API (`people`, added 2026-11-04). */
export interface CasePerson {
  user_id: string;
  display_name: string;
  role: string;
  purpose: string;
  is_owner: boolean;
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
  people: CasePerson[];
  sensitivity?: string;
}

export interface CaseDetail extends CaseSummary {
  // same fields, just explicit for detail view in case it expands later
}
