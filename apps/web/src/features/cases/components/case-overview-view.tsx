import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Anchor, ArrowRight, BarChart3, CheckCircle2, Info, FileStack, FileText, GitCompare, Hourglass, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, evidenceStatusInfo } from "@/components/ui/status-badge";
import { CaseTabBody, FactList, Section } from "@/components/layout/page";
import { getCaseContradictions, getCaseReviews } from "@/services/api/casesApi";
import { getEvidenceSummary } from "@/services/api/evidenceApi";
import { createIntegrityAnchor, listIntegrityAnchors } from "@/services/api/integrityApi";
import { useProvenanceStore } from "@/stores/provenanceStore";
import { useAuthStore } from "@/stores/authStore";
import { can, roleLabel } from "@/lib/permissions";
import { useCase } from "../case-context";
import { candidatesSummary } from "@/features/review/review-api";
import { getTimelineEvents } from "@/services/api/timelineApi";
import { recordedDateKey } from "@/lib/utils";
import { ColumnChart, EVIDENCE_GROUP_COLORS, EVIDENCE_GROUP_LABEL, REVIEW_COLORS, SegmentedBar, StatTile, evidenceGroup } from "@/components/ui/charts";

/**
 * Dated events bucketed by month, quarter or year (whichever keeps the chart readable for the span), with empty
 * buckets kept so gaps show as gaps. Recorded dates, no zone shift.
 */
function monthlyCounts(events: { time?: string | null }[]): { key: string; label: string; value: number }[] {
  const days = events.map((e) => recordedDateKey(e.time ?? null)).filter((d): d is string => !!d).sort();
  if (!days.length) return [];
  const [y0, m0] = days[0].split("-").map(Number);
  const [y1, m1] = days[days.length - 1].split("-").map(Number);
  const months = (y1 - y0) * 12 + (m1 - m0) + 1;
  const unit = months <= 18 ? "month" : months <= 60 ? "quarter" : "year";
  const keyOf = (d: string) => {
    const [y, m] = d.split("-").map(Number);
    return unit === "month" ? `${y}-${String(m).padStart(2, "0")}` : unit === "quarter" ? `${y}-Q${Math.floor((m - 1) / 3) + 1}` : `${y}`;
  };
  const counts = new Map<string, number>();
  for (const d of days) counts.set(keyOf(d), (counts.get(keyOf(d)) || 0) + 1);
  const out: { key: string; label: string; value: number }[] = [];
  const monthName = (m: number) => new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2000, m - 1, 1)));
  let y = y0, step = unit === "month" ? m0 : unit === "quarter" ? Math.floor((m0 - 1) / 3) + 1 : 1;
  for (let guard = 0; guard < 400; guard++) {
    const k = unit === "month" ? `${y}-${String(step).padStart(2, "0")}` : unit === "quarter" ? `${y}-Q${step}` : `${y}`;
    const label = unit === "month" ? `${monthName(step)} ${String(y).slice(2)}` : unit === "quarter" ? `Q${step} ${String(y).slice(2)}` : `${y}`;
    out.push({ key: k, label, value: counts.get(k) || 0 });
    if (k === keyOf(days[days.length - 1])) break;
    if (unit === "year") y++;
    else { step++; const max = unit === "month" ? 12 : 4; if (step > max) { step = 1; y++; } }
  }
  return out;
}
import { AssignPersonDialog } from "./assign-person-dialog";
import { formatDate } from "../case-table";

/** Optional section data: each loads on its own and says when it is unavailable instead of failing silently. */
type Part<T> = { data: T | null; error: string | null };
const empty = <T,>(): Part<T> => ({ data: null, error: null });
const wrap = <T,>(p: Promise<{ data: T }>, set: (v: Part<T>) => void) =>
  p.then((r) => set({ data: r.data, error: null })).catch((e) => set({ data: null, error: e?.message || "unavailable" }));

/**
 * Case overview: what the case is, who is on it, the state of its evidence and reviews, open contradictions,
 * recent decisions and integrity anchors. Replaces the old overview plus the right-hand "Case information" panel
 * (which repeated the same fields on every tab) and the "Investigation Modules" buttons (duplicates of the tabs).
 */
