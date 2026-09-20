import { useState } from "react";
import {
  ScrollText,
  Download,
  Copy,
  Check,
  Hash,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EvidenceTierBadge } from "@/components/intelligence/evidence-tier-badge";
import { MOCK_CASE_DETAIL } from "@/mock/cases";
import { MOCK_PROVENANCE_RECORDS } from "@/mock/caseGraphData";
import { useAuthStore } from "@/stores/authStore";

export function ReportsPage() {
  const { fullName, badgeNumber, roleLabel } = useAuthStore();
  const [copiedHash, setCopiedHash] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);

  const manifestData = Object.values(MOCK_PROVENANCE_RECORDS).map((rec) => ({
    recordId: rec.recordId,
    documentId: rec.documentId,
    title: rec.documentTitle,
    sha256: rec.sha256Hash,
    tier: rec.evidenceTier,
    agency: rec.sourceAgency,
    timestamp: rec.ingestedAt,
  }));

  const handleCopyManifest = () => {
    const text = JSON.stringify(manifestData, null, 2);
    navigator.clipboard?.writeText(text);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleExportDossier = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      setExportComplete(true);
    }, 1200);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-background overflow-hidden">
      {/* Top Header */}
      <header className="flex h-14 items-center justify-between border-b border-border-subtle bg-surface-1 px-5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-court-purple/10 border border-court-purple/30 text-court-purple">
            <ScrollText className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-text-primary">
                Case Report &amp; Court Evidence Dossier
              </h1>
              <Badge tone="purple" className="text-micro font-medium">
                Demo Evidence Dossier
              </Badge>
              <Badge tone="emerald" className="text-micro font-medium">
                Integrity Verified (Demo)
              </Badge>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Case DR-2026-00421 &bull; Complete evidence manifest with tamper-evident cryptographic verification
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopyManifest}
            className="text-xs gap-1.5"
          >
            {copiedHash ? <Check className="h-3.5 w-3.5 text-verified-emerald" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copiedHash ? "Manifest Copied" : "Copy Evidence Manifest"}</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            disabled={isExporting}
            onClick={handleExportDossier}
            className="text-xs font-semibold gap-1.5 shadow-sm"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{isExporting ? "Compiling Court Package..." : "Export Official Dossier (PDF)"}</span>
          </Button>
        </div>
      </header>

      {/* Main Dossier Workspace */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6 max-w-5xl mx-auto w-full space-y-6">
        {exportComplete && (
          <div className="rounded-md border border-verified-emerald/50 bg-verified-emerald/10 p-4 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-verified-emerald">
              <Check className="h-4 w-4 shrink-0" />
              <span className="font-semibold">
                Official Evidentiary Dossier Package (DR-2026-00421-DOSSIER.pdf) compiled successfully.
              </span>
            </div>
            <span className="font-mono text-micro text-text-muted">Digital Signature: SHA-256 Validated</span>
          </div>
        )}

        {/* Dossier Cover Sheet */}
        <div className="rounded-lg border border-border-strong bg-surface-1 p-6 space-y-5 shadow-panel">
          <div className="flex items-center justify-between border-b border-border-subtle pb-4">
            <div className="space-y-1">
              <span className="text-micro font-mono font-semibold uppercase tracking-wider text-text-muted">
                GOVERNMENT OF RAJASTHAN &bull; POLICE DEPARTMENT
              </span>
              <h2 className="text-lg font-bold text-text-primary">
                ELECTRONIC EVIDENCE CERTIFICATE (DEMO TEMPLATE)
              </h2>
              <p className="text-xs text-text-muted font-mono">
                Simulated Annexure for Section 65B(4) IEA / Section 63 Bharatiya Sakshya Adhiniyam 2023
              </p>
            </div>

            <div className="text-right space-y-1 font-mono text-micro">
              <Badge tone="red" className="text-micro">STRICTLY CONFIDENTIAL</Badge>
              <p className="text-text-muted">Date: {new Date().toLocaleDateString("en-IN")}</p>
              <p className="text-text-muted">Station: Mansarovar Cyber PS</p>
            </div>
          </div>

          {/* Officer Certification Declaration */}
          <div className="rounded bg-surface-2 p-4 border border-border-subtle text-xs space-y-2 leading-relaxed text-text-secondary">
            <p>
              I, <strong>{fullName}</strong>, Badge No. <strong>{badgeNumber}</strong>, holding designation of{" "}
              <strong>{roleLabel}</strong>, Special Operations Group (SOG), Rajasthan Police, hereby certify that:
            </p>
            <ol className="list-decimal pl-5 space-y-1 text-text-primary font-mono text-micro">
              <li>
                The electronic records relating to Case No. <strong>{MOCK_CASE_DETAIL.caseNumber}</strong> were lawfully
                intercepted and ingested into the DRISTI-NET secure repository during the ordinary course of investigation.
              </li>
              <li>
                The computing resources and cryptographic hash verification mechanisms were operating properly with zero
                unauthorized tampering, integrity degradation, or data compromise.
              </li>
              <li>
                Each relationship and evidentiary linkage in this dossier directly corresponds to verifiable primary source
                records preserved under secure chain of custody.
              </li>
            </ol>
          </div>

          {/* Case Ground Truth Summary Table */}
          <div className="space-y-2">
            <span className="text-micro font-mono uppercase tracking-wider text-text-muted">
              I. Investigation Profile &amp; Statutory Grounds
            </span>
            <div className="divide-y divide-border-subtle rounded border border-border-subtle bg-surface-2 text-xs font-mono">
              <div className="p-2.5 flex items-center justify-between">
                <span className="text-text-muted">Case Title:</span>
                <span className="font-semibold text-text-primary">{MOCK_CASE_DETAIL.title}</span>
              </div>
              <div className="p-2.5 flex items-center justify-between">
                <span className="text-text-muted">Registered FIR:</span>
                <span className="text-text-primary">{MOCK_CASE_DETAIL.firNumber}</span>
              </div>
              <div className="p-2.5 flex items-center justify-between">
                <span className="text-text-muted">BNS &amp; IT Act Sections:</span>
                <div className="flex gap-1.5 flex-wrap">
                  {MOCK_CASE_DETAIL.actsAndSections.map((sec) => (
                    <Badge key={sec} tone="neutral" className="text-micro">{sec}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Cryptographic Artifacts Manifest Table */}
          <div className="space-y-2">
            <span className="text-micro font-mono uppercase tracking-wider text-text-muted">
              II. Cryptographic Artifacts &amp; Evidentiary Hashes
            </span>
            <div className="divide-y divide-border-subtle rounded border border-border-subtle bg-surface-2 text-xs">
              {manifestData.map((doc) => (
                <div key={doc.recordId} className="p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-text-primary">{doc.title}</span>
                    <EvidenceTierBadge tier={doc.tier} />
                  </div>
                  <div className="flex items-center justify-between text-micro font-mono text-text-muted gap-2">
                    <span className="flex items-center gap-1">
                      <Hash className="h-3 w-3 text-verified-emerald shrink-0" />
                      <span className="text-text-secondary truncate max-w-md" title={doc.sha256}>
                        {doc.sha256}
                      </span>
                    </span>
                    <span className="shrink-0">{doc.agency}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Signoff Footing */}
          <div className="flex items-center justify-between pt-4 border-t border-border-subtle text-xs font-mono">
            <div className="space-y-0.5">
              <span className="text-text-muted block text-micro">Certifying Officer:</span>
              <p className="font-semibold text-text-primary">{fullName}</p>
              <p className="text-micro text-text-muted">{roleLabel} &bull; SOG Jaipur</p>
            </div>

            <div className="text-right space-y-0.5">
              <span className="text-text-muted block text-micro">Authorization Hash:</span>
              <p className="text-micro text-verified-emerald">e4d9f1a28c3b...verified</p>
              <p className="text-micro text-text-muted">Timestamp: {new Date().toISOString()}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
