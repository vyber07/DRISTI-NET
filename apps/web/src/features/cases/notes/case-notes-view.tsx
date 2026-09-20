import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FileText,
  Shield,
  Plus,
  AlertCircle,
  FilterX,
  RotateCcw,
  CheckCircle2,
  Brain,
  FileCheck2,
  Radio,
  Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NoteFilterBar } from "./note-filter-bar";
import { NoteCard } from "./note-card";
import { NoteComposerDialog } from "./note-composer-dialog";
import { useNotesStore } from "@/stores/notesStore";
import { maskSensitiveText } from "@/lib/pii";

interface CaseNotesViewProps {
  caseId: string;
}

export function CaseNotesView({ caseId }: CaseNotesViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const targetIdFromUrl = searchParams.get("targetId") || searchParams.get("entityId");

  const {
    notes,
    isLoading,
    error,
    successMessage,
    targetScope,
    loadNotes,
    setTargetScope,
    resetFilters,
    openComposer,
    getFilteredNotes,
  } = useNotesStore();

  useEffect(() => {
    if (targetIdFromUrl) {
      setTargetScope({ id: targetIdFromUrl, label: targetIdFromUrl });
    } else {
      loadNotes(caseId);
    }
  }, [caseId, targetIdFromUrl, loadNotes, setTargetScope]);

  const handleClearScope = () => {
    setTargetScope(null);
    setSearchParams({ tab: "notes" });
  };

  const filteredNotes = getFilteredNotes();

  // Metrics summary
  const hypothesisCount = notes.filter((n) => n.category === "HYPOTHESIS").length;
  const assessmentCount = notes.filter(
    (n) => n.category === "EVIDENCE_ASSESSMENT",
  ).length;
  const operationalCount = notes.filter(
    (n) => n.category === "OPERATIONAL",
  ).length;
  const proceduralCount = notes.filter(
    (n) => n.category === "LEGAL_PROCEDURAL",
  ).length;

  return (
    <div className="flex flex-col h-full w-full max-w-full min-w-0 bg-background overflow-hidden">
      <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 space-y-4">
        {/* Header & Title */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-electric-blue-soft" />
              <h2 className="text-base font-semibold text-text-primary tracking-tight">
                Case Investigative Notes &amp; Working Hypotheses
              </h2>
            </div>
            <p className="text-xs text-text-muted">
              Subjective operational assessments, contradiction analyses, and procedural memoranda authored by assigned investigators.
            </p>
          </div>

          {/* New Note Action */}
          <Button
            variant="primary"
            size="sm"
            onClick={() => openComposer(targetScope || undefined)}
            className="gap-1.5 text-xs font-medium"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Author Note</span>
          </Button>
        </div>

        {/* Governance Disclaimer Callout */}
        <div className="rounded-md border border-border-subtle bg-surface-2/40 p-2.5 text-micro text-text-muted flex items-start gap-2.5">
          <Shield className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold text-text-primary">
              Evidentiary Governance Notice:
            </span>
            <p className="text-text-secondary leading-relaxed">
              Notes represent working hypotheses and investigator assessments. They do not constitute certified legal ground truth under Bharatiya Sakshya Adhiniyam 2023. PII remains masked across all notes.
            </p>
          </div>
        </div>

        {/* Category Stat Pills */}
        <div className="flex flex-wrap items-center gap-2 text-micro font-mono">
          <div
            className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-semibold"
            style={{
              backgroundColor: "rgba(139, 92, 246, 0.12)",
              borderColor: "rgba(139, 92, 246, 0.30)",
              color: "#8B5CF6",
            }}
          >
            <Brain className="h-3 w-3 shrink-0" style={{ color: "#8B5CF6" }} />
            <span>{hypothesisCount === 1 ? "1 Hypothesis" : `${hypothesisCount} Hypotheses`}</span>
          </div>

          <div
            className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-semibold"
            style={{
              backgroundColor: "rgba(16, 185, 129, 0.12)",
              borderColor: "rgba(16, 185, 129, 0.30)",
              color: "#10B981",
            }}
          >
            <FileCheck2 className="h-3 w-3 shrink-0" style={{ color: "#10B981" }} />
            <span>{assessmentCount} Evidence Assessments</span>
          </div>

          <div
            className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-semibold"
            style={{
              backgroundColor: "rgba(245, 158, 11, 0.12)",
              borderColor: "rgba(245, 158, 11, 0.30)",
              color: "#F59E0B",
            }}
          >
            <Radio className="h-3 w-3 shrink-0" style={{ color: "#F59E0B" }} />
            <span>{operationalCount} Operational</span>
          </div>

          <div
            className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-semibold"
            style={{
              backgroundColor: "rgba(59, 130, 246, 0.12)",
              borderColor: "rgba(59, 130, 246, 0.30)",
              color: "#3B82F6",
            }}
          >
            <Scale className="h-3 w-3 shrink-0" style={{ color: "#3B82F6" }} />
            <span>{proceduralCount} Legal / Procedural</span>
          </div>
        </div>

        {/* Success feedback message */}
        {successMessage && (
          <div className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-2.5 text-xs text-emerald-400 animate-in fade-in duration-200">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </div>
        )}

        {/* Filter Bar */}
        <NoteFilterBar
          totalCount={notes.length}
          filteredCount={filteredNotes.length}
        />

        {/* State 1: Loading Skeleton */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-44 rounded-lg bg-surface-2 border border-border-subtle p-4 space-y-3"
              />
            ))}
          </div>
        )}

        {/* State 2: Error State */}
        {!isLoading && error && (
          <div className="rounded-lg border border-critical-red/40 bg-critical-red/10 p-6 text-center space-y-3 my-8">
            <AlertCircle className="h-8 w-8 text-critical-red mx-auto" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-text-primary">
                Unable to load analyst notes
              </h3>
              <p className="text-xs text-text-muted">{error}</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => loadNotes(caseId, targetScope?.id)}
              className="gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        )}

        {/* State 3: Empty State */}
        {!isLoading && !error && filteredNotes.length === 0 && (
          <div className="rounded-lg border border-border-subtle bg-surface-1/50 p-10 text-center space-y-3 my-8">
            <FilterX className="h-8 w-8 text-text-muted mx-auto" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-text-primary">
                {targetScope
                  ? `No analyst notes recorded for ${maskSensitiveText(targetScope.label || targetScope.id || "")}`
                  : "No notes match current filter criteria"}
              </h3>
              <p className="text-xs text-text-muted max-w-md mx-auto">
                {targetScope
                  ? "Be the first to record an investigative observation, behavioral pattern, or hypothesis for this object."
                  : "Broaden your filter parameters or author a new note to start building your case dossier."}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => openComposer(targetScope || undefined)}
                className="text-xs gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Author Note</span>
              </Button>
              {targetScope && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleClearScope}
                  className="text-xs"
                >
                  View Full Case Notes
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={resetFilters}
                className="text-xs"
              >
                Reset Filters
              </Button>
            </div>
          </div>
        )}

        {/* State 4: Notes Grid */}
        {!isLoading && !error && filteredNotes.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {filteredNotes.map((note) => (
              <NoteCard key={note.id} note={note} caseId={caseId} />
            ))}
          </div>
        )}
      </div>

      {/* Note Composer Modal */}
      <NoteComposerDialog caseId={caseId} />
    </div>
  );
}
