import { create } from "zustand";
import type {
  AnalystNote,
  CreateNoteInput,
  UpdateNoteInput,
  NoteCategory,
  NoteTargetType,
} from "@/types/note";
import {
  listNotes,
  createNote as apiCreateNote,
  updateNote as apiUpdateNote,
  deleteNote as apiDeleteNote,
} from "@/services/api/notesApi";
import { recordAuditEvent } from "@/services/api/auditApi";
import { maskSensitiveText } from "@/lib/pii";

interface NoteFilterState {
  categories: Set<NoteCategory>;
  targetTypes: Set<NoteTargetType>;
  searchQuery: string;
  author: string | null;
}

export interface TargetScope {
  type?: NoteTargetType;
  id?: string;
  label?: string;
}

interface NotesState {
  notes: AnalystNote[];
  caseId: string;
  targetScope: TargetScope | null;
  selectedNoteId: string | null;
  isComposerOpen: boolean;
  editingNote: AnalystNote | null;
  defaultTargetScope: TargetScope | null;
  isLoading: boolean;
  error: string | null;
  successMessage: string | null;

  // Filters
  filters: NoteFilterState;

  // Actions
  loadNotes: (caseId: string, targetId?: string) => Promise<void>;
  setTargetScope: (scope: TargetScope | null) => void;
  selectNote: (noteId: string | null) => void;

  createNote: (input: CreateNoteInput) => Promise<AnalystNote>;
  updateNote: (noteId: string, input: UpdateNoteInput) => Promise<AnalystNote | null>;
  deleteNote: (noteId: string) => Promise<boolean>;

  openComposer: (defaultScope?: TargetScope) => void;
  closeComposer: () => void;
  openEditComposer: (note: AnalystNote) => void;

  toggleCategory: (cat: NoteCategory) => void;
  selectAllCategories: () => void;
  clearCategories: () => void;

  toggleTargetType: (type: NoteTargetType) => void;
  selectAllTargetTypes: () => void;
  clearTargetTypes: () => void;

  setSearchQuery: (query: string) => void;
  setAuthorFilter: (author: string | null) => void;
  resetFilters: () => void;
  clearSuccessMessage: () => void;

  // Selector
  getFilteredNotes: () => AnalystNote[];
}

const ALL_CATEGORIES: NoteCategory[] = [
  "HYPOTHESIS",
  "EVIDENCE_ASSESSMENT",
  "OPERATIONAL",
  "LEGAL_PROCEDURAL",
];

const ALL_TARGET_TYPES: NoteTargetType[] = [
  "CASE",
  "ENTITY",
  "RELATIONSHIP",
  "EVIDENCE",
];

