import { useCallback, useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, Copy, Download, FileText, RefreshCw, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge, evidenceStatusInfo } from "@/components/ui/status-badge";
import { FactList } from "@/components/layout/page";
import { getEvidenceById, getEvidenceClaims, processEvidence, verifyEvidence } from "@/services/api/evidenceApi";
import { useProvenanceStore } from "@/stores/provenanceStore";
import { useAuthStore } from "@/stores/authStore";
import { can, deniedReason } from "@/lib/permissions";
import type { EvidenceItem } from "@/types/evidence";
import { useCase } from "../case-context";
import { formatBytes, formatDateTime, REPROCESSABLE } from "./evidence-format";

/**
 * Everything about one evidence item without leaving the list: summary, scan and processing, integrity
 * (copy SHA-256, recompute and compare via GET /evidence/{id}/verify), and the claims extracted from it, each opening
 * its exact source location. The verify, claims and reprocess endpoints existed but had no UI before.
 */
export function EvidenceDetailDrawer({ item, open, onOpenChange, onRequestDownload, onChanged }: {
  item: EvidenceItem | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onRequestDownload: (item: EvidenceItem) => void;
  onChanged: () => void;
}) {
  const { personName } = useCase();
  const role = useAuthStore((s) => s.user?.role);
  const openSource = useProvenanceStore((s) => s.openProvenanceForRecord);
  const [detail, setDetail] = useState<EvidenceItem | null>(null);
  const [claims, setClaims] = useState<any[] | null>(null);
  const [claimsError, setClaimsError] = useState<string | null>(null);
  const [verify, setVerify] = useState<{ busy?: boolean; result?: any; error?: string }>({});
  const [reproc, setReproc] = useState<{ busy?: boolean; msg?: string; ok?: boolean }>({});
  const [copied, setCopied] = useState(false);

  const load = useCallback((id: string) => {
    setDetail(null); setClaims(null); setClaimsError(null); setVerify({}); setReproc({});
    getEvidenceById(id).then((r) => setDetail(r.data)).catch(() => setDetail(null));
    getEvidenceClaims(id, 50).then((r) => setClaims(r.data)).catch((e) => setClaimsError(e?.message || "unavailable"));
  }, []);
  useEffect(() => { if (open && item) load(item.evidence_id); }, [open, item, load]);

  if (!item) return null;
  const ev = detail ?? item;
  const info = evidenceStatusInfo(ev.status);

  const runVerify = async () => {
    setVerify({ busy: true });
    try { setVerify({ result: (await verifyEvidence(ev.evidence_id)).data }); onChanged(); }
    catch (e: any) { setVerify({ error: e?.message || "Verification failed" }); }
  };
  const runReprocess = async () => {
    setReproc({ busy: true });
    try {
      const r = (await processEvidence(ev.evidence_id)).data;
      setReproc({ ok: true, msg: `Reprocessed: now ${evidenceStatusInfo(r?.status).label}.` });
      load(ev.evidence_id); onChanged();
    } catch (e: any) { setReproc({ ok: false, msg: e?.message || "Reprocessing failed" }); }
  };
  const copyHash = async () => {
    try { await navigator.clipboard.writeText(ev.sha256); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked: hash stays selectable */ }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <DialogPrimitive.Content data-testid="evidence-drawer"
          className="fixed inset-y-0 right-0 z-40 flex w-full max-w-xl flex-col border-l border-border-subtle bg-surface-1 shadow-drawer focus:outline-none">
          <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-5 py-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-lg font-semibold text-text-primary break-all">{ev.filename}</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                <StatusBadge code={ev.status} /> <span>{info.hint}</span>
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="rounded-md p-1.5 text-text-secondary hover:bg-surface-2" aria-label="Close details"><X className="h-4 w-4" /></DialogPrimitive.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" size="sm" className="gap-1.5" onClick={() => openSource(ev.evidence_id)}>
                <FileText className="h-3.5 w-3.5" aria-hidden="true" /> Open source
              </Button>
              <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => onRequestDownload(ev)} disabled={!can(role, "downloadOriginal")}
                title={can(role, "downloadOriginal") ? "Download the original, unmasked file (reason recorded)" : deniedReason(role, "download unmasked originals")}>
                <Download className="h-3.5 w-3.5" aria-hidden="true" /> Download original
              </Button>
              {can(role, "upload") && REPROCESSABLE.has(ev.status) && (
                <Button variant="secondary" size="sm" className="gap-1.5" onClick={runReprocess} disabled={reproc.busy}>
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> {reproc.busy ? "Reprocessing…" : "Reprocess"}
                </Button>
              )}
            </div>
            {reproc.msg && <p role="status" className={`text-sm ${reproc.ok ? "text-verified-emerald" : "text-critical-red"}`}>{reproc.msg}</p>}

            <section aria-labelledby="ev-summary">
              <h3 id="ev-summary" className="mb-2 text-sm font-semibold text-text-primary">Summary</h3>
              <FactList columns={2} items={[
                { label: "Type", value: ev.detected_type },
                { label: "Size", value: formatBytes(ev.size_bytes) },
                { label: "Uploaded by", value: personName(ev.uploaded_by) },
                { label: "Uploaded", value: formatDateTime(ev.created_at) },
                { label: "Source", value: ev.source_label },
                { label: "Version", value: ev.version },
                { label: "Claims extracted", value: ev.claim_count ?? (claims ? claims.length : "—") },
                { label: "Evidence ID", value: <span className="font-mono text-xs">{ev.evidence_id}</span> },
              ]} />
            </section>

            <section aria-labelledby="ev-integrity">
              <h3 id="ev-integrity" className="mb-2 text-sm font-semibold text-text-primary">Integrity</h3>
              <p className="text-xs font-medium text-text-secondary">SHA-256 recorded at upload</p>
              <div className="mt-1 flex items-start gap-2">
                <code className="flex-1 break-all rounded bg-surface-2 px-2 py-1.5 font-mono text-xs text-text-primary" data-testid="evidence-sha256">{ev.sha256}</code>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={copyHash} aria-label="Copy SHA-256">
                  {copied ? <Check className="h-4 w-4 text-verified-emerald" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button variant="secondary" size="sm" className="gap-1.5" onClick={runVerify} disabled={verify.busy}>
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> {verify.busy ? "Checking…" : "Verify integrity"}
                </Button>
                <span role="status" aria-live="polite" className="text-sm" data-testid="verify-result">
                  {verify.error && <span className="text-critical-red">{verify.error}</span>}
                  {verify.result && (verify.result.match
                    ? <span className="text-verified-emerald">The stored file still matches the recorded SHA-256.</span>
                    : <span className="text-critical-red">Mismatch: {verify.result.reason || "the stored file differs from the recorded SHA-256"}. The item is now marked “Integrity mismatch”.</span>)}
                </span>
              </div>
              <p className="mt-2 text-xs text-text-secondary">A hash match supports the integrity of the stored file. It is an integrity reference, not a chain-of-custody certificate.</p>
            </section>

            <section aria-labelledby="ev-processing">
              <h3 id="ev-processing" className="mb-2 text-sm font-semibold text-text-primary">Scan and processing</h3>
              <FactList columns={2} items={[
                { label: "Malware scan", value: ev.scan_result ? `${ev.scan_result}${ev.scan_engine ? ` (${ev.scan_engine})` : ""}` : "Not recorded" },
                { label: "Storage area", value: ev.storage_area },
              ]} />
              {ev.error && <p className="mt-2 rounded-md bg-critical-red/5 px-3 py-2 text-sm text-text-primary">Last error: {ev.error}</p>}
              {detail?.jobs?.length ? (
                <table className="mt-3 w-full text-sm">
                  <caption className="sr-only">Processing jobs</caption>
                  <thead className="text-left text-xs text-text-secondary"><tr><th className="py-1 font-medium">Stage</th><th className="py-1 font-medium">Status</th><th className="py-1 font-medium text-right">Attempts</th></tr></thead>
                  <tbody className="divide-y divide-border-subtle">
                    {detail.jobs.map((j) => (
                      <tr key={j.job_id}><td className="py-1.5">{j.kind}</td><td className="py-1.5">{j.status}{j.error ? ` — ${j.error}` : ""}</td><td className="py-1.5 text-right tabular-nums">{j.attempts}</td></tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </section>

            <section aria-labelledby="ev-claims">
              <h3 id="ev-claims" className="mb-1 text-sm font-semibold text-text-primary">Extracted claims</h3>
              <p className="mb-2 text-xs text-text-secondary">Candidate facts read from this file. Each opens at the exact place it was read.</p>
              {claimsError ? <p className="text-sm text-text-secondary">Claims unavailable: {claimsError}</p>
                : claims === null ? <p className="text-sm text-text-secondary">Loading…</p>
                : claims.length === 0 ? <p className="text-sm text-text-secondary">No claims were extracted from this file.</p>
                : (
                  <ul className="divide-y divide-border-subtle" data-testid="evidence-claims">
                    {claims.map((cl: any) => (
                      <li key={cl.claim_id} className="flex items-start justify-between gap-3 py-2">
                        <div className="min-w-0 text-sm">
                          <p className="text-text-primary">
                            {cl.source?.label ?? "—"} <span className="text-text-secondary">{(cl.rel_type || cl.attribute || "").toLowerCase().replace(/_/g, " ")}</span> {cl.target?.label ?? (cl.original_value != null ? `“${cl.original_value}”` : "")}
                          </p>
                          <p className="text-xs text-text-secondary">
                            <StatusBadge kind="review" code={cl.state} className="mr-1.5" />
                            {cl.method}{cl.confidence != null ? ` · confidence ${Math.round(cl.confidence * 100)}%` : ""}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" className="shrink-0" onClick={() => openSource(ev.evidence_id, cl.provenance?.[0]?.locator)}>Source</Button>
                      </li>
                    ))}
                  </ul>
                )}
            </section>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
