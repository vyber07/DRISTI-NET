export type AlertCategory =
  | "TACTICAL"
  | "EVIDENCE"
  | "INTEGRITY"
  | "HITL"
  | "CONTRADICTION"
  | "SECURITY"
  | "SYSTEM";

export type AlertPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "INFO";

export type AlertStatus = "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED";

export interface AlertItem {
  id: string;
  title: string;
  description: string;
  category: AlertCategory;
  priority: AlertPriority;
  status: AlertStatus;
  timestamp: string; // ISO 8601
  triggerReason: string;
  caseId: string;
  caseTitle: string;
  affectedEntityId?: string;
  affectedEntityName?: string;
  supportingEvidenceId?: string;
  actionLabel: string;
  actionPath: string;
}

export interface AlertFilter {
  category?: AlertCategory | "ALL";
  priority?: AlertPriority | "ALL";
  status?: AlertStatus | "ALL";
  searchQuery?: string;
  caseId?: string;
}
