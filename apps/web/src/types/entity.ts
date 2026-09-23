import type { EvidenceTier } from "@/constants/evidenceTiers";

/** POLE+ entity classification (technical spec §19). */
export type EntityType =
  | "PERSON"
  | "ORGANIZATION"
  | "LOCATION"
  | "EVENT"
  | "FINANCIAL"
  | "CYBER";

/** Relationship classification — a representative subset from §19; extended in Phase 2. */
export type RelationshipType =
  | "COMMUNICATED_WITH"
  | "TRANSFERRED_FUNDS"
  | "USED_DEVICE"
  | "USED_PHONE"
  | "CO_LOCATED_AT"
  | "ASSOCIATED_IN_CASE";

export interface EntityIdentifier {
  type: "PHONE" | "ACCOUNT" | "IMEI" | "IP" | "AADHAAR" | "PAN" | "EMAIL" | "CUSTOM";
  value: string;
  maskedValue: string;
  isMasked: boolean;
  canRequestReveal?: boolean;
}

export interface EntitySummary {
  id: string;
  type: EntityType;
  /** Canonical display name — subject to masking policy before render. */
  displayName: string;
  /** Pre-masked representation, e.g. "+91-98*****210" — used when policy denies reveal. */
  maskedName?: string;
  isPiiMasked: boolean;
  confidence: number;
  evidenceTier: EvidenceTier;
  jurisdiction: string;
}

export interface EntityDetail {
  entity_id: string;
  kind: string;
  label: string;
  masked: boolean;
  attributes: Record<string, string>;
  access_class: number;
  cross_case?: {
    visible_cases: string[];
    restricted_case_count: number;
    total_cases: number;
  };
  claims?: any[];
}

export interface RelationshipSummary {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: RelationshipType;
  confidence: number;
  evidenceTier: EvidenceTier;
  hasContradiction: boolean;
}

export interface ContradictionSource {
  sourceId: string;
  claim: string;
  agency: string;
  timestamp: string;
  confidence: number;
  rawArtifactId?: string;
}

export interface ContradictionDetails {
  conflictingSources: ContradictionSource[];
  arbitrationStatus: "PENDING_IO_REVIEW" | "ARBITRATED" | "UNRESOLVED";
  arbitrationNotes: string;
}

export interface RelationshipDetail {
  id: string;
  type: string;
  label: string;
  sourceId: string;
  targetId: string;
  sourceLabel: string;
  targetLabel: string;
  count: number;
  weight: number;
  minConfidence: number;
  evidenceIds: string[];
  claimIds: string[];
  firstSeen: string | null;
  lastSeen: string | null;
  relevance: string;
}

/** Graphology Node Attributes consumed by GraphEngine */
export interface GraphNodeAttributes {
  id: string;
  label: string;
  x: number;
  y: number;
  size: number;
  color: string;
  entityType: string;
  degree: number;
  isMasked: boolean;
  hidden?: boolean;
  highlighted?: boolean;
  [key: string]: unknown;
}

/** Graphology Edge Attributes consumed by GraphEngine */
export interface GraphEdgeAttributes {
  id: string;
  source: string;
  target: string;
  label: string;
  relationshipType: string;
  count: number;
  weight: number;
  minConfidence: number;
  evidenceIds: string[];
  claimIds: string[];
  firstSeen: string | null;
  lastSeen: string | null;
  relevance: string;
  hidden?: boolean;
  highlighted?: boolean;
  size: number;
  color: string;
  [key: string]: unknown;
}

/** Bounding box overlay for document preview */
export interface BoundingBox {
  id: string;
  page: number;
  x: number; // percentage (0-100) or pt
  y: number;
  width: number;
  height: number;
  label: string;
  confidence: number;
  extractedValue: string;
}

/** Analyst evidentiary review and sign-off record */
export interface AnalystSignoff {
  officerName: string;
  badgeNumber: string;
  role: string;
  timestamp: string;
  notes?: string;
}

export interface ChainOfCustodyEntry {
  timestamp: string;
  actor: string;
  badgeNumber: string;
  action: string;
  verificationHash: string;
}

/** Provenance audit record connecting graph edge to original document */
export interface ProvenanceRecord {
  recordId: string;
  relationshipId: string;
  documentId: string;
  documentTitle: string;
  documentType: "CDR_RECORD" | "FIR_EXCERPT" | "BANK_STATEMENT" | "TOWER_DUMP_ANALYSIS";
  sourceType?: string;
  sourceAgency: string;
  ingestedAt: string;
  sha256Hash: string;
  rawArtifactId: string; // Tier 1 raw artifact ID
  rawArtifactSha256: string;
  evidenceTier: EvidenceTier;
  analystSignoff?: AnalystSignoff;
  boundingBoxes: BoundingBox[];
  extractedTextSnippet: string;
  extractionModel: string;
  extractionConfidence: number;
  chainOfCustody: ChainOfCustodyEntry[];
}

export interface ContextLine {
  n: number;
  text: string;
  hit: boolean;
}

export interface ContextResponse {
  evidence_id: string;
  filename: string;
  hash_match: boolean;
  locator: Record<string, any>;
  lines: ContextLine[];
}
