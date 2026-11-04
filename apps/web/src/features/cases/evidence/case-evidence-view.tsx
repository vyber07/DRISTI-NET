import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, FileText, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge, evidenceStatusInfo } from "@/components/ui/status-badge";
import { ReasonDialog } from "@/components/ui/reason-dialog";
import { CaseTabBody, EmptyState, ErrorState, LoadingState, Pager, Section } from "@/components/layout/page";
import { useDebounced } from "@/lib/use-debounced";
import { downloadEvidence, getEvidenceById, getEvidenceSummary, searchEvidence, uploadEvidence } from "@/services/api/evidenceApi";
import { useProvenanceStore } from "@/stores/provenanceStore";
import { useAuthStore } from "@/stores/authStore";
import { can, deniedReason } from "@/lib/permissions";
import type { EvidenceItem } from "@/types/evidence";
import { useCase } from "../case-context";
import { EvidenceDetailDrawer } from "./evidence-detail-drawer";
import { formatBytes, formatDateTime, NOT_PROCESSED } from "./evidence-format";

const ACCEPT = ".csv,.json,.pdf,.txt,.zip"; // config.ALLOWED_EXTENSIONS
const PAGE_SIZE = 25;

/**
 * Evidence tab: upload (for roles that may), find an item by name, hash or status, and open its details.
 * Replaces a two-per-row card grid (most of the list was below the fold) with a table; the card/table toggle,
 * the browser's raw file input and window.prompt() for the download reason are gone.
 */
