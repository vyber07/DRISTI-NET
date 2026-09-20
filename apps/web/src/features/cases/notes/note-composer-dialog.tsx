import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNotesStore, type TargetScope } from "@/stores/notesStore";
import type { NoteCategory, NoteTargetType, AnalystNote, CreateNoteInput, UpdateNoteInput } from "@/types/note";
import { Shield, AlertCircle } from "lucide-react";

interface NoteComposerDialogProps {
  caseId: string;
}

const CATEGORIES: { value: NoteCategory; label: string; desc: string }[] = [
  {
    value: "HYPOTHESIS",
    label: "Working Hypothesis",
    desc: "Theories of syndicate MO, coordination patterns, or suspect motives",
  },
  {
    value: "EVIDENCE_ASSESSMENT",
    label: "Evidence Assessment",
    desc: "Analysis of CDR logs, bank statements, or spatio-temporal contradictions",
  },
  {
    value: "OPERATIONAL",
    label: "Operational Intel",
    desc: "Field observations, suspect movements, surveillance reports, or search notes",
  },
  {
    value: "LEGAL_PROCEDURAL",
    label: "Legal / Procedural",
    desc: "BNSS section notices, freezing orders, court requisitions, or FIR status",
  },
];

const TARGET_TYPES: { value: NoteTargetType; label: string }[] = [
  { value: "CASE", label: "Entire Case" },
  { value: "ENTITY", label: "Specific Entity" },
  { value: "RELATIONSHIP", label: "Relationship Channel" },
  { value: "EVIDENCE", label: "Evidentiary Artifact" },
];

export function NoteComposerDialog({ caseId }: NoteComposerDialogProps) {
  const {
    isComposerOpen,
    closeComposer,
    editingNote,
    defaultTargetScope,
    createNote,
    updateNote,
  } = useNotesStore();

  return (
    <Dialog open={isComposerOpen} onOpenChange={(open) => !open && closeComposer()}>
      {isComposerOpen && (
        <NoteComposerContent
          key={editingNote ? editingNote.id : `new-${defaultTargetScope?.id ?? "case"}`}
          caseId={caseId}
          editingNote={editingNote}
          defaultTargetScope={defaultTargetScope}
          closeComposer={closeComposer}
          createNote={createNote}
          updateNote={updateNote}
        />
      )}
    </Dialog>
  );
}

interface NoteComposerContentProps {
  caseId: string;
  editingNote: AnalystNote | null;
  defaultTargetScope: TargetScope | null;
  closeComposer: () => void;
  createNote: (input: CreateNoteInput) => Promise<AnalystNote>;
  updateNote: (noteId: string, input: UpdateNoteInput) => Promise<AnalystNote | null>;
}

