import {
  ShieldCheck,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuditStore } from "@/stores/auditStore";

interface AuditIntegrityHeaderProps {
  caseId: string;
}

export function AuditIntegrityHeader({ caseId }: AuditIntegrityHeaderProps) {
  const { logs } = useAuditStore();
  const totalEvents = logs.length;

  const handleExportDossier = () => {
    // Generate a quick CSV of the logs
    const csvHeader = "Timestamp,Action,Actor,Target Kind,Target ID,Outcome\n";
    const csvContent = logs.map(l => 
      `${l.created_at},${l.action},${l.actor_id || ""},${l.target_kind || ""},${l.target_id || ""},${l.outcome}`
    ).join("\n");
    
    const blob = new Blob([csvHeader + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `audit_log_${caseId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 bg-surface-1 border border-border-subtle p-4 rounded-lg shadow-sm">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-text-primary tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            Case Audit Ledger
          </h2>
          <Badge tone="emerald" className="text-micro font-mono">
            LIVE
          </Badge>
        </div>
        <p className="text-xs text-text-secondary max-w-xl leading-relaxed">
          Permanent chronological log of all interactions and data state changes within Case {caseId}.
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
        <div className="bg-surface-2 border border-border-subtle rounded-md px-3 py-1.5 flex flex-col justify-center items-end mr-2">
          <span className="text-micro font-mono text-text-muted uppercase tracking-wider">
            Total Records
          </span>
          <span className="text-sm font-semibold font-mono text-text-primary">
            {totalEvents}
          </span>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={handleExportDossier}
          className="gap-2 text-xs font-mono h-9"
          disabled={totalEvents === 0}
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span>Export CSV</span>
        </Button>
      </div>
    </div>
  );
}
