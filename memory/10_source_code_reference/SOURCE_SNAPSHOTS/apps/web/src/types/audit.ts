export type AuditActionType =
  | "LOGIN"
  | "CASE_VIEW"
  | "ACCESS_DENIED"
  | "EVIDENCE_UPLOAD"
  | "SCAN_RESULT"
  | "REVIEW_DECISION"
  | "UNMASK"
  | "EXPORT"
  | string;

export interface AuditLogEntry {
  audit_id: string;
  trace_id: string;
  actor_id: string | null;
  action: AuditActionType;
  target_kind: string | null;
  target_id: string | null;
  case_id: string | null;
  outcome: string;
  detail: Record<string, unknown>;
  created_at: string;
}

export interface AuditFilter {
  action?: AuditActionType;
  actor_id?: string;
  target_kind?: string;
  target_id?: string;
  start_date?: string;
  end_date?: string;
}
