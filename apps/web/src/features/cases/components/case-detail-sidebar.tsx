import React from "react";
import type { CaseDetail } from "@/types/case";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserCheck, ShieldCheck, Tag, Calendar, Clock, Building2, Scale, PanelRightClose } from "lucide-react";

interface CaseDetailSidebarProps {
  caseData: CaseDetail;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function CaseDetailSidebar({ caseData, isCollapsed, onToggleCollapse }: CaseDetailSidebarProps) {
  if (!caseData) return null;

  if (isCollapsed) {
    return (
      <div className="w-12 h-full border-l border-border-subtle bg-surface-1 flex flex-col items-center py-3 shrink-0">
        <button
          type="button"
          title="Expand case information panel"
          onClick={onToggleCollapse}
          className="p-1.5 rounded-md hover:bg-surface-2 text-text-muted hover:text-text-primary transition-colors focus:outline-none"
          aria-label="Expand case information panel"
        >
          <div className="flex flex-col items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
            <span className="w-1 h-1 rounded-full bg-current" />
            <span className="w-1 h-1 rounded-full bg-current" />
            <span className="w-1 h-1 rounded-full bg-current" />
          </div>
          <span className="sr-only">Expand case panel</span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full min-w-0 overflow-x-hidden flex flex-col h-full bg-surface-1">
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
          >
            <PanelRightClose className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="w-full max-w-full min-w-0 overflow-x-hidden overflow-y-auto p-3.5 space-y-4 text-xs flex-1">
        
        {/* Owner */}
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-1.5 text-text-muted">
            <UserCheck className="h-3.5 w-3.5 text-electric-blue-soft shrink-0" />
            <span className="text-micro font-semibold uppercase tracking-wider truncate">
              Case Owner
            </span>
          </div>

          <div className="p-3 rounded-lg border border-border-subtle bg-surface-2 space-y-1 min-w-0 overflow-hidden">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="font-semibold text-text-primary text-sm truncate">
                {caseData.owner_id}
              </span>
            </div>
            <p className="text-text-secondary truncate">Owner / Lead</p>
          </div>
        </div>

        {/* Investigation Team */}
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-1.5 text-text-muted">
            <span className="text-micro font-semibold uppercase tracking-wider truncate">
              Assigned Access ({caseData.assigned.length})
            </span>
          </div>

          <div className="divide-y divide-border-subtle/50 rounded-lg border border-border-subtle bg-surface-2 overflow-hidden">
            {caseData.assigned.map((memberId) => (
              <div key={memberId} className="p-2.5 flex items-center justify-between gap-2 min-w-0">
                <span className="font-mono text-micro text-text-primary shrink-0 ml-1">
                  {memberId}
                </span>
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
              <span className="text-micro text-text-muted">Authority Reference</span>
              <p
                className="font-mono text-text-primary mt-0.5 break-all"
                style={{ overflowWrap: "anywhere" }}
              >
                {caseData.authority_reference}
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

            <div className="pt-2 border-t border-border-subtle grid grid-cols-1 gap-2 text-micro min-w-0">
              <div className="min-w-0">
                <span className="text-text-muted flex items-center gap-1 truncate">
                  <Clock className="h-3 w-3 shrink-0" /> Registered
                </span>
                <span className="font-mono text-text-secondary mt-0.5 block truncate">
                  {new Date(caseData.opened_at).toLocaleDateString("en-IN")}
                </span>
              </div>
            </div>
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
              Assigned users only. Access attempts are fully logged and audited.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
