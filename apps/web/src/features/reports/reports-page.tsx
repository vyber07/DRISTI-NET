import { useId, useState } from "react";
import { Download, FileText, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CaseTabBody, Section } from "@/components/layout/page";
import { generateCaseReport, generateCourtPdf } from "@/services/api/reportApi";
import { useAuthStore } from "@/stores/authStore";
import { can, deniedReason } from "@/lib/permissions";
import { useCase } from "@/features/cases/case-context";

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Status = { kind: "idle" } | { kind: "busy"; what: string } | { kind: "ok"; text: string } | { kind: "error"; text: string };

/**
 * Reports tab: the analyst-reviewed case report (HTML or JSON) and the integrity-reference PDF.
 * Both are generated server-side from current data and audit-logged. Neither is a legal certificate.
 */
export function ReportsPage() {
  const { caseId } = useCase();
  const role = useAuthStore((s) => s.user?.role);
  const allowed = can(role, "report");
  const commentsId = useId();
  const [comments, setComments] = useState("");
  const [format, setFormat] = useState<"html" | "json">("html");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const busy = status.kind === "busy";
  const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

  const fail = (e: any) => setStatus({ kind: "error", text: e?.status === 403 ? deniedReason(role, "generate reports") : (e?.message || "Generation failed") });

  const report = async () => {
    setStatus({ kind: "busy", what: "report" });
    try {
      const r = await generateCaseReport(caseId, { analyst_comments: comments, format });
      const blob = format === "html" ? new Blob([r.data as string], { type: "text/html" }) : new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" });
      saveBlob(blob, `Report_${caseId}_${stamp()}.${format}`);
      setStatus({ kind: "ok", text: `Case report (${format.toUpperCase()}) downloaded. The export was recorded in the audit log.` });
    } catch (e) { fail(e); }
  };
  const pdf = async () => {
    setStatus({ kind: "busy", what: "pdf" });
    try {
      const r = await generateCourtPdf(caseId, { analyst_comments: comments });
      saveBlob(r.data as Blob, `IntegrityReference_${caseId}_${stamp()}.pdf`);
      setStatus({ kind: "ok", text: "Integrity-reference PDF downloaded. The export was recorded in the audit log." });
    } catch (e) { fail(e); }
  };

  return (
    <CaseTabBody title="Reports" description="Exports generated from the case's current data. Every export is recorded in the audit log.">
      {!allowed && <p className="rounded-lg border border-border-strong bg-surface-2 px-4 py-3 text-sm text-text-primary">{deniedReason(role, "generate reports")} Investigators, reviewers and analysts can.</p>}

      <Section title="Analyst comments (optional)" description="Included in both exports. Do not paste personal data that is not already in the case.">
        <label htmlFor={commentsId} className="sr-only">Analyst comments</label>
        <textarea id={commentsId} rows={3} value={comments} onChange={(e) => setComments(e.target.value)} disabled={!allowed}
          placeholder="Context for the reader of this report"
          className="w-full rounded-md border border-border-strong bg-surface-1 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-electric-blue-soft disabled:bg-surface-2" />
      </Section>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Case report">
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">
              Entities, candidate relationships with their source references, review decisions and evidence integrity references. HTML to read or print; JSON for other tools.
            </p>
            <fieldset>
              <legend className="text-xs font-medium text-text-secondary">Format</legend>
              <div className="mt-1 flex gap-4">
                {(["html", "json"] as const).map((f) => (
                  <label key={f} className="inline-flex items-center gap-2 text-sm">
                    <input type="radio" name="report-format" value={f} checked={format === f} onChange={() => setFormat(f)} disabled={!allowed} className="h-4 w-4 accent-[var(--electric-blue)]" />
                    {f.toUpperCase()}
                  </label>
                ))}
              </div>
            </fieldset>
            <Button variant="primary" className="gap-1.5" onClick={report} disabled={!allowed || busy}>
              <Download className="h-4 w-4" aria-hidden="true" />
              {busy && status.what === "report" ? "Generating…" : `Download ${format.toUpperCase()}`}
            </Button>
          </div>
        </Section>
        <Section title="Integrity-reference PDF">
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">
              Each evidence file with its SHA-256 integrity reference, a hash of the current graph, the review decisions, and blank fields
              (signature, device, custody) that an authorised officer must complete. It is <strong>not</strong> a legal certificate and does not establish admissibility.
            </p>
            <Button variant="secondary" className="gap-1.5" onClick={pdf} disabled={!allowed || busy}>
              <Scale className="h-4 w-4" aria-hidden="true" /> {busy && status.what === "pdf" ? "Generating…" : "Download PDF"}
            </Button>
          </div>
        </Section>
      </div>

      <div aria-live="polite">
        {status.kind === "ok" && <p role="status" className="flex items-center gap-2 text-sm text-verified-emerald"><FileText className="h-4 w-4" aria-hidden="true" />{status.text}</p>}
        {status.kind === "error" && <p role="alert" className="text-sm text-critical-red">{status.text}</p>}
      </div>
    </CaseTabBody>
  );
}