export function CaseOverviewView() {
  const { caseId, caseData: c, personName, reload: reloadCase } = useCase();
  const [assigning, setAssigning] = useState(false);
  const { user } = useAuthStore();
  const openSource = useProvenanceStore((s) => s.openProvenanceForRecord);
  const [evidence, setEvidence] = useState<Part<{ total: number; by_status: Record<string, number> }>>(empty);
  const [contradictions, setContradictions] = useState<Part<any[]>>(empty);
  const [reviews, setReviews] = useState<Part<any[]>>(empty);
  const [anchors, setAnchors] = useState<Part<any[]>>(empty);
  const [anchorMsg, setAnchorMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [anchorBusy, setAnchorBusy] = useState(false);
  const [reviewStates, setReviewStates] = useState<{ total: number; by_state: Record<string, number> } | null>(null);
  const [activity, setActivity] = useState<{ key: string; label: string; value: number }[] | null>(null);

  const loadAnchors = useCallback(() => {
    if (can(user?.role, "listAnchors")) wrap(listIntegrityAnchors(caseId) as any, setAnchors);
  }, [caseId, user?.role]);

  useEffect(() => {
    wrap(getEvidenceSummary(caseId).then((data) => ({ data })), setEvidence);
    wrap(getCaseContradictions(caseId), setContradictions);
    wrap(getCaseReviews(caseId), setReviews);
    candidatesSummary(caseId).then(setReviewStates).catch(() => setReviewStates({ total: 0, by_state: {} }));
    getTimelineEvents(caseId).then((r) => setActivity(monthlyCounts((r.data as any)?.events ?? []))).catch(() => setActivity([]));
    loadAnchors();
  }, [caseId, user?.role, loadAnchors]);

  const byStatus = evidence.data?.by_status ?? {};
  const base = `/cases/${encodeURIComponent(caseId)}`;

  const createAnchor = async () => {
    setAnchorBusy(true); setAnchorMsg(null);
    try {
      await createIntegrityAnchor(caseId);
      setAnchorMsg({ ok: true, text: "Integrity anchor recorded (Merkle root of the case's accepted evidence hashes)." });
      loadAnchors();
    } catch (e: any) {
      setAnchorMsg({ ok: false, text: e?.message || "Could not create the anchor." });
    } finally { setAnchorBusy(false); }
  };

  return (
    <CaseTabBody title="Overview" description={c.purpose}>
      {c.pending_reviews > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber/40 bg-amber/10 px-4 py-3">
          <p className="text-sm text-text-primary">
            <strong>{c.pending_reviews}</strong> candidate match{c.pending_reviews === 1 ? "" : "es"} need{c.pending_reviews === 1 ? "s" : ""} a human decision before {c.pending_reviews === 1 ? "it is" : "they are"} used in the graph.
          </p>
          <Button asChild variant={can(user?.role, "decide") ? "primary" : "secondary"} size="sm" className="gap-1.5">
            <Link to={`${base}/review`}>Open review queue <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Case summary">
        <StatTile icon={<FileStack className="h-5 w-5" />} label="Evidence items" value={evidence.data?.total ?? c.evidence_count} tone="blue" />
        <StatTile icon={<Hourglass className="h-5 w-5" />} label="Awaiting review" value={c.pending_reviews} tone="amber" />
        <StatTile icon={<GitCompare className="h-5 w-5" />} label="Contradictions" value={contradictions.data ? contradictions.data.length : "—"} tone="violet" />
        <StatTile icon={<Users className="h-5 w-5" />} label="People on the case" value={c.people.length || c.assigned.length} tone="teal" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Case details" className="lg:col-span-2" icon={<Info className="h-4 w-4" />}>
          <FactList columns={2} items={[
            { label: "Authority reference", value: <span className="font-mono">{c.authority_reference || "—"}</span> },
            { label: "Jurisdiction", value: c.jurisdiction },
            { label: "Classification", value: c.classification.replace(/_/g, " ") },
            { label: "Opened", value: formatDate(c.opened_at) },
            { label: "Owner", value: personName(c.owner_id) },
            { label: "Case number", value: <span className="font-mono">{c.id}</span> },
          ]} />
        </Section>
        <Section title={`People on this case (${c.people.length || c.assigned.length})`} icon={<Users className="h-4 w-4" />}
          actions={(user?.role === "ADMIN" || user?.user_id === c.owner_id) ? (
            <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => setAssigning(true)}><UserPlus className="h-3.5 w-3.5" aria-hidden="true" /> Add person</Button>
          ) : undefined}>
          {c.people.length ? (
            <ul className="space-y-2">
              {c.people.map((p) => (
                <li key={p.user_id} className="text-sm">
                  <span className="text-text-primary">{p.display_name}</span>
                  <span className="block text-xs text-text-secondary">{roleLabel(p.role)}{p.org_user_id ? <> · <span className="font-mono">{p.org_user_id}</span></> : null}{p.is_owner ? " · owner" : ""}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-text-secondary">{c.assigned.length} assigned (names unavailable from this server).</p>}
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Evidence status" icon={<FileStack className="h-4 w-4" />} actions={<Link to={`${base}/evidence`} className="text-sm text-electric-blue hover:underline">Open evidence</Link>}>
          {evidence.error ? <p className="text-sm text-text-secondary">Evidence summary unavailable: {evidence.error}</p>
            : evidence.data === null ? <p className="text-sm text-text-secondary">Loading…</p>
            : evidence.data.total === 0 ? <p className="text-sm text-text-secondary">No evidence uploaded yet.</p>
            : (
              <div className="space-y-4">
                <SegmentedBar title="Evidence by processing status" unit="files" testId="overview-evidence-chart"
                  parts={(Object.keys(EVIDENCE_GROUP_COLORS) as (keyof typeof EVIDENCE_GROUP_COLORS)[]).map((k) => ({
                    key: k, label: EVIDENCE_GROUP_LABEL[k], color: EVIDENCE_GROUP_COLORS[k],
                    value: Object.entries(byStatus).filter(([st]) => evidenceGroup(st) === k).reduce((n, [, v]) => n + v, 0),
                  }))} />
                <ul className="space-y-1.5 border-t border-border-subtle pt-3" aria-label="Evidence by exact status">
                  {Object.entries(byStatus).sort((a, b) => b[1] - a[1]).map(([status, n]) => (
                    <li key={status} className="flex items-center justify-between gap-2">
                      <StatusBadge code={status} />
                      <span className="text-sm tabular-nums text-text-primary">{n} <span className="sr-only">items, {evidenceStatusInfo(status).hint}</span></span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
        </Section>
        <Section title="Review progress" icon={<Hourglass className="h-4 w-4" />} actions={<Link to={`${base}/review`} className="text-sm text-electric-blue hover:underline">Open queue</Link>}>
          {reviewStates === null ? <p className="text-sm text-text-secondary">Loading…</p>
            : !reviewStates.total ? <p className="text-sm text-text-secondary">No candidate matches in this case.</p>
            : (
              <div className="space-y-4">
                <SegmentedBar title="Candidate matches by review state" unit="candidates" testId="overview-review-chart"
                  parts={[
                    { key: "approved", label: "Approved", value: reviewStates.by_state.APPROVE || 0, color: REVIEW_COLORS.approved },
                    { key: "rejected", label: "Rejected", value: reviewStates.by_state.REJECT || 0, color: REVIEW_COLORS.rejected },
                    { key: "pending", label: "Needs review", value: reviewStates.by_state.REVIEW_REQUIRED || 0, color: REVIEW_COLORS.pending },
                    { key: "deferred", label: "Deferred", value: reviewStates.by_state.DEFER || 0, color: REVIEW_COLORS.deferred },
                  ]} />
                <FactList columns={2} items={[
                  { label: "Decided", value: <span className="tabular-nums">{(reviewStates.by_state.APPROVE || 0) + (reviewStates.by_state.REJECT || 0)} of {reviewStates.total}</span> },
                  { label: "Decisions recorded (incl. reversals)", value: <span className="tabular-nums">{reviews.data ? reviews.data.length : "—"}</span> },
                ]} />
              </div>
            )}
        </Section>
      </div>

      <Section title="Activity over time" icon={<BarChart3 className="h-4 w-4" />}
        description="Dated candidate events extracted from the evidence, grouped by month, quarter or year to fit the span (dates as recorded in the sources)."
        actions={<Link to={`${base}/timeline`} className="text-sm text-electric-blue hover:underline">Open timeline</Link>}>
        {activity === null ? <p className="text-sm text-text-secondary">Loading…</p>
          : <ColumnChart title="Dated events over time" valueLabel="events" points={activity} testId="overview-activity-chart" />}
      </Section>

      <Section icon={<GitCompare className="h-4 w-4" />} title={`Contradictions${contradictions.data ? ` (${contradictions.data.length})` : ""}`}
        description="Sources that disagree. Both values are kept; neither is treated as true until a reviewer decides.">
        {contradictions.error ? <p className="text-sm text-text-secondary">Unavailable: {contradictions.error}</p>
          : contradictions.data === null ? <p className="text-sm text-text-secondary">Loading…</p>
          : contradictions.data.length === 0 ? <p className="text-sm text-text-secondary">No contradictions recorded.</p>
          : (
            <ul className="divide-y divide-border-subtle" data-testid="contradictions">
              {contradictions.data.slice(0, 10).map((x: any) => (
                <li key={x.claim_id} className="flex flex-wrap items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0 text-sm">
                    <p className="text-text-primary">
                      <strong>{x.source?.label ?? "Record"}</strong>{x.attribute ? <> — {x.attribute}: </> : " "}
                      <span className="font-medium">“{x.original_value ?? "—"}”</span>
                    </p>
                    <p className="text-xs text-text-secondary">
                      In {x.evidence?.filename ?? "evidence"}{x.flags?.contradicts?.length ? ` · conflicts with ${x.flags.contradicts.length} other claim${x.flags.contradicts.length === 1 ? "" : "s"}` : ""}
                      {" · "}<span className="font-mono">{x.claim_id}</span>
                    </p>
                  </div>
                  {x.evidence?.evidence_id && (
                    <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => openSource(x.evidence.evidence_id, x.provenance?.[0]?.locator)}>
                      <FileText className="h-3.5 w-3.5" aria-hidden="true" /> Open source
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
      </Section>

      <Section icon={<CheckCircle2 className="h-4 w-4" />} title="Recent decisions" actions={<Link to={`${base}/decisions`} className="text-sm text-electric-blue hover:underline">All decisions</Link>}>
        {reviews.error ? <p className="text-sm text-text-secondary">Unavailable: {reviews.error}</p>
          : reviews.data === null ? <p className="text-sm text-text-secondary">Loading…</p>
          : reviews.data.length === 0 ? <p className="text-sm text-text-secondary">No review decisions recorded yet.</p>
          : (
            <ul className="divide-y divide-border-subtle">
              {reviews.data.slice(0, 5).map((r: any) => (
                <li key={r.review_id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0 truncate"><StatusBadge kind="review" code={r.decision} className="mr-2" />{r.reason}</span>
                  <span className="text-xs text-text-secondary whitespace-nowrap">{personName(r.reviewer_id)} · {formatDate(r.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
      </Section>

      {can(user?.role, "listAnchors") && (
        <Section icon={<Anchor className="h-4 w-4" />} title="Integrity anchors" description="A Merkle root over the SHA-256 references of the case's accepted evidence. An integrity reference, not a legal certificate."
          actions={can(user?.role, "createAnchor") ? (
            <Button variant="secondary" size="sm" className="gap-1.5" onClick={createAnchor} disabled={anchorBusy}>
              <Anchor className="h-3.5 w-3.5" aria-hidden="true" /> {anchorBusy ? "Recording…" : "Create anchor"}
            </Button>
          ) : undefined}>
          {anchorMsg && <p role="status" className={`mb-2 text-sm ${anchorMsg.ok ? "text-verified-emerald" : "text-critical-red"}`}>{anchorMsg.text}</p>}
          {anchors.error ? <p className="text-sm text-text-secondary">Unavailable: {anchors.error}</p>
            : !anchors.data?.length ? <p className="text-sm text-text-secondary">No anchors recorded for this case yet.</p>
            : (
              <ul className="space-y-2">
                {anchors.data.slice(0, 5).map((a: any) => (
                  <li key={a.anchor_id} className="rounded-md border border-border-subtle px-3 py-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono font-semibold text-text-primary">{a.anchor_id}</span>
                      <Badge tone="blue">{a.anchor_status}</Badge>
                    </div>
                    <p className="mt-1 font-mono text-text-secondary break-all">{a.merkle_root}</p>
                    <p className="mt-0.5 text-text-secondary">{a.leaf_count} evidence hashes · {formatDate(a.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
        </Section>
      )}
      <AssignPersonDialog caseData={c} open={assigning} onOpenChange={setAssigning} onAssigned={reloadCase} />
    </CaseTabBody>
  );
}