export function CaseEvidenceView() {
  const { caseId, personName, reload: reloadCase } = useCase();
  const role = useAuthStore((s) => s.user?.role);
  const openSource = useProvenanceStore((s) => s.openProvenanceForRecord);
  const [items, setItems] = useState<EvidenceItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<{ total: number; by_status: Record<string, number> } | null>(null);
  const [error, setError] = useState<{ message: string; trace?: string } | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<EvidenceItem | null>(null);
  const [downloadFor, setDownloadFor] = useState<EvidenceItem | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const searchId = useId(); const statusId = useId();
  const q = useDebounced(query.trim(), 300);

  // ?evidence=<id> (from the audit log and other links) opens that item's details directly (FE-030).
  const [params] = useSearchParams();
  const deepLink = params.get("evidence");
  useEffect(() => {
    if (deepLink) getEvidenceById(deepLink).then((r) => r.data && setSelected(r.data)).catch(() => setNotice({ ok: false, text: `Evidence ${deepLink} could not be opened.` }));
  }, [deepLink]);

  useEffect(() => { setOffset(0); }, [q, status]);
  // Search, status filter and paging run on the server (GET /cases/{id}/evidence?q=&status=&limit=&offset=).
  const load = useCallback(() => {
    setError(null);
    searchEvidence(caseId, { q, status: status === "ALL" ? undefined : status, limit: PAGE_SIZE, offset })
      .then((r) => { setItems(r.items); setTotal(r.total); })
      .catch((e) => setError({ message: e?.message || "Request failed", trace: e?.trace }));
    getEvidenceSummary(caseId).then(setSummary).catch(() => setSummary(null)); // counts only; the list above reports errors
  }, [caseId, q, status, offset]);
  useEffect(load, [load]);

  const statuses = Object.keys(summary?.by_status ?? {}).sort();
  const caseHasNone = summary?.total === 0;

  const doDownload = async (reason: string): Promise<string | null> => {
    if (!downloadFor) return null;
    try {
      await downloadEvidence(downloadFor.evidence_id, downloadFor.filename, reason);
      setNotice({ ok: true, text: `Download of ${downloadFor.filename} started; the reason was recorded in the audit log.` });
      return null;
    } catch (e: any) {
      return e?.status === 409 ? "Blocked: this item has not passed the malware-scan gate."
        : e?.status === 403 ? deniedReason(role, "download unmasked originals")
        : `Download failed: ${e?.message || "unknown error"}`;
    }
  };

  return (
    <CaseTabBody wide title="Evidence" description="Original files for this case. Each keeps its SHA-256 integrity reference from upload; extracted facts stay candidates until reviewed.">
      {can(role, "upload") && <UploadPanel caseId={caseId} onUploaded={() => { load(); reloadCase(); }} />}
      {notice && <p role="status" className={`text-sm ${notice.ok ? "text-verified-emerald" : "text-critical-red"}`}>{notice.text}</p>}

      {caseHasNone ? (
        <EmptyState title="No evidence yet">{can(role, "upload") ? "Upload a file above to start." : "An evidence officer or investigator uploads files for this case."}</EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[14rem]">
              <label htmlFor={searchId} className="text-xs font-medium text-text-secondary">Search</label>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
                <input id={searchId} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="File name, evidence ID or start of SHA-256"
                  className="w-full rounded-md border border-border-strong bg-surface-1 py-2 pl-8 pr-3 text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-electric-blue-soft" />
              </div>
            </div>
            <div>
              <label htmlFor={statusId} className="text-xs font-medium text-text-secondary">Status</label>
              <select id={statusId} value={status} onChange={(e) => setStatus(e.target.value)}
                className="mt-1 block rounded-md border border-border-strong bg-surface-1 py-2 pl-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-electric-blue-soft">
                <option value="ALL">All statuses{summary ? ` (${summary.total})` : ""}</option>
                {statuses.map((st) => <option key={st} value={st}>{evidenceStatusInfo(st).label} ({summary?.by_status[st]})</option>)}
              </select>
            </div>
          </div>
          {error ? <ErrorState message={error.message} trace={error.trace} onRetry={load} /> : items === null ? <LoadingState label="Loading evidence…" /> : (
            <>
              <p className="text-xs text-text-secondary" role="status" aria-live="polite">
                {q || status !== "ALL" ? `${total} item${total === 1 ? "" : "s"} match` : `${total} item${total === 1 ? "" : "s"}`}
              </p>
              {items.length === 0 ? <EmptyState title="Nothing matches">Clear the search or choose another status.</EmptyState> : (
                <div className="overflow-x-auto rounded-lg border border-border-subtle bg-surface-1">
                  <table className="w-full text-sm" data-testid="evidence-table">
                    <caption className="sr-only">Evidence for this case</caption>
                    <thead className="bg-surface-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                      <tr>
                        <th scope="col" className="px-3 py-2">File</th>
                        <th scope="col" className="px-3 py-2">Status</th>
                        <th scope="col" className="px-3 py-2 hidden md:table-cell">Uploaded</th>
                        <th scope="col" className="px-3 py-2 hidden lg:table-cell">SHA-256</th>
                        <th scope="col" className="px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {items.map((i) => (
                        <tr key={i.evidence_id} className="hover:bg-surface-2/60" data-evidence-id={i.evidence_id}>
                          <td className="px-3 py-2.5 min-w-[12rem]">
                            <button type="button" onClick={() => setSelected(i)} className="text-left font-medium text-electric-blue hover:underline break-all">{i.filename}</button>
                            <p className="text-xs text-text-secondary">{i.detected_type} · {formatBytes(i.size_bytes)}</p>
                          </td>
                          <td className="px-3 py-2.5"><StatusBadge code={i.status} /></td>
                          <td className="px-3 py-2.5 hidden md:table-cell text-text-secondary whitespace-nowrap">
                            {formatDateTime(i.created_at)}<span className="block text-xs">{personName(i.uploaded_by)}</span>
                          </td>
                          <td className="px-3 py-2.5 hidden lg:table-cell"><span className="font-mono text-xs text-text-secondary" title={i.sha256}>{i.sha256.slice(0, 16)}…</span></td>
                          <td className="px-3 py-2.5">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openSource(i.evidence_id)} className="gap-1" aria-label={`Open source of ${i.filename}`}>
                                <FileText className="h-3.5 w-3.5" aria-hidden="true" /><span className="hidden xl:inline">Source</span>
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setSelected(i)} aria-label={`Details of ${i.filename}`}>Details</Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDownloadFor(i)} disabled={!can(role, "downloadOriginal")}
                                aria-label="Download original evidence file"
                                title={can(role, "downloadOriginal") ? `Download the original ${i.filename} (reason recorded)` : deniedReason(role, "download unmasked originals")}>
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <Pager offset={offset} limit={PAGE_SIZE} total={total} onChange={setOffset} label="items" />
            </>
          )}
        </>
      )}

      <EvidenceDetailDrawer item={selected} open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}
        onRequestDownload={(it) => setDownloadFor(it)} onChanged={load} />
      <ReasonDialog open={!!downloadFor} onOpenChange={(o) => { if (!o) setDownloadFor(null); }}
        title="Download original file"
        description={<>The original of <strong className="break-all">{downloadFor?.filename}</strong> is <strong>not masked</strong>. Your reason, name and time are written to the case audit log.</>}
        confirmLabel="Download" onConfirm={doDownload} placeholder="e.g. needed for the forensic copy requested in the case diary" />
    </CaseTabBody>
  );
}

