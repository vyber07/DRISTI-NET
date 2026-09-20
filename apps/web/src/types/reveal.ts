import type { EntityIdentifier } from "@/types/entity";

export type RevealStatus = "APPROVED" | "DENIED" | "PENDING_SUPERVISOR";

export interface RevealRequest {
  caseId: string;
  entityId: string;
  identifierType: EntityIdentifier["type"];
  maskedValue: string;
  justification: string;
  requesterBadge: string;
  requesterName: string;
  requesterRole: string;
  officerClearance: number;
  emergencyBypass?: boolean;
}

export interface RevealResult {
  requestId: string;
  caseId: string;
  entityId: string;
  identifierType: EntityIdentifier["type"];
  maskedValue: string;
  unmaskedValue: string | null;
  status: RevealStatus;
  authorizedBy?: string;
  authorizedAt?: string;
  expiresAt?: string;
  auditId: string;
  denialReason?: string;
}
