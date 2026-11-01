import { useEffect, useState } from "react";
import { FileText, ExternalLink, Hash, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProvenanceStore } from "@/stores/provenanceStore";
import { getEvidenceById, getEvidenceContext } from "@/services/api/evidenceApi";
import type { HITLTask } from "@/types/hitl";

/**
 * Supporting evidence for a review candidate.
 *
 * DEF-058: this pane used to render a static, fabricated "Call Detail Record" (agency letterhead, invented call
 * rows, a made-up threat transcript, fixed tier 2 / 90 % confidence) under the real file's name and SHA-256.
 * It now shows only what the API returns: the evidence record and its masked source lines.
 */
interface ContextLine { n: number; text: string; hit: boolean }
interface EvidenceView {
  evidence_id: string;
  filename: string;
  sha256: string;
  status: string;
  detected_type: string;
  created_at: string;
  lines: ContextLine[];
  error: string | null;
}

async function loadOne(evidenceId: string): Promise<EvidenceView> {
  const ev = (await getEvidenceById(evidenceId)).data as any;
  const base: EvidenceView = {
    evidence_id: ev.evidence_id, filename: ev.filename, sha256: ev.sha256, status: ev.status,
    detected_type: ev.detected_type, created_at: ev.created_at, lines: [], error: null,
  };
  try {
    const ctx = (await getEvidenceContext(evidenceId, { line: 1, window: 10 })).data as any;
    base.lines = Array.isArray(ctx?.lines) ? ctx.lines : [];
  } catch (e: any) {
    base.error = e?.status === 409 ? `Source not shown: ${e.message}` : `Source could not be loaded: ${e?.message || "error"}`;
  }
  return base;
}

export function HITLEvidencePane({ task }: { task: HITLTask }) {
  const [items, setItems] = useState<EvidenceView[]>([]);
  const [active, setActive] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { openProvenanceForRecord } = useProvenanceStore();

  useEffect(() => {
    let alive = true;
    const ids = (task.evidenceIds?.length ? task.evidenceIds : [task.primaryEvidenceId]).filter(Boolean).slice(0, 6);
    setItems([]); setActive(0); setError(null);
    if (!ids.length) return;
    setIsLoading(true);
    Promise.all(ids.map(loadOne))
      .then((r) => { if (alive) setItems(r); })
      .catch((e: any) => { if (alive) setError(e?.message || "Failed to load supporting evidence"); })
      .finally(() => { if (alive) setIsLoading(false); });
    return () => { alive = false; };
  }, [task.id, task.primaryEvidenceId, task.evidenceIds]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-surface-2 p-6 text-center space-y-2">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-electric-blue border-t-transparent" />
        <p className="text-xs font-mono text-text-muted">Loading supporting evidence…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div role="alert" className="flex flex-col items-center justify-center h-full bg-surface-2 p-6 text-center space-y-2">
        <AlertCircle className="h-8 w-8 text-critical-red" />
        <p className="text-xs text-text-secondary">{error}</p>
      </div>
    );
  }
  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-surface-2 p-6 text-center space-y-3">
        <FileText className="h-10 w-10 text-text-muted" />
        <h4 className="text-sm font-semibold text-text-primary">No supporting evidence linked</h4>
        <p className="text-xs text-text-secondary max-w-sm">The API returned no evidence ids for candidate {task.id}.</p>
      </div>
    );
  }

  const cur = items[Math.min(active, items.length - 1)];
  return (
    <div className="flex flex-col h-full bg-surface-2 overflow-hidden">
      <div className="flex items-center gap-1 px-3 pt-2 bg-surface-1 border-b border-border-subtle shrink-0 overflow-x-auto" role="tablist">
        {items.map((it, i) => (
          <button key={it.evidence_id} type="button" role="tab" aria-selected={i === active} onClick={() => setActive(i)}
            className={`px-2.5 py-1.5 text-micro font-mono rounded-t border-b-2 whitespace-nowrap ${i === active ? "border-electric-blue text-text-primary" : "border-transparent text-text-muted hover:text-text-secondary"}`}>
            {it.filename}
          </button>
        ))}
      </div>

      <div className="flex h-11 items-center justify-between px-4 bg-surface-1 border-b border-border-subtle shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-electric-blue-soft shrink-0" />
          <span className="text-xs font-semibold text-text-primary truncate">{cur.filename}</span>
          <Badge tone="gray" className="text-micro font-mono shrink-0">{cur.detected_type}</Badge>
          <Badge tone="blue" className="text-micro font-mono shrink-0">{cur.status}</Badge>
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-micro font-mono px-2 gap-1 shrink-0"
          onClick={() => openProvenanceForRecord(cur.evidence_id)} title="Open the full source in the provenance viewer">
          <ExternalLink className="h-3 w-3" /><span>Open source</span>
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-3">
        <p className="text-micro text-text-muted mb-2">
          Opening lines of the stored source (masked by default). This is the file the candidate cites; the specific
          lines behind each signal are listed in the decision pane.
        </p>
        {cur.error ? (
          <div role="alert" className="rounded border border-critical-red/40 bg-critical-red/10 p-3 text-xs text-text-secondary">{cur.error}</div>
        ) : cur.lines.length === 0 ? (
          <p className="text-xs text-text-muted">The source returned no text lines.</p>
        ) : (
          <pre className="text-[11px] leading-5 font-mono text-text-secondary whitespace-pre-wrap break-words">
            {cur.lines.map((l) => (
              <div key={l.n} className="flex gap-3"><span className="text-text-disabled select-none w-8 text-right shrink-0">{l.n}</span><span>{l.text}</span></div>
            ))}
          </pre>
        )}
      </div>

      <div className="p-3 bg-surface-1 border-t border-border-subtle shrink-0 text-micro flex items-center justify-between gap-4 flex-wrap font-mono text-text-muted">
        <div className="flex items-center gap-1.5">
          <Hash className="h-3 w-3" /><span>SHA-256 (integrity reference):</span>
          <span className="text-text-secondary truncate max-w-[220px]" title={cur.sha256}>{cur.sha256.substring(0, 16)}…</span>
        </div>
        <span>Ingested: {new Date(cur.created_at).toLocaleDateString("en-IN")}</span>
      </div>
    </div>
  );
}
