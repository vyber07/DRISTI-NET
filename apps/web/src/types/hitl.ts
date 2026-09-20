import type { EvidenceTier } from "@/constants/evidenceTiers";

export type HITLTaskType =
  | "ENTITY_MERGE"
  | "RELATIONSHIP_ARBITRATION"
  | "CONTRADICTION_RESOLUTION"
  | "TIER_ELEVATION";

export type HITLTaskStatus =
  | "PENDING"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "ESCALATED";

export type HITLTaskPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type HITLContradictionType =
  | "SPATIAL_TEMPORAL"
  | "IDENTITY_CONFLICT"
  | "SOURCE_DISCREPANCY"
  | "TIMELINE_SEQUENCE";

export type HITLDecisionAction =
  | "APPROVE_MERGE"
  | "REJECT_MERGE"
  | "ACCEPT_CLAIM_A"
  | "ACCEPT_CLAIM_B"
  | "ARBITRATE"
  | "ESCALATE"
  | "FLAG_CONTRADICTION";

export interface SimilarityMetric {
  metric: string;
  score: number;
  method: string;
  notes?: string;
}

export interface MatchedEntitySummary {
  id: string;
  name: string;
  type: string;
  attributes: Record<string, string>;
  piiMasked?: boolean;
}

export interface HITLProposedMatch {
  entityA: MatchedEntitySummary;
  entityB: MatchedEntitySummary;
  similarityScore: number;
  similarityMetrics: SimilarityMetric[];
  candidateReason: string;
}

export interface ContradictionClaimItem {
  sourceId: string;
  title: string;
  agency: string;
  timestamp: string;
  location?: string;
  evidenceId: string;
  rawArtifactId?: string;
  snippet: string;
  confidence: number;
}

export interface HITLContradictionClaim {
  contradictionType: HITLContradictionType;
  claimA: ContradictionClaimItem;
  claimB: ContradictionClaimItem;
  deltaExplanation: string;
  spatialDeltaKm?: number;
  temporalDeltaMinutes?: number;
}

export interface HITLTaskDecision {
  action: HITLDecisionAction;
  officerName: string;
  officerBadge: string;
  justification: string;
  arbitratedAt: string;
  newTier?: EvidenceTier;
  notes?: string;
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
  relationshipId?: string;
  relationshipType?: string;
  evidenceIds: string[];
  primaryEvidenceId: string;
  provenanceRecordId?: string;
  hasContradiction: boolean;
  contradictionType?: HITLContradictionType;
  proposedMatch?: HITLProposedMatch;
  contradictionData?: HITLContradictionClaim;
  proposedTierElevation?: {
    currentTier: EvidenceTier;
    proposedTier: EvidenceTier;
    elevationJustification: string;
  };
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
