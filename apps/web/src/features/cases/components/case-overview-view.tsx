import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Anchor, ArrowRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, evidenceStatusInfo } from "@/components/ui/status-badge";
import { CaseTabBody, FactList, Section } from "@/components/layout/page";
import { getCaseContradictions, getCaseReviews, getCaseStats } from "@/services/api/casesApi";
import { listEvidence } from "@/services/api/evidenceApi";
import { createIntegrityAnchor, listIntegrityAnchors } from "@/services/api/integrityApi";
import { useProvenanceStore } from "@/stores/provenanceStore";
import { useAuthStore } from "@/stores/authStore";
import { can, roleLabel } from "@/lib/permissions";
import { useCase } from "../case-context";
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
  const { caseId, caseData: c, personName } = useCase();
  const { user } = useAuthStore();
  const openSource = useProvenanceStore((s) => s.openProvenanceForRecord);
  const [evidence, setEvidence] = useState<Part<any[]>>(empty);
  const [stats, setStats] = useState<Part<any>>(empty);
  const [contradictions, setContradictions] = useState<Part<any[]>>(empty);
  const [reviews, setReviews] = useState<Part<any[]>>(empty);
  const [anchors, setAnchors] = useState<Part<any[]>>(empty);
  const [anchorMsg, setAnchorMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [anchorBusy, setAnchorBusy] = useState(false);

  const loadAnchors = useCallback(() => {
    if (can(user?.role, "listAnchors")) wrap(listIntegrityAnchors(caseId) as any, setAnchors);
  }, [caseId, user?.role]);

  useEffect(() => {
    wrap(listEvidence(caseId), setEvidence);
    // Statistics are limited to roles that may decide (GET /stats); others use the case's pending count — no 403.
    if (can(user?.role, "decide")) wrap(getCaseStats(caseId), setStats);
    wrap(getCaseContradictions(caseId), setContradictions);
    wrap(getCaseReviews(caseId), setReviews);
    loadAnchors();
  }, [caseId, user?.role, loadAnchors]);

  const byStatus = (evidence.data ?? []).reduce<Record<string, number>>((m, e) => ({ ...m, [e.status]: (m[e.status] || 0) + 1 }), {});
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

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Case details" className="lg:col-span-2">
          <FactList columns={2} items={[
            { label: "Authority reference", value: <span className="font-mono">{c.authority_reference || "—"}</span> },
            { label: "Jurisdiction", value: c.jurisdiction },
            { label: "Classification", value: c.classification.replace(/_/g, " ") },
            { label: "Opened", value: formatDate(c.opened_at) },
            { label: "Owner", value: personName(c.owner_id) },
            { label: "Case number", value: <span className="font-mono">{c.id}</span> },
          ]} />
        </Section>
        <Section title={`People on this case (${c.people.length || c.assigned.length})`}>
          {c.people.length ? (
            <ul className="space-y-2">
              {c.people.map((p) => (
                <li key={p.user_id} className="text-sm">
                  <span className="text-text-primary">{p.display_name}</span>
                  <span className="block text-xs text-text-secondary">{roleLabel(p.role)}{p.is_owner ? " · owner" : ""}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-text-secondary">{c.assigned.length} assigned (names unavailable from this server).</p>}
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Evidence" actions={<Link to={`${base}/evidence`} className="text-sm text-electric-blue hover:underline">Open evidence</Link>}>
          {evidence.error ? <p className="text-sm text-text-secondary">Evidence list unavailable: {evidence.error}</p>
            : evidence.data === null ? <p className="text-sm text-text-secondary">Loading…</p>
            : evidence.data.length === 0 ? <p className="text-sm text-text-secondary">No evidence uploaded yet.</p>
            : (
              <ul className="space-y-2" aria-label="Evidence by status">
                {Object.entries(byStatus).sort((a, b) => b[1] - a[1]).map(([status, n]) => (
                  <li key={status} className="flex items-center justify-between gap-2">
                    <StatusBadge code={status} />
                    <span className="text-sm tabular-nums text-text-primary">{n} <span className="sr-only">items, {evidenceStatusInfo(status).hint}</span></span>
                  </li>
                ))}
              </ul>
            )}
        </Section>
        <Section title="Review" actions={<Link to={`${base}/review`} className="text-sm text-electric-blue hover:underline">Open queue</Link>}>
          <FactList columns={2} items={[
            { label: "Awaiting a decision", value: <span className="tabular-nums">{stats.data?.pendingCount ?? c.pending_reviews}</span> },
            { label: "Decided (approved or rejected)", value: <span className="tabular-nums">{stats.data ? stats.data.resolvedCount : "—"}</span> },
            { label: "All candidates", value: <span className="tabular-nums">{stats.data ? stats.data.totalTasks : "—"}</span> },
            { label: "Decisions recorded", value: <span className="tabular-nums">{reviews.data ? reviews.data.length : "—"}</span> },
          ]} />
          {!stats.data && !can(user?.role, "decide") && <p className="mt-2 text-xs text-text-secondary">Detailed counts are available to reviewers and investigators.</p>}
        </Section>
      </div>

      <Section title={`Contradictions${contradictions.data ? ` (${contradictions.data.length})` : ""}`}
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

      <Section title="Recent decisions" actions={<Link to={`${base}/decisions`} className="text-sm text-electric-blue hover:underline">All decisions</Link>}>
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
        <Section title="Integrity anchors" description="A Merkle root over the SHA-256 references of the case's accepted evidence. An integrity reference, not a legal certificate."
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
    </CaseTabBody>
  );
}
