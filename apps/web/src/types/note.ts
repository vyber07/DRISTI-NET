export type NoteTargetType = "CASE" | "ENTITY" | "RELATIONSHIP" | "EVIDENCE";

export type NoteCategory =
  | "HYPOTHESIS"
  | "EVIDENCE_ASSESSMENT"
  | "OPERATIONAL"
  | "LEGAL_PROCEDURAL";

export interface AnalystNote {
  id: string;
  caseId: string;
  authorBadgeNumber: string;
  authorName: string;
  authorRole: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  content: string;
  category: NoteCategory;
  targetType: NoteTargetType;
  targetId?: string;
  targetLabel?: string;
  tags: string[];
  isRestricted?: boolean;
}

export interface CreateNoteInput {
  caseId: string;
  authorBadgeNumber: string;
  authorName: string;
  authorRole: string;
  content: string;
  category: NoteCategory;
  targetType: NoteTargetType;
  targetId?: string;
  targetLabel?: string;
  tags: string[];
  isRestricted?: boolean;
}

export interface UpdateNoteInput {
  content?: string;
  category?: NoteCategory;
  tags?: string[];
  isRestricted?: boolean;
}
