import { Link } from "react-router-dom";
import {
  Radar,
  FileSpreadsheet,
  FileText,
  ShieldCheck,
  Waypoints,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PlaceholderConfig {
  icon: typeof Radar;
  title: string;
  phaseBadge: string;
  description: string;
  capabilities: string[];
}

const TAB_CONFIGS: Record<string, PlaceholderConfig> = {
  timeline: {
    icon: Radar,
    title: "Chronological Event Stream & Spatial-Temporal Reconciliation",
    phaseBadge: "Phase 3.4 Feature",
    description:
      "Interactive multi-source temporal scrubber for crime incidents, telecom pings, and Hawala deliveries with automated contradiction detection.",
    capabilities: [
      "Dynamic interval scrubbing (1-second precision)",
      "Multi-channel event filters (GSM, VoIP, Hawala, ANPR)",
      "Spatio-temporal contradiction arbitration interface",
      "Automated event clustering across POLE+ entities",
    ],
  },
  evidence: {
    icon: FileSpreadsheet,
    title: "Evidentiary Dossier & Tamper-Evident Artifacts",
    phaseBadge: "Phase 3.5 Feature",
    description:
      "Document registry, forensic PDF inspection, Bounding Box overlay viewer, and tamper-evident demo certificate verification.",
    capabilities: [
      "Tamper-evident demo verification format",
      "Dual-source bounding box coordinate overlays",
      "Direct chain-of-custody cryptographic verification",
      "Raw artifact SHA-256 hash comparison",
    ],
  },
  notes: {
    icon: FileText,
    title: "Analyst Working Notes & Working Hypotheses",
    phaseBadge: "Phase 3.6 Feature",
    description:
      "Structured investigative notes linked directly to entities, relationships, and evidence with role-based access restrictions.",
    capabilities: [
      "Hypothesis, Operational & Evidence note categorizations",
      "Direct cross-linking to POLE+ nodes and graph edges",
      "Full text tag indexing and search",
      "Supervisor restricted note flags",
    ],
  },
  audit: {
    icon: ShieldCheck,
    title: "Cryptographic Audit Trail & Chain of Custody",
    phaseBadge: "Phase 3.7 Feature",
    description:
      "Immutable SHA-256 chained audit logs recording all case access, graph filtering, tier updates, and PII reveal operations.",
    capabilities: [
      "SHA-256 hash chaining for tamper evidence",
      "PII reveal authorization and access logs",
      "Granular investigator action tracking",
      "Cryptographic export verification",
    ],
  },
};

interface CasePlaceholderViewProps {
  tabId: string;
  caseId: string;
  onBackToOverview: () => void;
}

export function CasePlaceholderView({
  tabId,
  caseId,
  onBackToOverview,
}: CasePlaceholderViewProps) {
  const config = TAB_CONFIGS[tabId] || {
    icon: Radar,
    title: "Workspace Module",
    phaseBadge: "Upcoming Phase",
    description: "This module is scheduled for implementation in a later phase.",
    capabilities: [],
  };

  const Icon = config.icon;

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-background overflow-y-auto">
      <div className="max-w-md space-y-4">
        <div className="mx-auto w-12 h-12 rounded-xl border border-border-subtle bg-surface-2 flex items-center justify-center text-electric-blue-soft shadow-inner">
          <Icon className="h-6 w-6" />
        </div>

        <div className="space-y-1.5">
          <Badge tone="blue" className="font-mono text-micro uppercase tracking-wider">
            {config.phaseBadge}
          </Badge>
          <h2 className="text-h3 font-semibold text-text-primary">
            {config.title}
          </h2>
          <p className="text-xs text-text-muted leading-relaxed">
            {config.description}
          </p>
        </div>

        {config.capabilities.length > 0 && (
          <div className="p-3 rounded-lg border border-border-subtle bg-surface-1 text-left space-y-1.5">
            <span className="text-micro font-semibold uppercase tracking-wider text-text-muted block">
              Planned Capabilities:
            </span>
            <ul className="space-y-1 text-xs text-text-secondary">
              {config.capabilities.map((cap, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-electric-blue shrink-0" />
                  <span>{cap}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-center gap-3 pt-2">
          <Button variant="secondary" size="sm" onClick={onBackToOverview} className="gap-1.5 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Overview</span>
          </Button>

          <Button asChild variant="primary" size="sm" className="gap-1.5 text-xs">
            <Link to={`/cases/${caseId}/graph`}>
              <Waypoints className="h-3.5 w-3.5" />
              <span>Open Investigation Graph</span>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
