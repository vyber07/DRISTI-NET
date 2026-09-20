import { mockFetch, type ApiResponse } from "./client";
import { MOCK_NOTES } from "@/mock/notes";
import type { AnalystNote, CreateNoteInput, UpdateNoteInput } from "@/types/note";

// Working mutable copy for in-memory mutations during development/testing
let workingNotes: AnalystNote[] = [...MOCK_NOTES];

export async function listNotes(
  caseId: string,
  targetId?: string,
): Promise<ApiResponse<AnalystNote[]>> {
  let notes = workingNotes.filter((n) => !caseId || n.caseId === caseId);
  if (targetId) {
    notes = notes.filter((n) => n.targetId === targetId);
  }
  return mockFetch(notes, 150);
}

export async function createNote(
  input: CreateNoteInput,
): Promise<ApiResponse<AnalystNote>> {
  const newNote: AnalystNote = {
    id: `NOTE-${String(workingNotes.length + 1).padStart(3, "0")}`,
    caseId: input.caseId,
    authorBadgeNumber: input.authorBadgeNumber,
    authorName: input.authorName,
    authorRole: input.authorRole,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    content: input.content,
    category: input.category,
    targetType: input.targetType,
    targetId: input.targetId,
    targetLabel: input.targetLabel,
    tags: input.tags,
    isRestricted: input.isRestricted ?? false,
  };

  workingNotes = [newNote, ...workingNotes];
  return mockFetch(newNote, 200);
}

export async function updateNote(
  noteId: string,
  input: UpdateNoteInput,
): Promise<ApiResponse<AnalystNote | null>> {
  const index = workingNotes.findIndex((n) => n.id === noteId);
  if (index === -1) {
    return mockFetch(null, 150);
  }

  const existing = workingNotes[index];
  const updated: AnalystNote = {
    ...existing,
    content: input.content ?? existing.content,
    category: input.category ?? existing.category,
    tags: input.tags ?? existing.tags,
    isRestricted: input.isRestricted ?? existing.isRestricted,
    updatedAt: new Date().toISOString(),
  };

  workingNotes[index] = updated;
  return mockFetch(updated, 180);
}

export async function deleteNote(
  noteId: string,
): Promise<ApiResponse<{ success: boolean; noteId: string }>> {
  workingNotes = workingNotes.filter((n) => n.id !== noteId);
  return mockFetch({ success: true, noteId }, 150);
}
