import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { ReasonDialog } from "@/components/ui/reason-dialog";
import { CaseTabBody, EmptyState, ErrorState, LoadingState } from "@/components/layout/page";
import { getCaseReviews } from "@/services/api/casesApi";
import { makeClaimDecision } from "@/services/api/claimsApi";
import { useAuthStore } from "@/stores/authStore";
import { can, deniedReason } from "@/lib/permissions";
import { useCase } from "../case-context";
import { formatDateTime } from "../evidence/evidence-format";

const CLAIM_DECISIONS = [
  { code: "APPROVE", label: "Approve" },
  { code: "REJECT", label: "Reject" },
  { code: "CONTRADICTORY", label: "Mark contradictory" },
  { code: "REVERSE", label: "Reverse" },
];

/**
 * Decisions: every review decision in the case, newest first, with the reviewer's name and reason. Match decisions
 * link to their candidate; claim decisions can be revised (with a reason) by roles that may decide.
 */
export function CaseReviewsView() {
  const { caseId, personName } = useCase();
  const role = useAuthStore((s) => s.user?.role);
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState<{ message: string; trace?: string } | null>(null);
  const [pending, setPending] = useState<{ claimId: string; decision: string; label: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    getCaseReviews(caseId).then((r) => setRows(r.data)).catch((e) => setError({ message: e?.message || "Request failed", trace: e?.trace }));
  }, [caseId]);
  useEffect(() => { setRows(null); load(); }, [load]);

  const submit = async (reason: string) => {
    if (!pending) return null;
    try {
      await makeClaimDecision(pending.claimId, pending.decision, reason);
      setNotice(`Recorded “${pending.label}” for claim ${pending.claimId}.`);
      load();
      return null;
    } catch (e: any) {
      return e?.status === 403 ? deniedReason(role, "record review decisions") : (e?.message || "The decision was not recorded.");
    }
  };

  return (
    <CaseTabBody title="Decisions" description="Every human review decision in this case, newest first. A later decision supersedes an earlier one; nothing is deleted.">
      {notice && <p role="status" className="text-sm text-verified-emerald">{notice}</p>}
      {error ? <ErrorState message={error.message} trace={error.trace} onRetry={load} /> : rows === null ? <LoadingState label="Loading decisions…" /> : rows.length === 0 ? (
        <EmptyState title="No decisions yet">
          Decisions appear here once a reviewer acts on the <Link className="text-electric-blue hover:underline" to={`/cases/${encodeURIComponent(caseId)}/review`}>review queue</Link>.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-subtle bg-surface-1">
          <table className="w-full text-sm" data-testid="decisions-table">
            <caption className="sr-only">Review decisions</caption>
            <thead className="bg-surface-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
              <tr>
                <th scope="col" className="px-3 py-2">Decision</th>
                <th scope="col" className="px-3 py-2">About</th>
                <th scope="col" className="px-3 py-2">Reason</th>
                <th scope="col" className="px-3 py-2">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {rows.map((r) => (
                <tr key={r.review_id} className="align-top">
                  <td className="px-3 py-2.5"><StatusBadge kind="review" code={r.decision} />{r.supersedes_id && <span className="mt-1 block text-xs text-text-secondary">supersedes an earlier decision</span>}</td>
                  <td className="px-3 py-2.5">
                    {r.target_kind === "MATCH"
                      ? <Link className="text-electric-blue hover:underline" to={`/cases/${encodeURIComponent(caseId)}/review/${r.target_id}`}>Identity candidate</Link>
                      : <span>{r.target_kind === "CLAIM" ? "Claim" : r.target_kind}</span>}
                    <span className="block font-mono text-xs text-text-secondary">{r.target_id}</span>
                    {r.target_kind === "CLAIM" && can(role, "decide") && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {CLAIM_DECISIONS.map((d) => (
                          <Button key={d.code} variant="ghost" size="sm" onClick={() => setPending({ claimId: r.target_id, decision: d.code, label: d.label })}>{d.label}</Button>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-text-primary max-w-md">{r.reason || "—"}</td>
                  <td className="px-3 py-2.5 text-text-secondary whitespace-nowrap">{personName(r.reviewer_id)}<span className="block text-xs">{formatDateTime(r.created_at)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ReasonDialog open={!!pending} onOpenChange={(o) => { if (!o) setPending(null); }}
        title={pending ? `${pending.label}: claim ${pending.claimId}` : ""}
        description="This adds a new decision that supersedes the current one. The earlier decision stays in the history."
        confirmLabel="Record decision" onConfirm={submit} />
    </CaseTabBody>
  );
}
