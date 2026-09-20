import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { Download, FileText, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateCaseReport } from "@/services/api/reportApi";

export function ReportsPage() {
  const { caseId } = useParams();
  const [status, setStatus] = useState<"idle" | "generating" | "success" | "error" | "unauthorized">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleGenerate = async () => {
    if (!caseId) return;
    setStatus("generating");
    setErrorMsg("");

    try {
      const response = await generateCaseReport(caseId, { include_graph: true, evidence_ids: [] });
      if (response && response.data) {
        setStatus("success");
        // In a real implementation we would download the blob/URL here.
      } else {
        setStatus("error");
        setErrorMsg("Failed to generate report.");
      }
    } catch (e: any) {
      if (e.response?.status === 401 || e.response?.status === 403) {
        setStatus("unauthorized");
      } else {
        setStatus("error");
        setErrorMsg(e.message || "An error occurred");
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface-base">
      <header className="px-6 py-5 border-b border-border-subtle bg-surface-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-text-primary tracking-tight">Case Reports & Exports</h1>
          <p className="text-sm text-text-secondary mt-1 max-w-2xl">
            Generate authoritative dossiers for case {caseId}. Generation is logged in the audit trail.
          </p>
        </div>
      </header>

      <div className="p-6 max-w-3xl mx-auto w-full mt-8">
        <div className="rounded-xl border border-border-subtle bg-surface-1 p-6 space-y-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-electric-blue/10 rounded-lg text-electric-blue shrink-0">
              <FileText className="h-6 w-6" />
            </div>
            <div className="space-y-2 flex-1">
              <h3 className="text-base font-bold text-text-primary">Comprehensive Case Report</h3>
              <p className="text-sm text-text-secondary">
                Generates a detailed summary of all case entities, relationships, and evidence. 
                Requires analyst or investigator permissions.
              </p>
              
              <div className="pt-4">
                <Button 
                  variant="primary" 
                  onClick={handleGenerate}
                  disabled={status === "generating"}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  {status === "generating" ? "Generating..." : "Generate Report"}
                </Button>
              </div>

              {status === "success" && (
                <div className="mt-4 p-3 bg-verified-emerald/10 text-verified-emerald text-sm rounded-md border border-verified-emerald/20 font-medium">
                  Report generated successfully.
                </div>
              )}
              {status === "unauthorized" && (
                <div className="mt-4 p-3 bg-red-500/10 text-red-500 text-sm rounded-md border border-red-500/20 font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Unauthorized to generate report for this case.
                </div>
              )}
              {status === "error" && (
                <div className="mt-4 p-3 bg-red-500/10 text-red-500 text-sm rounded-md border border-red-500/20 font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Error: {errorMsg}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
