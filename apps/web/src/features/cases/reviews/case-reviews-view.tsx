import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckSquare, RefreshCw, AlertTriangle, ChevronRight, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCaseReviews } from "@/services/api/casesApi";
import { makeClaimDecision } from "@/services/api/claimsApi";

export function CaseReviewsView() {
  const { caseId = "" } = useParams();
  const [reviews, setReviews] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionState, setActionState] = useState<Record<string, string>>({});

  const load = () => {
    if (!caseId) return;
    setIsLoading(true);
    getCaseReviews(caseId)
      .then((r) => setReviews(r.data || []))
      .catch((e) => setError(e.message || "Failed to load reviews"))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { load(); }, [caseId]);

  const handleClaimDecision = async (claimId: string, decision: string) => {
    setActionState((s) => ({ ...s, [claimId]: "loading" }));
    try {
      await makeClaimDecision(claimId, decision, "Reviewed via UI");
      setActionState((s) => ({ ...s, [claimId]: "done" }));
      load();
    } catch (e: any) {
      setActionState((s) => ({ ...s, [claimId]: `error: ${e.message}` }));
    }
  };

  const decisionIcon = (d: string) => {
    if (d === "APPROVE" || d === "ALLOWED") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
    if (d === "REJECT") return <XCircle className="h-3.5 w-3.5 text-red-400" />;
    return <Clock className="h-3.5 w-3.5 text-amber-400" />;
  };

  const decisionTone = (d: string) => {
    if (d === "APPROVE" || d === "ALLOWED") return "green";
    if (d === "REJECT") return "red";
    return "neutral";
  };

  return (
    <div className="flex flex-col h-full bg-bg-base overflow-y-auto">
      <div className="shrink-0 border-b border-border-subtle bg-surface-1 px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-electric-blue-soft" />
          <h2 className="text-sm font-bold font-mono tracking-wide uppercase text-text-primary">
            Reviews &amp; Decisions
          </h2>
          {reviews.length > 0 && <span className="text-xs text-text-muted">· {reviews.length} records</span>}
        </div>
        <Button variant="ghost" size="sm" className="text-xs gap-1.5" onClick={load} disabled={isLoading}>
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-electric-blue border-t-transparent" />
        </div>
      )}

      {error && (
        <div className="m-5 rounded-lg border border-red-400/30 bg-red-400/5 p-4 text-xs text-red-400 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      {!isLoading && !error && reviews.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <CheckCircle2 className="h-10 w-10 text-text-muted mx-auto" />
            <p className="text-sm text-text-muted">No review decisions recorded for this case.</p>
          </div>
        </div>
      )}

      {!isLoading && !error && reviews.length > 0 && (
        <div className="p-5 space-y-3 max-w-4xl mx-auto w-full">
          {reviews.map((r: any) => (
            <div key={r.review_id} className="rounded-xl border border-border-subtle bg-surface-1 p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  {decisionIcon(r.decision)}
                  <span className="font-mono text-xs font-semibold text-text-primary">{r.review_id}</span>
                  <ChevronRight className="h-3 w-3 text-text-muted shrink-0" />
                  <span className="text-xs text-text-muted">{r.target_kind}</span>
                  <span className="font-mono text-xs text-text-secondary truncate">{r.target_id}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge tone={decisionTone(r.decision) as any} className="text-micro">{r.decision}</Badge>
                  <span className="text-[10px] text-text-muted">{r.created_at?.substring(0, 10)}</span>
                </div>
              </div>

              {r.reason && (
                <p className="text-xs text-text-secondary italic border-l-2 border-border-strong pl-2">
                  "{r.reason}"
                </p>
              )}

              <div className="flex items-center justify-between text-[10.5px] text-text-muted border-t border-border-subtle pt-2">
                <span>Reviewer: <span className="font-mono">{r.reviewer_id}</span></span>
                {r.supersedes_id && <span>Supersedes: <span className="font-mono">{r.supersedes_id}</span></span>}
              </div>

              {/* Claim-level action buttons */}
              {r.target_kind === "CLAIM" && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[10.5px] text-text-muted">Override decision:</span>
                  {["ALLOWED", "REJECT", "CONTRADICTORY", "REVERSE"].map((d) => (
                    <Button
                      key={d}
                      variant="ghost"
                      size="sm"
                      className="text-[10px] h-6 px-2"
                      disabled={actionState[r.target_id] === "loading"}
                      onClick={() => handleClaimDecision(r.target_id, d)}
                    >
                      {d}
                    </Button>
                  ))}
                  {actionState[r.target_id] && actionState[r.target_id] !== "loading" && (
                    <span className="text-[10px] text-emerald-400">{actionState[r.target_id]}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
