import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Compass,
  FolderOpen,
  Network,
  FileCheck2,
  Clock,
  Sparkles,
  HelpCircle,
  FileText,
  PhoneCall,
  Landmark,
  MapPin,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HowItWorksModal } from "./components/HowItWorksModal";

export function CommandCenterPage() {
  const navigate = useNavigate();
  const [guideModalOpen, setGuideModalOpen] = useState(false);

  return (
    <div className="flex flex-col h-full flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden bg-background">
      {/* 1. Top Orientation Header */}
      <header className="flex h-14 items-center justify-between border-b border-border-subtle bg-surface-1 px-6 shrink-0 select-none">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-electric-blue/10 text-electric-blue">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-text-primary">
                DRISTI-NET Investigation Platform
              </h1>
              <Badge tone="emerald" className="text-[10px] font-semibold">
                DEMO CASE READY
              </Badge>
            </div>
            <p className="text-[11px] text-text-muted">
              Connect the clues &bull; Understand the case &bull; Verify against original evidence
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setGuideModalOpen(true)}
            className="text-xs text-text-secondary hover:text-text-primary gap-1.5"
          >
            <HelpCircle className="h-3.5 w-3.5 text-electric-blue" />
            <span>How does this work?</span>
          </Button>

          <Link to="/cases/DR-2026-00421">
            <Button variant="primary" size="sm" className="text-xs gap-1.5 shadow-sm">
              <span>Explore Demo Case</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <div className="p-6 md:p-8 max-w-6xl mx-auto w-full space-y-10">
        {/* 2. Hero Section: 10-Second Value Proposition */}
        <section className="rounded-2xl border border-border-subtle bg-surface-1 p-6 md:p-8 shadow-panel relative overflow-hidden">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-electric-blue/10 text-electric-blue text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Simple Outside &bull; Powerful Inside</span>
            </div>

            <h2 className="text-2xl md:text-3xl font-extrabold text-text-primary tracking-tight leading-tight">
              Connect the clues. Understand the case.
            </h2>

            <p className="text-sm md:text-base text-text-secondary leading-relaxed">
              Bring people, calls, financial records, locations and documents together in one
              investigation view — and verify connections against original evidence.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link to="/cases/DR-2026-00421">
                <Button variant="primary" size="md" className="text-sm gap-2 px-5 py-2.5 shadow-xs">
                  <span>Explore Demo Case</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>

              <Button
                variant="secondary"
                size="md"
                onClick={() => setGuideModalOpen(true)}
                className="text-sm gap-2"
              >
                <span>How DRISTI-NET Works</span>
              </Button>

              <Link to="/cases/DR-2026-00421/graph">
                <Button variant="ghost" size="md" className="text-sm text-electric-blue gap-1.5">
                  <Network className="h-4 w-4" />
                  <span>Open Investigation Map</span>
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* 3. Visual Story: Evidence Records -> DRISTI-NET -> Connected Clues -> Investigation -> Verified Evidence */}
        <section className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-text-primary">
              How DRISTI-NET Brings Investigations Together
            </h3>
            <p className="text-xs text-text-secondary">
              From raw incident reports to verified courtroom-ready truth in 5 simple stages.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative">
            {/* Stage 1 */}
            <div className="rounded-xl border border-border-subtle bg-surface-1 p-4 space-y-2.5 shadow-xs transition-transform hover:-translate-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold text-text-muted">STAGE 01</span>
                <div className="p-1.5 rounded-lg bg-surface-2 text-text-secondary">
                  <FileText className="h-4 w-4" />
                </div>
              </div>
              <h4 className="text-sm font-bold text-text-primary">Evidence Records</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                FIRs, telecom call records, bank statements, and location logs are gathered.
              </p>
            </div>

            {/* Stage 2 */}
            <div className="rounded-xl border border-electric-blue/40 bg-electric-blue/5 p-4 space-y-2.5 shadow-xs transition-transform hover:-translate-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold text-electric-blue">STAGE 02</span>
                <div className="p-1.5 rounded-lg bg-electric-blue/10 text-electric-blue">
                  <Compass className="h-4 w-4" />
                </div>
              </div>
              <h4 className="text-sm font-bold text-text-primary">DRISTI-NET</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                Brings different records together and extracts names, numbers, and accounts.
              </p>
            </div>

            {/* Stage 3 */}
            <div className="rounded-xl border border-border-subtle bg-surface-1 p-4 space-y-2.5 shadow-xs transition-transform hover:-translate-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold text-text-muted">STAGE 03</span>
                <div className="p-1.5 rounded-lg bg-amber/10 text-amber">
                  <Network className="h-4 w-4" />
                </div>
              </div>
              <h4 className="text-sm font-bold text-text-primary">Connected Clues</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                Finds relationships: shared phone numbers, cash transfers, and co-locations.
              </p>
            </div>

            {/* Stage 4 */}
            <div className="rounded-xl border border-border-subtle bg-surface-1 p-4 space-y-2.5 shadow-xs transition-transform hover:-translate-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold text-text-muted">STAGE 04</span>
                <div className="p-1.5 rounded-lg bg-surface-2 text-text-secondary">
                  <Clock className="h-4 w-4" />
                </div>
              </div>
              <h4 className="text-sm font-bold text-text-primary">Investigation</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                Investigators explore connections visually on the map and event timeline.
              </p>
            </div>

            {/* Stage 5 */}
            <div className="rounded-xl border border-verified-emerald/40 bg-verified-emerald/5 p-4 space-y-2.5 shadow-xs transition-transform hover:-translate-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold text-verified-emerald">STAGE 05</span>
                <div className="p-1.5 rounded-lg bg-verified-emerald/10 text-verified-emerald">
                  <ShieldCheck className="h-4 w-4" />
                </div>
              </div>
              <h4 className="text-sm font-bold text-text-primary">Verified Evidence</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                Every connection is verified against original highlighted source documents.
              </p>
            </div>
          </div>
        </section>

        {/* 4. Primary Demo Case Card */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-electric-blue">
                Active Investigation Docket
              </span>
              <h3 className="text-lg font-bold text-text-primary">
                Demo Case: Interstate Extortion Syndicate
              </h3>
            </div>
            <Badge tone="neutral" className="font-mono text-xs">
              CASE DR-2026-00421
            </Badge>
          </div>

          <div className="rounded-xl border border-border-strong bg-surface-1 p-6 space-y-6 shadow-sm">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="blue">Extortion &amp; Threat Call</Badge>
                <Badge tone="amber">Mule Accounts</Badge>
                <Badge tone="emerald">Hawala Cash Courier</Badge>
                <span className="text-xs text-text-muted">&bull;</span>
                <span className="text-xs text-text-secondary font-medium">Jaipur &bull; NCR Jurisdiction</span>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed max-w-4xl">
                A structured syndicate targeting Jaipur infrastructure contractors demanding ₹2.5 Crore
                in extortion cash. Threat calls were routed through proxy VoIP servers, while cash payments
                were collected by local Hawala couriers and banked into shell business accounts.
              </p>
            </div>

            {/* Plain Case Statistics */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 bg-surface-2 rounded-xl border border-border-subtle text-center">
              <div className="space-y-1">
                <div className="flex items-center justify-center text-text-muted gap-1">
                  <span className="text-xs font-medium">People</span>
                </div>
                <p className="text-xl font-bold text-text-primary">4</p>
                <span className="text-[11px] text-text-muted block">Suspects &amp; Complainant</span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-center text-text-muted gap-1">
                  <PhoneCall className="h-3 w-3" />
                  <span className="text-xs font-medium">Phones</span>
                </div>
                <p className="text-xl font-bold text-text-primary">2</p>
                <span className="text-[11px] text-text-muted block">Active Handsets</span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-center text-text-muted gap-1">
                  <Landmark className="h-3 w-3" />
                  <span className="text-xs font-medium">Accounts</span>
                </div>
                <p className="text-xl font-bold text-text-primary">1</p>
                <span className="text-[11px] text-text-muted block">Mule Bank Account</span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-center text-text-muted gap-1">
                  <MapPin className="h-3 w-3" />
                  <span className="text-xs font-medium">Locations</span>
                </div>
                <p className="text-xl font-bold text-text-primary">3</p>
                <span className="text-[11px] text-text-muted block">Tower &amp; Safehouses</span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-center text-text-muted gap-1">
                  <FileCheck2 className="h-3 w-3" />
                  <span className="text-xs font-medium">Documents</span>
                </div>
                <p className="text-xl font-bold text-verified-emerald">4</p>
                <span className="text-[11px] text-text-muted block">Original Proof Records</span>
              </div>
            </div>

            {/* Launch Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border-subtle">
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <span className="font-semibold text-text-primary">Suggested next action:</span>
                <span>Open the Investigation Map to see how suspect Vikram is linked to the bank account.</span>
              </div>

              <div className="flex items-center gap-2">
                <Link to="/cases/DR-2026-00421">
                  <Button variant="secondary" size="sm" className="text-xs gap-1.5">
                    <FolderOpen className="h-3.5 w-3.5" />
                    <span>Case Overview</span>
                  </Button>
                </Link>

                <Link to="/cases/DR-2026-00421/graph">
                  <Button variant="primary" size="sm" className="text-xs gap-1.5">
                    <Network className="h-3.5 w-3.5" />
                    <span>Open Investigation Map</span>
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Three Simple Steps Section */}
        <section className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-text-primary">
              Three Steps of an Investigation
            </h3>
            <p className="text-xs text-text-secondary">
              Everything in DRISTI-NET is designed around this simple 3-step workflow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border-subtle bg-surface-1 p-5 space-y-2.5">
              <div className="h-8 w-8 rounded-lg bg-electric-blue/10 text-electric-blue flex items-center justify-center font-bold text-sm">
                01
              </div>
              <h4 className="text-sm font-bold text-text-primary">Collect Evidence</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                Bring police complaints, call detail records, bank ledger statements, and cell tower
                dumps into one secure case docket.
              </p>
            </div>

            <div className="rounded-xl border border-border-subtle bg-surface-1 p-5 space-y-2.5">
              <div className="h-8 w-8 rounded-lg bg-amber/10 text-amber flex items-center justify-center font-bold text-sm">
                02
              </div>
              <h4 className="text-sm font-bold text-text-primary">Connect the Clues</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                Automatically discover hidden connections: two people using the same handset,
                bank transfers between shell companies, or suspects at the same tower.
              </p>
            </div>

            <div className="rounded-xl border border-border-subtle bg-surface-1 p-5 space-y-2.5">
              <div className="h-8 w-8 rounded-lg bg-verified-emerald/10 text-verified-emerald flex items-center justify-center font-bold text-sm">
                03
              </div>
              <h4 className="text-sm font-bold text-text-primary">Investigate &amp; Verify</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                Click any connection on the map to inspect the original signed document with
                exact highlighted proof — ready for judicial submission.
              </p>
            </div>
          </div>
        </section>

        {/* 6. Plain-Language Investigation Alerts */}
        <section className="rounded-xl border border-border-subtle bg-surface-1 p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-critical-red" />
              <h3 className="text-sm font-bold text-text-primary">
                Important Clues &amp; Items Requiring Review
              </h3>
            </div>
            <Link to="/alerts" className="text-xs text-electric-blue hover:underline flex items-center gap-1 font-medium">
              <span>View All Alerts</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="divide-y divide-border-subtle rounded-lg border border-border-subtle bg-surface-2 text-xs">
            <div className="p-3.5 flex items-center justify-between gap-4 flex-wrap">
              <div className="space-y-0.5 max-w-2xl">
                <div className="flex items-center gap-2">
                  <Badge tone="red" className="text-[10px]">Conflicting Location</Badge>
                  <span className="font-semibold text-text-primary">
                    Cell tower and toll camera report different locations at the same time
                  </span>
                </div>
                <p className="text-text-secondary text-xs">
                  Tower 412 Mansarovar placed Vikram&apos;s handset in Jaipur at 10:15 AM, while an ANPR camera recorded the vehicle 40 km away on NH-8.
                </p>
              </div>

              <Link to="/hitl/HITL-2026-001">
                <Button variant="secondary" size="sm" className="text-xs text-amber border-amber/30 hover:bg-amber/10 gap-1">
                  <span>Review Conflict</span>
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>

            <div className="p-3.5 flex items-center justify-between gap-4 flex-wrap">
              <div className="space-y-0.5 max-w-2xl">
                <div className="flex items-center gap-2">
                  <Badge tone="blue" className="text-[10px]">New Connection</Badge>
                  <span className="font-semibold text-text-primary">
                    Two records reference the same phone number
                  </span>
                </div>
                <p className="text-text-secondary text-xs">
                  Handset IMEI 3589********102 was found active in both the victim&apos;s threat call log and suspect Vikram&apos;s Airtel SIM profile.
                </p>
              </div>

              <Link to="/cases/DR-2026-00421/graph">
                <Button variant="secondary" size="sm" className="text-xs text-electric-blue border-electric-blue/30 hover:bg-electric-blue/10 gap-1">
                  <span>See on Map</span>
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* Guided Walkthrough Modal */}
      <HowItWorksModal
        open={guideModalOpen}
        onOpenChange={setGuideModalOpen}
        onStartDemoCase={() => navigate("/cases/DR-2026-00421")}
      />
    </div>
  );
}
