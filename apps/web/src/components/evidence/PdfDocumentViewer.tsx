import { useState, useRef } from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  FileCheck2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SvgBoundingBoxOverlay } from "./SvgBoundingBoxOverlay";
import { EVIDENCE_TIER_CONFIG, type EvidenceTier } from "@/constants/evidenceTiers";
import type { ProvenanceRecord } from "@/types/entity";
import { maskSensitiveText } from "@/lib/pii";
import { cn } from "@/lib/utils";

interface PdfDocumentViewerProps {
  record: ProvenanceRecord;
  className?: string;
}

export function PdfDocumentViewer({ record, className }: PdfDocumentViewerProps) {
  const [zoom, setZoom] = useState(1.0);
  const [page] = useState(1);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(
    record.boundingBoxes[0]?.id || null,
  );

  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = () => setZoom((z) => Math.min(2.0, +(z + 0.15).toFixed(2)));
  const handleZoomOut = () => setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)));
  const handleResetZoom = () => setZoom(1.0);

  return (
    <div className={cn("flex flex-col h-full bg-surface-2 border-r border-border-subtle", className)}>
      {/* Top Document Controls Bar */}
      <div className="flex h-11 items-center justify-between px-3 bg-surface-1 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileCheck2 className="h-4 w-4 text-electric-blue-soft shrink-0" />
          <span className="text-xs font-mono font-medium text-text-primary truncate">
            {maskSensitiveText(record.documentTitle)}
          </span>
        </div>

        {/* Zoom & Page Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-text-secondary"
            onClick={handleZoomOut}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="text-micro font-mono text-text-muted px-1">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-text-secondary"
            onClick={handleZoomIn}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-text-secondary"
            onClick={handleResetZoom}
            aria-label="Reset zoom"
          >
            <Maximize className="h-3.5 w-3.5" />
          </Button>

          <div className="mx-1.5 h-3.5 w-px bg-border-subtle" />

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-text-disabled cursor-not-allowed"
            disabled
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-micro font-mono text-text-muted px-1">Page {page} of 1</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-text-disabled cursor-not-allowed"
            disabled
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Document Viewport */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-6 flex justify-center bg-[#070a0e]"
      >
        <div
          className="relative bg-[#ffffff] text-[#111827] shadow-2xl transition-transform duration-150 origin-top select-text"
          style={{
            width: "680px",
            minHeight: "880px",
            transform: `scale(${zoom})`,
            marginBottom: `${Math.max(0, (zoom - 1) * 880)}px`,
            fontFamily: '"JetBrains Mono", monospace',
          }}
        >
          {/* Document Content Sheet */}
          <div className="p-8 text-[11px] leading-relaxed relative">
            {/* Watermark */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.04] pointer-events-none select-none">
              <span className="text-7xl font-bold uppercase tracking-widest text-[#000000] rotate-[-35deg]">
                EVIDENTIARY COPY
              </span>
            </div>

            {/* Official Header */}
            <div className="text-center border-b-2 border-[#111827] pb-4 mb-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#4b5563]">
                Government of Rajasthan &bull; Special Operations Group (SOG)
              </p>
              <h1 className="text-sm font-bold uppercase tracking-tight text-[#111827] mt-1">
                Call Detail Record (CDR) Ingestion Transcript
              </h1>
              <p className="text-[9px] text-[#6b7280] mt-0.5">
                Case File: Active &bull; Evidentiary Ingestion Preview
              </p>
            </div>

            {/* Ingestion & Case Header Info */}
            <div className="grid grid-cols-2 gap-2 border border-[#d1d5db] bg-[#f9fafb] p-3 text-[10px] mb-4">
              <div>
                <span className="text-[#6b7280]">Source Agency: </span>
                <span className="font-semibold text-[#111827]">{maskSensitiveText(record.sourceAgency)}</span>
              </div>
              <div>
                <span className="text-[#6b7280]">Raw Artifact ID: </span>
                <span className="font-semibold font-mono text-[#111827]">{record.rawArtifactId}</span>
              </div>
              <div>
                <span className="text-[#6b7280]">Ingestion Hash: </span>
                <span className="font-mono text-[8.5px] text-[#111827] break-all select-all block leading-tight mt-0.5" title={record.sha256Hash}>
                  {record.sha256Hash}
                </span>
              </div>
              <div>
                <span className="text-[#6b7280]">Evidence Tier: </span>
                <span className="font-mono text-[#111827] font-semibold">
                  Tier {record.evidenceTier} &bull; {EVIDENCE_TIER_CONFIG[record.evidenceTier as EvidenceTier]?.label || `Tier ${record.evidenceTier}`}
                </span>
              </div>
              {record.analystSignoff && (
                <div>
                  <span className="text-[#6b7280]">Analyst Sign-off: </span>
                  <span className="font-mono text-[#111827] font-semibold">
                    {record.analystSignoff.officerName} ({record.analystSignoff.badgeNumber})
                  </span>
                </div>
              )}
            </div>

            {/* Detailed Transcript Rows */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#e5e7eb] pb-1 text-[9px] font-bold uppercase text-[#4b5563]">
                <span>Log Index</span>
                <span>Timestamp</span>
                <span>Calling / Called</span>
                <span>Cell-ID / BTS</span>
                <span>Dur / Type</span>
              </div>

              {/* Normal Row 1 */}
              <div className="flex items-center justify-between text-[9.5px] py-1 text-[#6b7280] border-b border-[#f3f4f6]">
                <span>#4410</span>
                <span>14-FEB 10:02:11</span>
                <span>{maskSensitiveText("+91-98*****210")} &rarr; {maskSensitiveText("+91-94*****100")}</span>
                <span>404-45-412-10</span>
                <span>42s / VOICE</span>
              </div>

              {/* Normal Row 2 */}
              <div className="flex items-center justify-between text-[9.5px] py-1 text-[#6b7280] border-b border-[#f3f4f6]">
                <span>#4411</span>
                <span>14-FEB 10:11:45</span>
                <span>{maskSensitiveText("+91-98*****210")} &rarr; {maskSensitiveText("+91-97*****441")}</span>
                <span>404-45-412-10</span>
                <span>12s / SMS</span>
              </div>

              {/* CRITICAL EXTRACTED ROW (Matches Bounding Box!) */}
              <div className="bg-[#eff6ff] border-l-4 border-[#3b82f6] p-2.5 my-2 space-y-1 rounded-xs">
                <div className="flex items-center justify-between text-[10px] font-bold text-[#1e40af]">
                  <span>LOG ENTRY #4412 &bull; EXTORTION THREAT CALL</span>
                  <span className="bg-[#dbeafe] text-[#1d4ed8] px-1.5 py-0.5 rounded text-[8.5px]">
                    FLAGGED EVIDENCE
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[9.5px] text-[#1e3a8a] font-mono mt-1">
                  <div>
                    A-Party (Caller): <span className="font-bold">{maskSensitiveText("+91-98*****210")}</span>
                  </div>
                  <div>
                    B-Party (Victim): <span className="font-bold">{maskSensitiveText("+91-98*****990")}</span>
                  </div>
                  <div>
                    Originating Cell: <span className="font-bold">404-45-412-10</span> (Tower 412)
                  </div>
                  <div>
                    Duration: <span className="font-bold">184 Seconds</span>
                  </div>
                  <div>
                    Device IMEI: <span className="font-bold">3589********102</span>
                  </div>
                  <div>
                    Call Disposition: <span className="font-bold text-[#15803d]">ANSWERED / RECORDED</span>
                  </div>
                </div>
              </div>

              {/* Normal Row 3 */}
              <div className="flex items-center justify-between text-[9.5px] py-1 text-[#6b7280] border-b border-[#f3f4f6]">
                <span>#4413</span>
                <span>14-FEB 10:24:00</span>
                <span>{maskSensitiveText("+91-98*****210")} &rarr; {maskSensitiveText("+91-98*****412")}</span>
                <span>404-45-412-10</span>
                <span>18s / VOICE</span>
              </div>

              {/* Normal Row 4 */}
              <div className="flex items-center justify-between text-[9.5px] py-1 text-[#6b7280] border-b border-[#f3f4f6]">
                <span>#4414</span>
                <span>14-FEB 10:48:33</span>
                <span>{maskSensitiveText("+91-98*****210")} &rarr; {maskSensitiveText("+91-94*****819")}</span>
                <span>404-45-412-10</span>
                <span>65s / VOICE</span>
              </div>
            </div>

            {/* Extracted Speech Summary in FIR */}
            <div className="mt-8 border border-[#e5e7eb] bg-[#fdfdfd] p-3 rounded text-[9.5px] space-y-1.5">
              <p className="font-bold text-[#374151] uppercase text-[9px]">
                Audio Transcription Snippet (Whisper-NER-Indic Model):
              </p>
              <p className="italic text-[#4b5563] border-l-2 border-[#9ca3af] pl-2 py-0.5">
                &ldquo;...₹2.5 Crore subah 11 baje tak MI Road par pahunch jana chahiye. Police ko bataya
                toh parivar mein koi nahi bachega...&rdquo;
              </p>
            </div>

            {/* Analyst Review & Evidence Record Notice */}
            <div className="mt-10 pt-4 border-t border-[#d1d5db] flex items-end justify-between text-[9px]">
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-[#1d4ed8] font-bold">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Investigative Evidentiary Record</span>
                </div>
                {record.analystSignoff && (
                  <p className="text-[#4b5563]">
                    Reviewing Officer: {maskSensitiveText(record.analystSignoff.officerName)} ({record.analystSignoff.badgeNumber}) &bull; {maskSensitiveText(record.analystSignoff.role)}
                  </p>
                )}
                <p className="text-[#6b7280] text-[8.5px]">
                  Navigational indexing preview. Legal admissibility subject to production of primary source documents.
                </p>
              </div>

              <div className="text-right border border-[#9ca3af] bg-[#f9fafb] p-2 rounded text-[8.5px] text-[#4b5563]">
                <p className="font-bold uppercase text-[#111827]">SOG INVESTIGATION RECORD</p>
                <p className="font-mono text-[8px]">Case: Active</p>
              </div>
            </div>
          </div>

          {/* Precision SVG Bounding Box Overlay */}
          <SvgBoundingBoxOverlay
            boundingBoxes={record.boundingBoxes}
            selectedBoxId={selectedBoxId}
            onSelectBox={(boxId) => setSelectedBoxId(boxId)}
          />
        </div>
      </div>
    </div>
  );
}
