export type AuditActionType =
  | "VIEW_CASE"
  | "VIEW_GRAPH"
  | "FILTER_GRAPH"
  | "EXPAND_NODE"
  | "VIEW_EVIDENCE"
  | "EXPORT_DOSSIER"
  | "CREATE_NOTE"
  | "UPDATE_NOTE"
  | "DELETE_NOTE"
  | "REVEAL_PII_REQUESTED"
  | "REVEAL_PII_APPROVED"
  | "REVEAL_PII_DENIED"
  | "ARBITRATE_CONTRADICTION"
  | "UPDATE_TIER"
  | "APPROVE_HITL_TASK"
  | "REJECT_HITL_TASK"
  | "ESCALATE_HITL_TASK";

export type AuditTargetType =
  | "CASE"
  | "ENTITY"
  | "RELATIONSHIP"
  | "EVIDENCE"
  | "NOTE"
  | "PII"
  | "GRAPH"
  | "HITL_TASK";

export interface AuditLogEntry {
  id: string;
  timestamp: string; // ISO 8601
  action: AuditActionType;
  actorBadgeNumber: string;
  actorName: string;
  actorRole: string;
  caseId: string;
  targetType?: AuditTargetType;
  targetId?: string;
  ipAddress: string;
  details: Record<string, unknown>;
  hash: string;
  previousHash?: string;
}

export interface AuditFilter {
  action?: AuditActionType;
  actorBadgeNumber?: string;
  targetType?: AuditTargetType;
  targetId?: string;
  startDate?: string;
  endDate?: string;
}