function UploadPanel({ caseId, onUploaded }: { caseId: string; onUploaded: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const fileId = useId(); const labelId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("manual upload");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async () => {
    if (!file) return;
    setBusy(true); setResult(null);
    try {
      const body = (await uploadEvidence(caseId, file, label.trim() || "manual upload")).data;
      const st: string = body?.status || "UNKNOWN";
      // DEF-076: report the server's actual outcome — a 201 can still mean "stored but held by the scan gate".
      setResult(NOT_PROCESSED.has(st)
        ? { ok: false, text: `Stored but not processed: ${evidenceStatusInfo(st).label}${body?.scan_result ? ` (scan: ${body.scan_result})` : ""}.` }
        : { ok: true, text: `Uploaded ${file.name}: ${evidenceStatusInfo(st).label}.` });
      setFile(null); if (fileRef.current) fileRef.current.value = "";
      onUploaded();
    } catch (e: any) {
      setResult({ ok: false, text: `Upload rejected${e?.status ? ` (${e.status})` : ""}: ${e?.message || "request failed"}` });
    } finally { setBusy(false); }
  };

  return (
    <Section title="Upload evidence" description="Accepted: CSV, JSON, PDF, TXT, ZIP. Files are hashed, held in quarantine and scanned for malware before anything is extracted.">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <span className="text-xs font-medium text-text-secondary" id={`${fileId}-l`}>File</span>
          <div className="mt-1 flex items-center gap-2">
            <input ref={fileRef} id={fileId} type="file" accept={ACCEPT} className="sr-only" aria-labelledby={`${fileId}-l`}
              onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); }} />
            <Button type="button" variant="secondary" size="md" onClick={() => fileRef.current?.click()}>Choose file…</Button>
            <span className="text-sm text-text-primary max-w-[16rem] truncate" aria-live="polite">{file ? `${file.name} (${formatBytes(file.size)})` : <span className="text-text-secondary">No file chosen</span>}</span>
          </div>
        </div>
        <div className="min-w-[12rem]">
          <label htmlFor={labelId} className="text-xs font-medium text-text-secondary">Source description</label>
          <input id={labelId} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120}
            className="mt-1 block w-full rounded-md border border-border-strong bg-surface-1 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-electric-blue-soft" />
        </div>
        <Button variant="primary" onClick={submit} disabled={!file || busy} className="gap-1.5">
          <Upload className="h-4 w-4" aria-hidden="true" /> {busy ? "Uploading and scanning…" : "Upload"}
        </Button>
      </div>
      {result && <p role="status" className={`mt-3 text-sm ${result.ok ? "text-verified-emerald" : "text-critical-red"}`}>{result.text}</p>}
    </Section>
  );
}