function NoteComposerContent({
  caseId,
  editingNote,
  defaultTargetScope,
  closeComposer,
  createNote,
  updateNote,
}: NoteComposerContentProps) {
  const [category, setCategory] = useState<NoteCategory>(
    editingNote ? editingNote.category : "HYPOTHESIS"
  );
  const [targetType, setTargetType] = useState<NoteTargetType>(
    editingNote ? editingNote.targetType : (defaultTargetScope?.type || "CASE")
  );
  const [targetId, setTargetId] = useState(
    editingNote ? (editingNote.targetId || "") : (defaultTargetScope?.id || "")
  );
  const [targetLabel, setTargetLabel] = useState(
    editingNote ? (editingNote.targetLabel || "") : (defaultTargetScope?.label || "")
  );
  const [content, setContent] = useState(editingNote ? editingNote.content : "");
  const [tagsString, setTagsString] = useState(
    editingNote ? editingNote.tags.join(", ") : ""
  );
  const [isRestricted, setIsRestricted] = useState(
    editingNote?.isRestricted ?? false
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setValidationError("Note content is required.");
      return;
    }

    const tags = tagsString
      .split(",")
      .map((t) => t.trim().toUpperCase().replace(/\s+/g, "_"))
      .filter((t) => t.length > 0);

    setIsSubmitting(true);
    setValidationError(null);

    try {
      if (editingNote) {
        await updateNote(editingNote.id, {
          content: content.trim(),
          category,
          tags,
          isRestricted,
        });
      } else {
        await createNote({
          caseId,
          authorBadgeNumber: "USR-9921",
          authorName: "Insp. V. Rathore",
          authorRole: "Lead Investigating Officer",
          content: content.trim(),
          category,
          targetType,
          targetId: targetId.trim() || undefined,
          targetLabel: targetLabel.trim() || undefined,
          tags,
          isRestricted,
        });
      }
    } catch {
      setValidationError("Failed to save note. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingNote ? `Edit Note ${editingNote.id}` : "Author Analyst Note"}
          </DialogTitle>
          <DialogDescription>
            {editingNote
              ? "Update existing investigator assessment. Changes will update the last modified timestamp."
              : "Record working hypotheses, spatio-temporal observations, or procedural notes for this case."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {validationError && (
            <div className="flex items-center gap-2 rounded-md border border-critical-red/40 bg-critical-red/10 p-2 text-critical-red">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Category Selector */}
          <div className="space-y-1.5">
            <label
              htmlFor="note-category-select"
              className="text-micro font-semibold uppercase tracking-wider text-text-muted block"
            >
              Note Category
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`flex flex-col text-left p-2 rounded-md border transition-colors ${
                    category === cat.value
                      ? "bg-surface-3 border-electric-blue text-text-primary"
                      : "bg-surface-2 border-border-subtle text-text-secondary hover:border-border-strong hover:text-text-primary"
                  }`}
                >
                  <span className="font-semibold text-xs">{cat.label}</span>
                  <span className="text-micro text-text-muted truncate mt-0.5" title={cat.desc}>
                    {cat.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Target Type & Target ID (Create mode only) */}
          {!editingNote && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label
                  htmlFor="note-target-type-select"
                  className="text-micro font-semibold uppercase tracking-wider text-text-muted block"
                >
                  Target Scope
                </label>
                <select
                  id="note-target-type-select"
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value as NoteTargetType)}
                  className="w-full rounded-md border border-border-subtle bg-surface-2 px-2.5 py-1.5 text-xs text-text-primary focus:border-electric-blue focus:outline-none"
                >
                  {TARGET_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {targetType !== "CASE" && (
                <>
                  <div className="space-y-1">
                    <label
                      htmlFor="note-target-id-input"
                      className="text-micro font-semibold uppercase tracking-wider text-text-muted block"
                    >
                      Target Identifier
                    </label>
                    <input
                      id="note-target-id-input"
                      type="text"
                      value={targetId}
                      onChange={(e) => setTargetId(e.target.value)}
                      placeholder="e.g. E-PERS-01, R-04, DOC-CDR-2026-412"
                      className="w-full rounded-md border border-border-subtle bg-surface-2 px-2.5 py-1.5 text-xs font-mono text-text-primary placeholder:text-text-muted focus:border-electric-blue focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label
                      htmlFor="note-target-label-input"
                      className="text-micro font-semibold uppercase tracking-wider text-text-muted block"
                    >
                      Target Label / Name
                    </label>
                    <input
                      id="note-target-label-input"
                      type="text"
                      value={targetLabel}
                      onChange={(e) => setTargetLabel(e.target.value)}
                      placeholder="e.g. Vikramaditya Singhania, Hawala Route"
                      className="w-full rounded-md border border-border-subtle bg-surface-2 px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:border-electric-blue focus:outline-none"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Note Content Textarea */}
          <div className="space-y-1 pt-1">
            <label
              htmlFor="note-content-input"
              className="text-micro font-semibold uppercase tracking-wider text-text-muted block"
            >
              Investigative Assessment &amp; Observations
            </label>
            <textarea
              id="note-content-input"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              placeholder="Record forensic details, behavioral indicators, flight risk assessments, or working hypotheses. PII remains masked..."
              className="w-full rounded-md border border-border-subtle bg-surface-2 p-2.5 text-xs font-sans text-text-primary placeholder:text-text-muted focus:border-electric-blue focus:outline-none resize-y leading-relaxed"
            />
          </div>

          {/* Tags input */}
          <div className="space-y-1">
            <label
              htmlFor="note-tags-input"
              className="text-micro font-semibold uppercase tracking-wider text-text-muted block"
            >
              Tags (comma separated)
            </label>
            <input
              id="note-tags-input"
              type="text"
              value={tagsString}
              onChange={(e) => setTagsString(e.target.value)}
              placeholder="e.g. FLIGHT_RISK, LOC_SUBMITTED, MO, SYNDICATE"
              className="w-full rounded-md border border-border-subtle bg-surface-2 px-2.5 py-1.5 text-xs font-mono text-text-primary placeholder:text-text-muted focus:border-electric-blue focus:outline-none"
            />
          </div>

          {/* Restricted Checkbox */}
          <label className="flex items-center gap-2 cursor-pointer pt-1 select-none">
            <input
              type="checkbox"
              checked={isRestricted}
              onChange={(e) => setIsRestricted(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border-subtle bg-surface-2 text-electric-blue focus:ring-0"
            />
            <span className="text-micro text-text-secondary">
              Restrict access to Lead IO / Supervisory roles only (Need-to-Know)
            </span>
          </label>

          {/* Governance Notice */}
          <div className="rounded-md border border-border-subtle/80 bg-surface-2/40 p-2.5 text-micro text-text-muted flex items-start gap-2">
            <Shield className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-normal">
              <span className="font-semibold text-text-secondary">Official Police Record:</span> Analyst notes represent subjective investigative assessments and hypotheses. They do not constitute certified legal evidence. Entries are recorded under Officer USR-9921.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={closeComposer}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="gap-1.5"
            >
              <span>{editingNote ? "Update Note" : "Commit Note"}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
  );
}

