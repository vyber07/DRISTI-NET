import type { EvidenceTier } from "@/constants/evidenceTiers";

export type CaseStatus = "ACTIVE" | "UNDER_REVIEW" | "CLOSED" | "ARCHIVED";

export type CasePriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type SecurityClassification =
  | "LAW_ENFORCEMENT_SENSITIVE"
  | "RESTRICTED"
  | "CONFIDENTIAL"
  | "SECRET"
  | "TOP_SECRET";

export interface InvestigatorInfo {
  badgeNumber: string;
  name: string;
  role: string;
  contact?: string;
}

export interface CaseStats {
  totalEntities: number;
  totalRelationships: number;
  totalEvidence: number;
  contradictionsCount: number;
  highestTier: EvidenceTier;
  activeAlerts?: number;
  notesCount?: number;
  pendingTasks?: number;
}

export interface CaseSummary {
  id: string;
  caseNumber: string;
  title: string;
  description: string;
  status: CaseStatus;
  priority: CasePriority;
  classification: SecurityClassification;
  jurisdiction: string;
  leadInvestigator: InvestigatorInfo;
  registeredDate: string;
  lastUpdated: string;
  stats: CaseStats;
}

export interface CaseDetail extends CaseSummary {
  firNumber: string;
  policeStation: string;
  incidentDate: string;
  actsAndSections: string[];
  assignedTeam: InvestigatorInfo[];
  summaryNarrative: string;
  tags: string[];
}
