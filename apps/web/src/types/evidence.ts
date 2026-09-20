import type { EvidenceTier } from "@/constants/evidenceTiers";
import type { AnalystSignoff } from "@/types/entity";

export type EvidenceSourceType =
  | "TELECOM"
  | "BANKING"
  | "LAW_ENFORCEMENT"
  | "SPATIAL_ANPR"
  | "SURVEILLANCE"
  | "CYBER_INTERCEPT";

export type ExtractionStatus =
  | "EXTRACTED"
  | "CORROBORATED"
  | "FLAGGED_CONTRADICTION"
  | "PENDING_REVIEW"
  | "SUPERVISOR_APPROVED";

export interface EvidenceItem {
  id: string;
  caseId: string;
  documentId: string;
  title: string;
  fileName: string;
  documentType: "CDR_RECORD" | "FIR_EXCERPT" | "BANK_STATEMENT" | "TOWER_DUMP_ANALYSIS";
  sourceType: EvidenceSourceType;
  sourceAgency: string;
  ingestedAt: string;
  evidenceTier: EvidenceTier;
  sha256Hash: string;
  rawArtifactId: string;
  rawArtifactSha256: string;
  provenanceRecordId: string;
  relatedEntityIds: string[];
  relatedRelationshipIds: string[];
  analystSignoff?: AnalystSignoff;
  extractionStatus: ExtractionStatus;
  extractedSnippet: string;
  confidence: number;
  mimeType: string;
  fileSizeBytes: number;
  isCourtAdmissible: boolean;
  bsaSection?: string;
}

export interface EvidenceFilter {
  sourceTypes?: EvidenceSourceType[];
  tiers?: EvidenceTier[];
  relatedEntityId?: string;
  searchTerm?: string;
}
