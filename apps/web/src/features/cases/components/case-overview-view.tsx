import React from "react";
import type { CaseDetail } from "@/types/case";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Network, FileCheck2, ShieldCheck, Calendar, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CaseOverviewViewProps {
  caseData: CaseDetail;
}

export function CaseOverviewView({ caseData }: CaseOverviewViewProps) {
  if (!caseData) {
    return <div className="p-8 text-center text-text-secondary">No case data available.</div>;
  }

  return (
    <div className="space-y-6">
      {/* 1. Core Meta */}
      <section className="rounded-xl border border-border-subtle bg-surface-1 p-5 space-y-4 shadow-xs">
        <h3 className="text-base font-bold text-text-primary border-b border-border-subtle pb-2">
          Case Properties
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <span className="text-xs text-text-secondary block">Classification</span>
            <Badge tone="neutral" className="text-xs uppercase">{caseData.classification.replace(/_/g, " ")}</Badge>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-text-secondary block">Assigned Unit</span>
            <span className="text-sm font-medium text-text-primary">{caseData.assignedUnit}</span>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-text-secondary block">Lead Investigator</span>
            <span className="text-sm font-medium text-text-primary">{caseData.leadInvestigator.name} ({caseData.leadInvestigator.badgeNumber})</span>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-text-secondary block">Status</span>
            <span className="text-sm font-medium text-text-primary">{caseData.status}</span>
          </div>
        </div>
      </section>

      {/* 2. Investigation Links */}
      <section className="rounded-xl border border-electric-blue/30 bg-electric-blue/5 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h4 className="text-base font-bold text-text-primary">
            Investigation Modules
          </h4>
          <p className="text-xs text-text-secondary max-w-xl">
            Access case evidence, entities, relationships, and review workflows.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <Link to={`/cases/${caseData.id}/evidence`}>
            <Button variant="secondary" size="sm" className="text-xs gap-1.5">
              <FileCheck2 className="h-3.5 w-3.5" />
              <span>Evidence Repository</span>
            </Button>
          </Link>
          <Link to={`/cases/${caseData.id}/graph`}>
            <Button variant="primary" size="sm" className="text-xs gap-1.5 shadow-xs">
              <Network className="h-3.5 w-3.5" />
              <span>Graph Intelligence</span>
            </Button>
          </Link>
        </div>
      </section>

      {/* 3. Security Notice */}
      <div className="flex items-center justify-between py-2 text-xs text-text-muted border-t border-border-subtle mt-8">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-verified-emerald" />
          <span>All sensitive attributes are masked according to PII protocols.</span>
        </div>
        <span className="font-mono text-[11px]">BNSS Compliant Platform</span>
      </div>
    </div>
  );
}
