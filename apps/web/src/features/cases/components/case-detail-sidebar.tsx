import {
  UserCheck,
  Scale,
  Building2,
  Calendar,
  ShieldCheck,
  Tag,
  Clock,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateOnly } from "@/lib/formatters";
import type { CaseDetail } from "@/types/case";

interface CaseDetailSidebarProps {
  caseData: CaseDetail;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function CaseDetailSidebar({
  caseData,
  isCollapsed = false,
  onToggleCollapse,
}: CaseDetailSidebarProps) {
  if (isCollapsed) {
    return (
      <div className="h-full w-full flex flex-col items-center py-2.5 px-1 select-none">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          className="h-8 w-8 p-0 text-text-muted hover:text-text-primary hover:bg-surface-2 rounded transition-colors"
          title="Expand case information panel"
          aria-label="Expand case information panel"
        >
          <PanelRightOpen className="h-4 w-4 text-text-secondary hover:text-electric-blue" />
        </Button>

        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex-1 flex flex-col items-center justify-start pt-6 cursor-pointer group w-full hover:bg-surface-2/50 transition-colors py-2 rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-electric-blue"
          title="Expand case information panel"
          aria-label="Expand case information panel"
        >
          <span
            className="text-[10px] font-bold uppercase tracking-wider text-text-muted group-hover:text-text-primary transition-colors select-none"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            Case Information
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full min-w-0 overflow-x-hidden flex flex-col h-full">
      {/* Header with Title and Single Compact Collapse Button */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border-subtle bg-surface-1 shrink-0">
        <span className="text-micro font-bold uppercase tracking-wider text-text-muted truncate">
          Case Information
        </span>
        {onToggleCollapse && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className="h-7 w-7 p-0 text-text-muted hover:text-text-primary hover:bg-surface-2 shrink-0 rounded transition-colors"
            title="Collapse case information panel"
            aria-label="Collapse case information panel"
          >
            <PanelRightClose className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="w-full max-w-full min-w-0 overflow-x-hidden overflow-y-auto p-3.5 space-y-4 text-xs flex-1">
      {/* Lead Investigator */}
      <div className="space-y-1.5 min-w-0">
        <div className="flex items-center gap-1.5 text-text-muted">
          <UserCheck className="h-3.5 w-3.5 text-electric-blue-soft shrink-0" />
          <span className="text-micro font-semibold uppercase tracking-wider truncate">
            Lead Investigating Officer
          </span>
        </div>

        <div className="p-3 rounded-lg border border-border-subtle bg-surface-2 space-y-1 min-w-0 overflow-hidden">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span className="font-semibold text-text-primary text-sm truncate">
              {caseData.leadInvestigator.name}
            </span>
            <Badge tone="blue" className="font-mono text-micro shrink-0">
              {caseData.leadInvestigator.badgeNumber}
            </Badge>
          </div>
          <p className="text-text-secondary truncate">{caseData.leadInvestigator.role}</p>
          {caseData.leadInvestigator.contact && (
            <p
              className="text-micro font-mono text-text-muted break-all pt-0.5"
              style={{ overflowWrap: "anywhere" }}
            >
              {caseData.leadInvestigator.contact}
            </p>
          )}
        </div>
      </div>

      {/* Investigation Team */}
      <div className="space-y-1.5 min-w-0">
        <div className="flex items-center gap-1.5 text-text-muted">
          <span className="text-micro font-semibold uppercase tracking-wider truncate">
            Assigned Team ({caseData.assignedTeam.length})
          </span>
        </div>

        <div className="divide-y divide-border-subtle/50 rounded-lg border border-border-subtle bg-surface-2 overflow-hidden">
          {caseData.assignedTeam.map((member) => (
            <div key={member.badgeNumber} className="p-2.5 flex items-center justify-between gap-2 min-w-0">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-text-primary truncate">{member.name}</p>
                <p className="text-micro text-text-muted truncate mt-0.5">{member.role}</p>
              </div>
              <span className="font-mono text-micro text-text-disabled shrink-0 ml-1">
                {member.badgeNumber}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Statutory Legal Framework */}
      <div className="space-y-1.5 min-w-0">
        <div className="flex items-center gap-1.5 text-text-muted">
          <Scale className="h-3.5 w-3.5 text-electric-blue-soft shrink-0" />
          <span className="text-micro font-semibold uppercase tracking-wider truncate">
            Acts &amp; Statutory Sections
          </span>
        </div>

        <div className="space-y-1">
          {caseData.actsAndSections.map((sec) => (
            <div
              key={sec}
              className="px-2 py-1 rounded border border-border-subtle bg-surface-2 text-micro text-text-secondary font-mono leading-tight"
              style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
            >
              {sec}
            </div>
          ))}
        </div>
      </div>

      {/* Docket & Jurisdiction Details */}
      <div className="space-y-1.5 min-w-0">
        <div className="flex items-center gap-1.5 text-text-muted">
          <Building2 className="h-3.5 w-3.5 text-electric-blue-soft shrink-0" />
          <span className="text-micro font-semibold uppercase tracking-wider truncate">
            Docket &amp; Jurisdiction
          </span>
        </div>

        <div className="p-3 rounded-lg border border-border-subtle bg-surface-2 space-y-2 min-w-0 overflow-hidden">
          <div className="min-w-0">
            <span className="text-micro text-text-muted">Police Station</span>
            <p className="font-medium text-text-primary mt-0.5 truncate">{caseData.policeStation}</p>
          </div>

          <div className="min-w-0">
            <span className="text-micro text-text-muted">FIR Reference</span>
            <p
              className="font-mono text-text-primary mt-0.5 break-all"
              style={{ overflowWrap: "anywhere" }}
            >
              {caseData.firNumber}
            </p>
          </div>

          <div className="min-w-0">
            <span className="text-micro text-text-muted">Jurisdiction Unit</span>
            <p
              className="font-mono text-electric-blue-soft mt-0.5"
              style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
            >
              {caseData.jurisdiction}
            </p>
          </div>

          <div className="pt-2 border-t border-border-subtle grid grid-cols-2 gap-2 text-micro min-w-0">
            <div className="min-w-0">
              <span className="text-text-muted flex items-center gap-1 truncate">
                <Calendar className="h-3 w-3 shrink-0" /> Incident
              </span>
              <span className="font-mono text-text-secondary mt-0.5 block truncate">
                {formatDateOnly(caseData.incidentDate)}
              </span>
            </div>
            <div className="min-w-0">
              <span className="text-text-muted flex items-center gap-1 truncate">
                <Clock className="h-3 w-3 shrink-0" /> Registered
              </span>
              <span className="font-mono text-text-secondary mt-0.5 block truncate">
                {formatDateOnly(caseData.registeredDate)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Investigation Tags */}
      <div className="space-y-1.5 min-w-0">
        <div className="flex items-center gap-1.5 text-text-muted">
          <Tag className="h-3.5 w-3.5 text-electric-blue-soft shrink-0" />
          <span className="text-micro font-semibold uppercase tracking-wider truncate">
            Investigation Tags
          </span>
        </div>

        <div className="flex flex-wrap gap-1">
          {caseData.tags.map((tag) => (
            <Badge key={tag} tone="neutral" className="text-micro font-mono truncate max-w-[130px]">
              #{tag}
            </Badge>
          ))}
        </div>
      </div>

      {/* Security Clearance Requirement */}
      <div className="p-2.5 rounded-lg border border-border-subtle bg-surface-3 flex items-start gap-2 text-micro text-text-muted min-w-0">
        <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <span className="font-medium text-text-primary block truncate">
            Controlled Case File
          </span>
          <p className="text-micro text-text-muted leading-relaxed mt-0.5">
            Clearance Level 2 (Investigator) or higher required for full dossier &amp; unmasked PII access.
          </p>
        </div>
      </div>
    </div>
    </div>
  );
}
