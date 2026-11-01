import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { CaseDetail } from "@/types/case";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Network, FileCheck2, ShieldCheck, AlertTriangle, Clock,
  CheckCircle2, GitMerge, MapPin, BarChart2, Anchor, RefreshCw, ChevronRight,
} from "lucide-react";
import { getCaseStats, getCaseContradictions, getCaseReviews } from "@/services/api/casesApi";
import { createIntegrityAnchor, listIntegrityAnchors } from "@/services/api/integrityApi";

interface Props { caseData: CaseDetail; }

export function CaseOverviewView({ caseData }: Props) {
  const caseId = caseData.id;
  const [stats, setStats] = useState<any>(null);
  const [contradictions, setContradictions] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [anchors, setAnchors] = useState<any[]>([]);
  const [anchorLoading, setAnchorLoading] = useState(false);
  const [anchorMsg, setAnchorMsg] = useState("");

  useEffect(() => {
    if (!caseId) return;
    getCaseStats(caseId).then((r) => setStats(r.data)).catch(() => {});
    getCaseContradictions(caseId).then((r) => setContradictions(r.data || [])).catch(() => {});
    getCaseReviews(caseId).then((r) => setReviews(r.data || [])).catch(() => {});
    listIntegrityAnchors(caseId).then((r) => setAnchors(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, [caseId]);

  const handleCreateAnchor = async () => {
    setAnchorLoading(true);
    setAnchorMsg("");
    try {
      await createIntegrityAnchor(caseId);
      const r = await listIntegrityAnchors(caseId);
      setAnchors(Array.isArray(r.data) ? r.data : []);
      setAnchorMsg("Integrity anchor created.");
    } catch (e: any) {
      setAnchorMsg(e.message || "Failed to create anchor.");
    } finally {
      setAnchorLoading(false);
    }
  };

  if (!caseData) return <div className="p-8 text-center text-text-secondary">No case data available.</div>;

  const statCards = [
    { label: "Total Candidates", value: stats?.totalTasks ?? "—", icon: GitMerge, color: "text-electric-blue" },
    { label: "Pending Review", value: stats?.pendingCount ?? caseData.pending_reviews, icon: Clock, color: "text-amber-400" },
    { label: "Resolved", value: stats?.resolvedCount ?? "—", icon: CheckCircle2, color: "text-emerald-400" },
    { label: "Contradictions", value: stats?.contradictionsCount ?? contradictions.length, icon: AlertTriangle, color: "text-red-400" },
  ];

  return (
    <div className="space-y-5 p-1">

      {/* Core Meta */}
      <section className="rounded-xl border border-border-subtle bg-surface-1 p-5 shadow-xs">
        <h3 className="text-sm font-bold text-text-primary border-b border-border-subtle pb-2 mb-4">Case Properties</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Classification", value: <Badge tone="neutral" className="text-xs uppercase">{caseData.classification.replace(/_/g, " ")}</Badge> },
            { label: "Jurisdiction", value: caseData.jurisdiction },
            { label: "Authority Ref", value: caseData.authority_reference },
            { label: "Assigned Users", value: `${caseData.assigned.length} users` },
            { label: "Evidence Items", value: caseData.evidence_count },
            { label: "Owner", value: <span className="font-mono text-xs">{caseData.owner_id}</span> },
            { label: "Opened", value: new Date(caseData.opened_at).toLocaleDateString("en-IN") },
            { label: "Purpose", value: <span className="text-xs leading-relaxed">{caseData.purpose}</span> },
          ].map(({ label, value }) => (
            <div key={label} className="space-y-1">
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-text-muted">{label}</span>
              <div className="text-sm font-medium text-text-primary">{value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Stats from /cases/{id}/stats */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-border-subtle bg-surface-1 p-4 shadow-xs">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`h-4 w-4 ${color}`} />
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-text-muted">{label}</span>
            </div>
            <p className="text-2xl font-bold font-mono text-text-primary">{value}</p>
          </div>
        ))}
      </section>

      {/* Investigation Modules */}
      <section className="rounded-xl border border-electric-blue/30 bg-electric-blue/5 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-text-primary">Investigation Modules</h4>
          <p className="text-xs text-text-secondary">Access evidence, graph intelligence, map, analysis, and review workflows.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link to={`/cases/${caseId}/evidence`}>
            <Button variant="secondary" size="sm" className="text-xs gap-1.5 h-8">
              <FileCheck2 className="h-3.5 w-3.5" /> Evidence
            </Button>
          </Link>
          <Link to={`/cases/${caseId}/graph`}>
            <Button variant="secondary" size="sm" className="text-xs gap-1.5 h-8">
              <Network className="h-3.5 w-3.5" /> Graph
            </Button>
          </Link>
          <Link to={`/cases/${caseId}/map`}>
            <Button variant="secondary" size="sm" className="text-xs gap-1.5 h-8">
              <MapPin className="h-3.5 w-3.5" /> Map
            </Button>
          </Link>
          <Link to={`/cases/${caseId}/analysis`}>
            <Button variant="primary" size="sm" className="text-xs gap-1.5 h-8">
              <BarChart2 className="h-3.5 w-3.5" /> Analysis
            </Button>
          </Link>
        </div>
      </section>

      {/* Contradictions */}
      {contradictions.length > 0 && (
        <section className="rounded-xl border border-red-400/30 bg-red-400/5 p-5 shadow-xs">
          <h3 className="text-sm font-bold text-red-400 flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4" /> Contradictions ({contradictions.length})
          </h3>
          <div className="space-y-2">
            {contradictions.slice(0, 5).map((c: any) => (
              <div key={c.claim_id} className="rounded-md bg-surface-1 border border-border-subtle px-3 py-2 flex items-center justify-between gap-2">
                <div className="text-xs text-text-secondary">
                  <span className="font-mono font-semibold text-text-primary">{c.claim_id}</span>
                  {" · "}{c.rel_type} · {c.attribute || "—"}
                </div>
                <Badge tone="red" className="text-micro">CONTRADICTORY</Badge>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent Reviews */}
      {reviews.length > 0 && (
        <section className="rounded-xl border border-border-subtle bg-surface-1 p-5 shadow-xs">
          <h3 className="text-sm font-bold text-text-primary flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Recent Reviews ({reviews.length})
          </h3>
          <div className="space-y-1.5">
            {reviews.slice(0, 5).map((r: any) => (
              <div key={r.review_id} className="rounded-md bg-surface-2 border border-border-subtle px-3 py-2 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-text-muted shrink-0">{r.target_kind}</span>
                  <ChevronRight className="h-3 w-3 text-text-muted shrink-0" />
                  <span className="font-mono text-text-primary truncate">{r.target_id}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge tone={r.decision === "APPROVE" ? "emerald" : r.decision === "REJECT" ? "red" : "neutral"} className="text-micro">
                    {r.decision}
                  </Badge>
                  <span className="text-text-muted text-[10px]">{r.created_at?.substring(0, 10)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Integrity Anchors */}
      <section className="rounded-xl border border-border-subtle bg-surface-1 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
            <Anchor className="h-4 w-4 text-electric-blue" /> Integrity Anchors ({anchors.length})
          </h3>
          <Button variant="secondary" size="sm" className="text-xs gap-1.5 h-7" onClick={handleCreateAnchor} disabled={anchorLoading}>
            {anchorLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Anchor className="h-3.5 w-3.5" />}
            Create Anchor
          </Button>
        </div>
        {anchorMsg && <p className="text-xs text-emerald-400 mb-2">{anchorMsg}</p>}
        {anchors.length === 0 ? (
          <p className="text-xs text-text-muted">No integrity anchors yet. Create one to record a Merkle root of all accepted evidence.</p>
        ) : (
          <div className="space-y-2">
            {anchors.slice(0, 3).map((a: any) => (
              <div key={a.anchor_id} className="rounded-md bg-surface-2 border border-border-subtle px-3 py-2 text-xs space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-semibold text-text-primary">{a.anchor_id}</span>
                  <Badge tone="blue" className="text-micro">{a.anchor_status}</Badge>
                </div>
                <div className="text-text-muted font-mono break-all">{a.merkle_root?.substring(0, 40)}…</div>
                <div className="flex items-center gap-3 text-[10px] text-text-muted">
                  <span>{a.leaf_count} leaves</span>
                  <span>{a.created_at?.substring(0, 10)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Security Footer */}
      <div className="flex items-center justify-between py-2 text-xs text-text-muted border-t border-border-subtle">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-verified-emerald" />
          <span>All sensitive attributes masked per PII protocols.</span>
        </div>
        <span className="font-mono text-[11px]">BNSS Compliant · SHA-256 Manifest</span>
      </div>
    </div>
  );
}