const INITIAL_FILTERS: NoteFilterState = {
  categories: new Set(ALL_CATEGORIES),
  targetTypes: new Set(ALL_TARGET_TYPES),
  searchQuery: "",
  author: null,
};

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  caseId: "",
  targetScope: null,
  selectedNoteId: null,
  isComposerOpen: false,
  editingNote: null,
  defaultTargetScope: null,
  isLoading: false,
  error: null,
  successMessage: null,
  filters: { ...INITIAL_FILTERS },

  loadNotes: async (caseId: string, targetId?: string) => {
    set({ isLoading: true, error: null, caseId });
    try {
      const res = await listNotes(caseId, targetId);
      set({
        notes: res.data || [],
        isLoading: false,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load analyst notes";
      set({ error: msg, isLoading: false });
    }
  },

  setTargetScope: (scope: TargetScope | null) => {
    set({ targetScope: scope });
    const { caseId } = get();
    get().loadNotes(caseId, scope?.id);
  },

  selectNote: (noteId: string | null) => set({ selectedNoteId: noteId }),

  createNote: async (input: CreateNoteInput) => {
    const res = await apiCreateNote(input);
    const newNote = res.data;
    set((state) => ({
      notes: [newNote, ...state.notes],
      isComposerOpen: false,
      defaultTargetScope: null,
      successMessage: `Note ${newNote.id} authored successfully.`,
    }));
    try {
      await recordAuditEvent({
        action: "CREATE_NOTE",
        actorBadgeNumber: newNote.authorBadgeNumber,
        actorName: newNote.authorName,
        actorRole: newNote.authorRole,
        caseId: newNote.caseId,
        targetType: "NOTE",
        targetId: newNote.id,
        ipAddress: "10.42.18.101",
        details: {
          actionDescription: `Created note on ${newNote.targetType} ${newNote.targetId || ""}: "${newNote.content.slice(0, 60)}..."`,
          category: newNote.category,
        },
      });
    } catch {
      // Non-blocking audit recording
    }
    setTimeout(() => {
      get().clearSuccessMessage();
    }, 4000);
    return newNote;
  },

  updateNote: async (noteId: string, input: UpdateNoteInput) => {
    const res = await apiUpdateNote(noteId, input);
    const updated = res.data;
    if (updated) {
      set((state) => ({
        notes: state.notes.map((n) => (n.id === noteId ? updated : n)),
        isComposerOpen: false,
        editingNote: null,
        successMessage: `Note ${noteId} updated successfully.`,
      }));
      try {
        await recordAuditEvent({
          action: "UPDATE_NOTE",
          actorBadgeNumber: "USR-9921",
          actorName: "Insp. V. Rathore",
          actorRole: "Lead Investigating Officer",
          caseId: updated.caseId,
          targetType: "NOTE",
          targetId: noteId,
          ipAddress: "10.42.18.101",
          details: {
            actionDescription: `Updated analyst note ${noteId} assessment content`,
            category: updated.category,
          },
        });
      } catch {
        // Non-blocking audit recording
      }
      setTimeout(() => {
        get().clearSuccessMessage();
      }, 4000);
    }
    return updated;
  },

  deleteNote: async (noteId: string) => {
    await apiDeleteNote(noteId);
    set((state) => ({
      notes: state.notes.filter((n) => n.id !== noteId),
      successMessage: `Note ${noteId} deleted.`,
    }));
    try {
      await recordAuditEvent({
        action: "DELETE_NOTE",
        actorBadgeNumber: "USR-9921",
        actorName: "Insp. V. Rathore",
        actorRole: "Lead Investigating Officer",
        caseId: get().caseId,
        targetType: "NOTE",
        targetId: noteId,
        ipAddress: "10.42.18.101",
        details: {
          actionDescription: `Deleted analyst note ${noteId}`,
        },
      });
    } catch {
      // Non-blocking audit recording
    }
    setTimeout(() => {
      get().clearSuccessMessage();
    }, 4000);
    return true;
  },

  openComposer: (defaultScope?: TargetScope) => {
    set({
      isComposerOpen: true,
      editingNote: null,
      defaultTargetScope: defaultScope || null,
    });
  },

  closeComposer: () => {
    set({
      isComposerOpen: false,
      editingNote: null,
      defaultTargetScope: null,
    });
  },

  openEditComposer: (note: AnalystNote) => {
    set({
      isComposerOpen: true,
      editingNote: note,
      defaultTargetScope: null,
    });
  },

  toggleCategory: (cat: NoteCategory) =>
    set((state) => {
      const next = new Set(state.filters.categories);
      if (next.has(cat)) {
        if (next.size > 1) next.delete(cat);
      } else {
        next.add(cat);
      }
      return { filters: { ...state.filters, categories: next } };
    }),

  selectAllCategories: () =>
    set((state) => ({
      filters: { ...state.filters, categories: new Set(ALL_CATEGORIES) },
    })),

  clearCategories: () =>
    set((state) => ({
      filters: { ...state.filters, categories: new Set(["HYPOTHESIS"]) },
    })),

  toggleTargetType: (type: NoteTargetType) =>
    set((state) => {
      const next = new Set(state.filters.targetTypes);
      if (next.has(type)) {
        if (next.size > 1) next.delete(type);
      } else {
        next.add(type);
      }
      return { filters: { ...state.filters, targetTypes: next } };
    }),

  selectAllTargetTypes: () =>
    set((state) => ({
      filters: { ...state.filters, targetTypes: new Set(ALL_TARGET_TYPES) },
    })),

  clearTargetTypes: () =>
    set((state) => ({
      filters: { ...state.filters, targetTypes: new Set(["CASE"]) },
    })),

  setSearchQuery: (query: string) =>
    set((state) => ({
      filters: { ...state.filters, searchQuery: query },
    })),

  setAuthorFilter: (author: string | null) =>
    set((state) => ({
      filters: { ...state.filters, author },
    })),

  resetFilters: () =>
    set({
      filters: {
        categories: new Set(ALL_CATEGORIES),
        targetTypes: new Set(ALL_TARGET_TYPES),
        searchQuery: "",
        author: null,
      },
    }),

  clearSuccessMessage: () => set({ successMessage: null }),

  getFilteredNotes: () => {
    const { notes, filters, targetScope } = get();

    return notes.filter((n) => {
      // Target scope filter
      if (targetScope?.id && n.targetId !== targetScope.id) {
        return false;
      }
      if (targetScope?.type && n.targetType !== targetScope.type) {
        return false;
      }

      // Category filter
      if (!filters.categories.has(n.category)) {
        return false;
      }

      // Target type filter
      if (!filters.targetTypes.has(n.targetType)) {
        return false;
      }

      // Author filter
      if (filters.author && n.authorName !== filters.author) {
        return false;
      }

      // Search query filter
      if (filters.searchQuery.trim()) {
        const q = filters.searchQuery.toLowerCase();
        const matchContent = maskSensitiveText(n.content).toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
        const matchAuthor = maskSensitiveText(n.authorName).toLowerCase().includes(q) || n.authorName.toLowerCase().includes(q) || n.authorBadgeNumber.toLowerCase().includes(q);
        const matchLabel = (n.targetLabel ? maskSensitiveText(n.targetLabel).toLowerCase().includes(q) : false) || (n.targetLabel?.toLowerCase().includes(q) ?? false);
        const matchId = n.id.toLowerCase().includes(q) || n.targetId?.toLowerCase().includes(q);
        const matchTags = n.tags.some((t) => t.toLowerCase().includes(q));

        if (!matchContent && !matchAuthor && !matchLabel && !matchId && !matchTags) {
          return false;
        }
      }

      return true;
    });
  },
}));
