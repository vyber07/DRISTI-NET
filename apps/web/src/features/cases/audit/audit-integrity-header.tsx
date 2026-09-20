import { useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Download,
  CheckCircle2,
  FileSpreadsheet,
  Network,
  Eye,
  Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuditStore } from "@/stores/auditStore";

interface AuditIntegrityHeaderProps {
  caseId: string;
}

export function AuditIntegrityHeader({ caseId }: AuditIntegrityHeaderProps) {
  const {
    logs,
    verificationResult,
    lastVerifiedAt,
    verifyChain,
  } = useAuditStore();

  const [copiedNotification, setCopiedNotification] = useState(false);

  // Compute domain breakdown statistics
  const totalEvents = logs.length;
  const evidenceOps = logs.filter(
    (l) => l.action === "VIEW_EVIDENCE" || l.action === "UPDATE_TIER",
  ).length;
  const graphOps = logs.filter(
    (l) =>
      l.action === "VIEW_GRAPH" ||
      l.action === "FILTER_GRAPH" ||
      l.action === "EXPAND_NODE" ||
      l.action === "ARBITRATE_CONTRADICTION",
  ).length;
  const identityOps = logs.filter(
    (l) =>
      l.action === "REVEAL_PII_REQUESTED" ||
      l.action === "REVEAL_PII_APPROVED" ||
      l.action === "REVEAL_PII_DENIED",
  ).length;

  const handleExportDossier = () => {
    const exportData = {
      exportTitle: "STATUTORY DIGITAL AUDIT DOSSIER",
      caseId,
      statutoryFramework: "BSA §63 / IT Act §79A Digital Evidence Trail (Demo Mapping)",
      exportedAt: new Date().toISOString(),
      cryptographicChainValid: verificationResult?.isValid ?? true,
      totalBlocks: logs.length,
      auditRecords: logs,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AUDIT_TRAIL_${caseId}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 3000);
  };

  const isChainValid = verificationResult?.isValid ?? true;

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between rounded-lg border border-border-subtle bg-surface-1 p-4 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-electric-blue/10 text-electric-blue border border-electric-blue/30">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-text-primary">
                  Case Audit &amp; Integrity Ledger
                </h2>
                <Badge tone="blue" className="text-[10px] tracking-wider uppercase font-mono">
                  BSA §63 — DEMO POLICY MAPPING
                </Badge>
              </div>
              <p className="text-xs text-text-muted">
                Statutory tamper-evident judicial event journal for Case {caseId}. All forensic accesses, note mutations, and identity requisitions are cryptographically chained.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls & Chain Status */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Integrity Status Pill */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-mono transition-colors ${
              isChainValid
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-critical-red/40 bg-critical-red/10 text-critical-red"
            }`}
          >
            {isChainValid ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            ) : (
              <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-critical-red" />
            )}
            <span className="font-semibold">
              {isChainValid
                ? `SHA-256 CHAIN: ${verificationResult?.validBlocks ?? totalEvents}/${totalEvents} VALID`
                : "CHAIN INTEGRITY ALERT"}
            </span>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => verifyChain()}
            className="gap-1.5 text-xs"
            title="Traverse cryptographic hash links across all blocks"
          >
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportDossier}
            className="gap-1.5 text-xs"
            title="Download cryptographically verifiable audit docket in JSON format"
          >
            <Download className="h-3.5 w-3.5 text-text-muted" />
            <span>{copiedNotification ? "Downloaded!" : "Export Dossier"}</span>
          </Button>
        </div>
      </div>

      {/* Domain Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border-subtle bg-surface-1 p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-micro uppercase font-semibold tracking-wider">Total Ledger Blocks</span>
            <Hash className="h-3.5 w-3.5 text-text-muted" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-text-primary">{totalEvents}</span>
            <span className="text-micro text-emerald-400 font-mono">Sealed</span>
          </div>
          <span className="text-micro text-text-muted mt-1 truncate">
            {lastVerifiedAt ? `Verified ${new Date(lastVerifiedAt).toLocaleTimeString()}` : "Chain active"}
          </span>
        </div>

        <div className="rounded-lg border border-border-subtle bg-surface-1 p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-micro uppercase font-semibold tracking-wider">Evidence Inspections</span>
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-text-primary">{evidenceOps}</span>
            <span className="text-micro text-text-muted">Forensic</span>
          </div>
          <span className="text-micro text-text-muted mt-1 truncate">CDR &amp; Banking Bounding Box</span>
        </div>

        <div className="rounded-lg border border-border-subtle bg-surface-1 p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-micro uppercase font-semibold tracking-wider">Graph Ops &amp; Contradictions</span>
            <Network className="h-3.5 w-3.5 text-electric-blue" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-text-primary">{graphOps}</span>
            <span className="text-micro text-text-muted">Analyzed</span>
          </div>
          <span className="text-micro text-text-muted mt-1 truncate">Expansions &amp; Discrepancy reviews</span>
        </div>

        <div className="rounded-lg border border-border-subtle bg-surface-1 p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-micro uppercase font-semibold tracking-wider">PII Access Requisitions</span>
            <Eye className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-text-primary">{identityOps}</span>
            <span className="text-micro text-amber-400 font-mono">Governed</span>
          </div>
          <span className="text-micro text-text-muted mt-1 truncate">Sec 91 BNSS Thresholds</span>
        </div>
      </div>
    </div>
  );
}
