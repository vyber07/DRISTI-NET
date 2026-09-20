import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { EvidenceTierBadge } from "@/components/intelligence/evidence-tier-badge";
import { ConfidenceMeter } from "@/components/intelligence/confidence-meter";
import { PIIField } from "@/components/intelligence/pii-field";
import { EntityBadge } from "@/components/intelligence/entity-badge";
import { RelationshipBadge } from "@/components/intelligence/relationship-badge";
import { EVIDENCE_TIER_ORDER } from "@/constants/evidenceTiers";

/**
 * Phase 1 verification screen.
 *
 * This is NOT the spec'd Command Center feature (workload/alerts/evidence
 * health panels arrive in a later phase) — it exists solely so the design
 * tokens, typography, and reusable components built in this phase can be
 * inspected in a real browser against the InvestigationShell skeleton.
 */
function FoundationPreviewPage() {
  return (
    <>
      <div className="mx-auto max-w-5xl space-y-10 p-8">
        <header className="space-y-1">
          <p className="text-micro font-semibold uppercase tracking-wide text-text-muted">
            Phase 1 — Foundation
          </p>
          <h1 className="text-h1 font-semibold text-text-primary">Design System Verification</h1>
          <p className="max-w-2xl text-sm text-text-secondary">
            Command Center workload, alert, and evidence-health panels are built in a later
            phase. This screen exists to verify tokens, typography, and reusable components
            against the dark intelligence-workstation visual direction before feature work
            begins.
          </p>
        </header>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Open Case</Button>
            <Button variant="secondary">Filter</Button>
            <Button variant="destructive">Reject</Button>
            <Button variant="restricted" restrictedReason="Supervisor approval required">
              Export Dossier
            </Button>
            <Button variant="ghost">Add Note</Button>
          </div>
        </Section>

        <Section title="Badges">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">Neutral</Badge>
            <Badge tone="blue">Blue</Badge>
            <Badge tone="amber">Amber</Badge>
            <Badge tone="orange">Orange</Badge>
            <Badge tone="emerald">Emerald</Badge>
            <Badge tone="purple">Purple</Badge>
            <Badge tone="red">Red</Badge>
          </div>
        </Section>

        <Section
          title="Evidence Tier Badges"
          description="Tier 1 (Raw Artifact) is intentionally absent — it is never rendered as an evidentiary badge or graph edge."
        >
          <div className="flex flex-wrap items-center gap-2">
            {EVIDENCE_TIER_ORDER.map((tier) => (
              <EvidenceTierBadge key={tier} tier={tier} />
            ))}
          </div>
        </Section>

        <Section title="Confidence Meter">
          <div className="grid max-w-sm gap-4">
            <ConfidenceMeter confidence={0.42} />
            <ConfidenceMeter confidence={0.87} flagManualReview />
            <ConfidenceMeter confidence={0.97} />
          </div>
        </Section>

        <Section
          title="PII Field"
          description="Sample data for component verification only — not a real subscriber record."
        >
          <div className="grid max-w-sm gap-4">
            <PIIField
              label="Phone Number"
              value="+91-9876543210"
              maskedValue="+91-98*****210"
              isMasked
              restrictedReason="Restricted by clearance"
            />
            <PIIField
              label="Bank Account"
              value="99012345678"
              maskedValue="********5678"
              isMasked
              canRequestReveal
            />
            <PIIField
              label="Phone Number"
              value="+91-9012345678"
              maskedValue="+91-90*****678"
              isMasked={false}
            />
          </div>
        </Section>

        <Section
          title="Entity & Relationship Badges"
          description="Sample data for component verification only."
        >
          <div className="flex flex-wrap items-center gap-2">
            <EntityBadge type="PERSON" />
            <EntityBadge type="ORGANIZATION" />
            <EntityBadge type="LOCATION" />
            <EntityBadge type="EVENT" />
            <EntityBadge type="FINANCIAL" />
            <EntityBadge type="CYBER" />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <RelationshipBadge type="COMMUNICATED_WITH" />
            <RelationshipBadge type="CO_LOCATED_AT" hasContradiction />
          </div>
        </Section>

        <Separator />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4">
          <div>
            <p className="text-xs text-text-muted">
              Interactive Investigation Graph &amp; Provenance Subsystem:
            </p>
            <p className="text-micro text-text-disabled">
              Sigma.js v2 WebGL Canvas &bull; POLE+ Shapes &bull; Forensic Provenance &bull; Temporal Scrubber
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="primary" size="sm">
              <Link to="/graph">Open Investigation Graph</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link to="/cases/preview">View Phase 1 skeleton</Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-h3 font-semibold text-text-primary">{title}</h2>
        {description && <p className="text-xs text-text-muted mt-0.5">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export { FoundationPreviewPage };
