import type { EvidenceTier } from "@/constants/evidenceTiers";

export type TimelineEventType =
  | "COMMUNICATION"
  | "FINANCIAL_TRANSACTION"
  | "PHYSICAL_MOVEMENT"
  | "INCIDENT"
  | "SURVEILLANCE"
  | "FORENSIC_INGESTION"
  | "CONTRADICTION_FLAGGED"
  | "PROCEDURAL_ACTION";

export type TimelineCategory = "CRIME_EVENT" | "EVIDENTIARY" | "PROCEDURAL";

export interface TimelineLocation {
  name: string;
  latitude?: number;
  longitude?: number;
  entityId?: string;
}

export interface TimelineEvent {
  id: string;
  caseId: string;
  timestamp: string; // ISO 8601
  title: string;
  description: string;
  type: TimelineEventType;
  category: TimelineCategory;
  evidenceTier: EvidenceTier;
  confidence: number;
  primaryEntityId?: string;
  entityIds: string[];
  relationshipId?: string;
  evidenceId?: string;
  location?: TimelineLocation;
  hasContradiction?: boolean;
  contradictionNotes?: string;
  metadata?: Record<string, unknown>;
}

export interface TimelineFilter {
  types?: TimelineEventType[];
  categories?: TimelineCategory[];
  minTier?: EvidenceTier;
  entityId?: string;
  startTime?: string;
  endTime?: string;
  onlyContradictions?: boolean;
}
