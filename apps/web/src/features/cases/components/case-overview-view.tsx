import { Link } from "react-router-dom";
import {
  Network,
  FileCheck2,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  FileText,
  PhoneCall,
  Landmark,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CaseStatsGrid } from "./case-stats-grid";
import type { CaseDetail } from "@/types/case";

interface CaseOverviewViewProps {
  caseData: CaseDetail;
}

export function CaseOverviewView({ caseData }: CaseOverviewViewProps) {
  return (
    <div className="h-full w-full max-w-full min-w-0 overflow-y-auto overflow-x-hidden p-5 md:p-6 space-y-6 bg-background select-none">
      {/* 1. Case Overview Header & Narrative */}
      <section className="rounded-2xl border border-border-subtle bg-surface-1 p-6 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-3.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-electric-blue">
                Case Overview
              </span>
              <Badge tone="neutral" className="text-micro font-mono">
                {caseData.caseNumber}
              </Badge>
            </div>
            <h2 className="text-xl font-extrabold text-text-primary tracking-tight mt-0.5">
              What we&apos;re investigating
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <Link to={`/cases/${caseData.id}/graph`}>
              <Button variant="primary" size="sm" className="gap-1.5 text-xs shadow-xs">
                <Network className="h-3.5 w-3.5" />
                <span>Open Investigation Map</span>
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </div>

        <p className="text-sm text-text-secondary leading-relaxed max-w-4xl">
          {caseData.summaryNarrative ||
            "An organized extortion network operating across Rajasthan and the NCR region. The syndicate targets infrastructure contractors with extortion calls, collects cash drops via local Hawala operators, and deposits proceeds into mule accounts registered under shell trading companies."}
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <span className="font-semibold text-text-muted">Registered at:</span>
          <span className="text-text-primary font-medium">{caseData.policeStation}</span>
          <span className="text-border-strong">&bull;</span>
          <span className="font-semibold text-text-muted">FIR Reference:</span>
          <span className="font-mono text-text-primary">{caseData.firNumber}</span>
          <span className="text-border-strong">&bull;</span>
          <span className="font-semibold text-text-muted">Lead Officer:</span>
          <span className="text-text-primary font-medium">{caseData.leadInvestigator.name} ({caseData.leadInvestigator.badgeNumber})</span>
        </div>
      </section>

      {/* 2. Plain Visual Statistics */}
      <section className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">
          Investigation Clues &amp; Records at a Glance
        </h3>
        <CaseStatsGrid stats={caseData.stats} />
      </section>

      {/* 3. "What's Connected?" Story Cards */}
      <section className="space-y-3">
        <div>
          <h3 className="text-base font-bold text-text-primary">
            What&apos;s Connected?
          </h3>
          <p className="text-xs text-text-secondary">
            Key connections found automatically by linking phone records, bank transfers, and location sightings.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1 */}
          <div className="rounded-xl border border-border-subtle bg-surface-1 p-5 space-y-3 shadow-xs hover:border-border-strong transition-all flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-amber/10 text-amber">
                  <PhoneCall className="h-4 w-4" />
                </div>
                <h4 className="text-sm font-bold text-text-primary">
                  One phone number connects two people
                </h4>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Handset IMEI 3589********102 received the extortion demand on victim Rajesh&apos;s line and was also active under suspect Vikram&apos;s SIM card.
              </p>
            </div>

            <div className="pt-2 border-t border-border-subtle/80 flex items-center justify-between">
              <span className="text-[11px] text-text-muted">Source: Telecom CDR &bull; Police FIR</span>
              <Link to={`/cases/${caseData.id}/graph`}>
                <Button variant="ghost" size="sm" className="text-xs text-electric-blue hover:text-electric-blue font-semibold gap-1 p-0 h-auto">
                  <span>See Connection</span>
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Card 2 */}
          <div className="rounded-xl border border-border-subtle bg-surface-1 p-5 space-y-3 shadow-xs hover:border-border-strong transition-all flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-verified-emerald/10 text-verified-emerald">
                  <Landmark className="h-4 w-4" />
                </div>
                <h4 className="text-sm font-bold text-text-primary">
                  A financial transfer links two case entities
                </h4>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                ₹5,00,000 cash was banked into mule Account ********6789 at HDFC MI Road, which operates directly for Vikram&apos;s front company Marwar Gold.
              </p>
            </div>

            <div className="pt-2 border-t border-border-subtle/80 flex items-center justify-between">
              <span className="text-[11px] text-text-muted">Source: Bank Statement &bull; KYC Ledger</span>
              <Link to={`/cases/${caseData.id}/graph`}>
                <Button variant="ghost" size="sm" className="text-xs text-electric-blue hover:text-electric-blue font-semibold gap-1 p-0 h-auto">
                  <span>See Connection</span>
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Card 3 */}
          <div className="rounded-xl border border-border-subtle bg-surface-1 p-5 space-y-3 shadow-xs hover:border-border-strong transition-all flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-electric-blue/10 text-electric-blue">
                  <MapPin className="h-4 w-4" />
                </div>
                <h4 className="text-sm font-bold text-text-primary">
                  Two records point to the same location
                </h4>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Cell Tower 412 in Mansarovar registered both the extortion threat call and suspect Vikram&apos;s personal mobile handset during the call window.
              </p>
            </div>

            <div className="pt-2 border-t border-border-subtle/80 flex items-center justify-between">
              <span className="text-[11px] text-text-muted">Source: Airtel Cell Tower Dump</span>
              <Link to={`/cases/${caseData.id}/graph`}>
                <Button variant="ghost" size="sm" className="text-xs text-electric-blue hover:text-electric-blue font-semibold gap-1 p-0 h-auto">
                  <span>See Connection</span>
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Card 4 */}
          <div className="rounded-xl border border-border-subtle bg-surface-1 p-5 space-y-3 shadow-xs hover:border-border-strong transition-all flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-court-purple/10 text-court-purple">
                  <FileText className="h-4 w-4" />
                </div>
                <h4 className="text-sm font-bold text-text-primary">
                  Hawala cash courier linked to suspect
                </h4>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Courier Arvind collected ₹10 Lakhs in physical cash and coordinated handovers through Marwar Gold Trading safehouses.
              </p>
            </div>

            <div className="pt-2 border-t border-border-subtle/80 flex items-center justify-between">
              <span className="text-[11px] text-text-muted">Source: Seizure Memo &bull; WhatsApp Export</span>
              <Link to={`/cases/${caseData.id}/graph`}>
                <Button variant="ghost" size="sm" className="text-xs text-electric-blue hover:text-electric-blue font-semibold gap-1 p-0 h-auto">
                  <span>See Connection</span>
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Conflict / Review Callout Banner */}
      <section className="rounded-xl border border-amber/30 bg-amber/5 p-4.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber/20 text-amber shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-text-primary">
                1 Location Conflict Flagged for Investigator Review
              </h4>
              <Badge tone="amber" className="text-[10px]">Action Required</Badge>
            </div>
            <p className="text-xs text-text-secondary max-w-xl">
              Tower 412 places suspect Vikram in Mansarovar at 10:15 AM, but an ANPR camera detected his registered vehicle 40 km away on NH-8 at the exact same time.
            </p>
          </div>
        </div>

        <Link to="/hitl/HITL-2026-001">
          <Button variant="secondary" size="sm" className="text-xs text-amber border-amber/40 hover:bg-amber/10 shrink-0">
            <span>Review Conflict</span>
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </section>

      {/* 5. Primary Next Steps Launcher */}
      <section className="rounded-xl border border-electric-blue/30 bg-electric-blue/5 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-electric-blue block">
            What to do next
          </span>
          <h4 className="text-base font-bold text-text-primary">
            Explore the Interactive Investigation Map
          </h4>
          <p className="text-xs text-text-secondary max-w-xl">
            See how the 4 people, 2 phones, mule account, and 3 locations connect together in an interactive visual network. Click any connection to inspect its supporting evidence.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Link to={`/cases/${caseData.id}/evidence`}>
            <Button variant="secondary" size="sm" className="text-xs gap-1.5">
              <FileCheck2 className="h-3.5 w-3.5" />
              <span>Case Evidence (4)</span>
            </Button>
          </Link>

          <Link to={`/cases/${caseData.id}/graph`}>
            <Button variant="primary" size="sm" className="text-xs gap-1.5 shadow-xs">
              <Network className="h-3.5 w-3.5" />
              <span>Launch Map</span>
              <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </section>

      {/* 6. Security and Masking Notice */}
      <div className="flex items-center justify-between py-2 text-xs text-text-muted border-t border-border-subtle">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-verified-emerald" />
          <span>All sensitive phone numbers and bank accounts are masked by default</span>
        </div>
        <span className="font-mono text-[11px]">DRISTI-NET Demo Case &bull; BNSS Compliant</span>
      </div>
    </div>
  );
}
