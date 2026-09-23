export interface Job {
  job_id: string;
  kind: string;
  status: string;
  attempts: number;
  trace_id: string;
  error?: string;
  metrics?: Record<string, any>;
}

export interface EvidenceItem {
  evidence_id: string;
  case_id: string;
  version: number;
  filename: string;
  extension: string;
  detected_type: string;
  record_type: string;
  size_bytes: number;
  sha256: string;
  status: string;
  storage_area: string;
  source_label: string;
  uploaded_by: string;
  scan_engine: string | null;
  scan_result: string | null;
  error: string | null;
  retention_policy: string;
  legal_hold: boolean;
  tombstoned: boolean;
  created_at: string;
  updated_at: string;
  classification: string;
  jurisdiction: string;
  purpose: string;
  access_class: string;
  authority_reference: string;

  // Added when querying individual evidence item via get_evidence
  jobs?: Job[];
  claim_count?: number;
}

export interface EvidenceFilter {
  searchTerm?: string;
}
