import { useParams } from "react-router-dom";
import { useState } from "react";
import { Download, FileText, AlertTriangle, FileJson, FileCode2, Scale, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateCaseReport } from "@/services/api/reportApi";

export function ReportsPage() {
  const { caseId } = useParams();
  const [status, setStatus] = useState<"idle" | "generating" | "success" | "error" | "unauthorized">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [analystComments, setAnalystComments] = useState("");
  const [format, setFormat] = useState<"json" | "html">("html");

  const handleGenerate = async () => {
    if (!caseId) return;
    setStatus("generating");
    setErrorMsg("");
    try {
      const response = await generateCaseReport(caseId, { analyst_comments: analystComments, format });
      if (response?.data) {
        setStatus("success");
        const blob = format === "html"
          ? new Blob([response.data as unknown as string], { type: "text/html" })
          : new Blob([JSON.stringify(response.data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Report_${caseId}_${Date.now()}.${format}`;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        setStatus("error"); setErrorMsg("Empty response from server.");
      }
    } catch (e: any) {
      if (e.status === 401 || e.status === 403) setStatus("unauthorized");
      else { setStatus("error"); setErrorMsg(e.message || "An error occurred"); }
    }
  };

  // Court PDF: must use raw fetch to get the binary blob, not the JSON-parsing api() helper
  const handleGeneratePdf = async () => {
    if (!caseId) return;
    setStatus("generating");
    setErrorMsg("");
    try {
      const token = localStorage.getItem("drishti.token");
      const res = await fetch(`/api/v1/cases/${caseId}/report/court-pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ analyst_comments: analystComments }),
      });
      if (!res.ok) {
        const text = await res.text();
        let detail = text;
        try { detail = JSON.parse(text)?.detail || text; } catch {}
        if (res.status === 401 || res.status === 403) { setStatus("unauthorized"); return; }
        setStatus("error"); setErrorMsg(detail || `HTTP ${res.status}`); return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `IntegrityDossier_${caseId}_${Date.now()}.pdf`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus("success");
    } catch (e: any) {
      setStatus("error"); setErrorMsg(e.message || "PDF generation failed");
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg-base overflow-y-auto">
      <header className="shrink-0 px-6 py-4 border-b border-border-subtle bg-surface-1 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-text-primary">Case Reports &amp; Exports</h1>
          <p className="text-xs text-text-secondary mt-0.5">Case {caseId} · All exports are audit-logged.</p>
        </div>
      </header>

      <div className="p-6 max-w-3xl mx-auto w-full space-y-6">
        <div className="rounded-xl border border-border-subtle bg-surface-1 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-electric-blue/10 rounded-lg text-electric-blue shrink-0">
              <FileText className="h-6 w-6" />
            </div>
            <div className="space-y-4 flex-1">
              <div>
                <h3 className="text-base font-bold text-text-primary">Comprehensive Case Report</h3>
                <p className="text-sm text-text-secondary mt-1">Full summary of entities, relationships, and evidence. Available as HTML page or JSON data.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-primary">Format</label>
                <div className="flex items-center gap-3">
                  {(["html", "json"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFormat(f)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                        format === f ? "border-electric-blue bg-electric-blue/10 text-electric-blue" : "border-border-subtle bg-surface-2 text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      {f === "html" ? <FileCode2 className="h-4 w-4" /> : <FileJson className="h-4 w-4" />}
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-primary">Analyst Comments (optional)</label>
                <textarea
                  value={analystComments}
                  onChange={(e) => setAnalystComments(e.target.value)}
                  className="w-full bg-surface-2 border border-border-subtle rounded-md p-3 text-sm text-text-primary focus:outline-none focus:border-electric-blue resize-none"
                  rows={3}
                  placeholder="Include final notes or contextual summaries..."
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button variant="primary" onClick={handleGenerate} disabled={status === "generating"} className="gap-2">
                  <Download className="h-4 w-4" />
                  {status === "generating" ? "Generating…" : `Download ${format.toUpperCase()}`}
                </Button>
                <Button variant="secondary" onClick={handleGeneratePdf} disabled={status === "generating"} className="gap-2 text-amber-400 border-amber-400/30 hover:bg-amber-400/10" title="Generate electronic evidence dossier with cryptographic references and BSA s.63(4)(c) structure (Not a legal certificate)">
                  <Scale className="h-4 w-4" />
                  Integrity Dossier PDF
                </Button>
              </div>

              {status === "success" && (
                <div className="p-3 bg-emerald-400/10 text-emerald-400 text-sm rounded-md border border-emerald-400/20 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Download started successfully.
                </div>
              )}
              {status === "unauthorized" && (
                <div className="p-3 bg-red-500/10 text-red-400 text-sm rounded-md border border-red-500/20 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Not authorized to export reports for this case.
                </div>
              )}
              {status === "error" && (
                <div className="p-3 bg-red-500/10 text-red-400 text-sm rounded-md border border-red-500/20 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> {errorMsg}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
