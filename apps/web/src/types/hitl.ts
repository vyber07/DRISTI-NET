import type { EvidenceTier } from "@/constants/evidenceTiers";

export type HITLTaskType = "ENTITY_MERGE";

export type HITLTaskStatus =
  | "PENDING"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "ESCALATED";

export type HITLTaskPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type HITLDecisionAction =
  | "APPROVE_MERGE"
  | "REJECT_MERGE"
  | "DEFER"
  | "ESCALATE";

export interface MatchedEntitySummary {
  id: string;
  name: string;
  type: string;
  attributes: Record<string, string>;
}

export interface HITLProposedMatch {
  entityA: MatchedEntitySummary;
  entityB: MatchedEntitySummary;
  similarityScore: number;
  similarityMetrics: any[];
  candidateReason: string;
}

export interface HITLTaskDecision {
  action: HITLDecisionAction;
  officerName: string;
  officerBadge: string;
  justification: string;
  arbitratedAt: string;
}

export interface HITLTask {
  id: string;
  caseId: string;
  caseTitle: string;
  type: HITLTaskType;
  priority: HITLTaskPriority;
  status: HITLTaskStatus;
  title: string;
  description: string;
  confidence: number;
  flagManualReview: boolean;
  entityAId: string;
  entityAName: string;
  entityBId?: string;
  entityBName?: string;
  evidenceIds: string[];
  primaryEvidenceId: string;
  hasContradiction: boolean;
  proposedMatch?: HITLProposedMatch;
  assignedAnalyst?: {
    name: string;
    badge: string;
  };
  createdAt: string;
  updatedAt: string;
  slaDeadline: string;
  decision?: HITLTaskDecision;
}

export interface HITLFilter {
  caseId?: string;
  status?: HITLTaskStatus | "ALL";
  type?: HITLTaskType | "ALL";
  priority?: HITLTaskPriority | "ALL";
  searchQuery?: string;
}

export interface HITLStats {
  totalTasks: number;
  pendingCount: number;
  inReviewCount: number;
  resolvedCount: number;
  criticalCount: number;
  contradictionsCount: number;
  identityMergesCount: number;
}
