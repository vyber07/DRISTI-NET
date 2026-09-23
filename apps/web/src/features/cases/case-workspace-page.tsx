import { useEffect, useState } from "react";
import { useParams, useSearchParams, useLocation, useNavigate, Link } from "react-router-dom";
import { Layers, Network, FileCheck2, Clock, CheckSquare, ShieldCheck, Lock, Radio, Database, ArrowRight } from "lucide-react";
import { InvestigationShell } from "@/layouts/InvestigationShell/investigation-shell";
import { CaseHeader } from "./components/case-header";
import { CaseOverviewView } from "./components/case-overview-view";
import { CaseEvidenceView } from "./evidence/case-evidence-view";
import { CaseTimeline } from "./timeline/case-timeline";
import { CaseAuditView } from "./audit/case-audit-view";
import { CaseDetailSidebar } from "./components/case-detail-sidebar";
import { ProvenanceViewer } from "@/components/evidence/ProvenanceViewer";
import { useUIStore } from "@/stores/uiStore";
import { getCaseDetails } from "@/services/api/casesApi";
import { cn } from "@/lib/utils";
import type { CaseDetail } from "@/types/case";
import { Button } from "@/components/ui/button";

const CASE_NAV_TABS = [
  { id: "overview", label: "Case Overview", icon: Layers },
  { id: "graph", label: "Investigation Map", icon: Network, isRoute: true },
  { id: "evidence", label: "Evidence & Records", icon: FileCheck2 },
  { id: "timeline", label: "Event Timeline", icon: Clock },
  { id: "hitl", label: "Analyst Review", icon: CheckSquare },
  { id: "audit", label: "Audit Trail", icon: ShieldCheck },
];

function CasePlaceholderView({ tabId, caseId, onBackToOverview }: { tabId: string, caseId: string, onBackToOverview: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 bg-surface-1">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-2 border border-border-subtle mb-4">
        <Layers className="h-8 w-8 text-text-muted" />
      </div>
      <h3 className="text-base font-semibold text-text-primary">Feature currently unavailable in UI</h3>
      <p className="mt-2 text-sm text-text-secondary text-center max-w-sm leading-relaxed">
        The "{tabId}" view is pending full backend contract mapping. 
        Case: <span className="font-mono text-electric-blue">{caseId}</span>
      </p>
      <Button variant="secondary" onClick={onBackToOverview} className="mt-6 text-xs gap-1.5 shadow-sm">
        <ArrowRight className="h-3.5 w-3.5 rotate-180" />
        Return to Overview
      </Button>
    </div>
  );
}

export function CaseWorkspacePage() {
  const {  caseId = "CASE-0001" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  let activeTab = "overview";
  if (location.pathname.endsWith("/timeline")) {
    activeTab = "timeline";
  } else if (location.pathname.endsWith("/evidence")) {
    activeTab = "evidence";
  } else if (location.pathname.endsWith("/audit")) {
    activeTab = "audit";
  } else if (location.pathname.endsWith("/overview")) {
    activeTab = "overview";
  } else {
    activeTab = searchParams.get("tab") || "overview";
  }

  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const {  caseInfoPanelExpanded, toggleCaseInfoPanel } = useUIStore();

  useEffect(() => {
    let isMounted = true;
    async function load() {
      if (!caseId) return;
      setIsLoading(true);
      try {
        const res = await getCaseDetails(caseId);
        if (isMounted && res.data) {
          setCaseData(res.data);
        }
      } catch {
        // Error loading case
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [caseId]);

  const handleTabChange = (tabId: string) => {
    if (tabId === "graph") {
      navigate(`/cases/${caseId}/graph`);
      return;
    }
    if (tabId === "timeline") {
      navigate(`/cases/${caseId}/timeline`);
      return;
    }
    if (tabId === "evidence") {
      navigate(`/cases/${caseId}/evidence`);
      return;
    }
    if (tabId === "hitl") {
      navigate(`/cases/${caseId}/hitl`);
      return;
    }
    if (tabId === "audit") {
      navigate(`/cases/${caseId}/audit`);
      return;
    }
    if (tabId === "overview") {
      navigate(`/cases/${caseId}/overview`);
      return;
    }
    setSearchParams({ tab: tabId });
  };

  if (isLoading) { return <div className="flex h-screen items-center justify-center">Loading Workspace...</div>; }
  if (!caseData) { return <div className="p-8 text-center text-text-muted">Failed to load case data.</div>; }

  return (
    <>
      <InvestigationShell
        header={<CaseHeader caseData={caseData} activeTab={activeTab} />}
        caseNav={
          <nav className="p-2 min-w-0">
            <div className="px-2.5 py-1 text-micro font-semibold uppercase tracking-wider text-text-muted truncate">
              Case Workspace
            </div>
            <ul className="flex flex-col gap-0.5 mt-1">
              {CASE_NAV_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                if (tab.isRoute) {
                  return (
                    <li key={tab.id} className="min-w-0">
                      <Link
                        to={`/cases/${caseId}/graph`}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors min-w-0",
                          "text-text-secondary hover:bg-surface-2 hover:text-text-primary",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-text-muted" />
                        <span className="truncate">{tab.label}</span>
                      </Link>
                    </li>
                  );
                }

                return (
                  <li key={tab.id} className="min-w-0">
                    <button
                      type="button"
                      onClick={() => handleTabChange(tab.id)}
                      className={cn(
                        "w-full flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors text-left min-w-0",
                        isActive
                          ? "bg-surface-2 text-text-primary border-l-2 border-electric-blue font-semibold"
                          : "text-text-secondary hover:bg-surface-2 hover:text-text-primary",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          isActive ? "text-electric-blue" : "text-text-muted",
                        )}
                      />
                      <span className="truncate">{tab.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        }
        main={
          activeTab === "overview" ? (
            <CaseOverviewView caseData={caseData} />
          ) : activeTab === "timeline" ? (
            <CaseTimeline caseId={caseId} />
          ) : activeTab === "evidence" ? (
            <CaseEvidenceView  />
          ) : activeTab === "audit" ? (
            <CaseAuditView caseId={caseId} />
          ) : (
            <CasePlaceholderView caseId={caseId}
              tabId={activeTab}
              
              onBackToOverview={() => handleTabChange("overview")}
            />
          )
        }
        detailPanel={
          <CaseDetailSidebar
            caseData={caseData}
            isCollapsed={!caseInfoPanelExpanded}
            onToggleCollapse={toggleCaseInfoPanel}
          />
        }
        isDetailPanelCollapsed={!caseInfoPanelExpanded}
        footer={
          <div className="flex h-10 items-center justify-between px-4 text-xs text-text-muted min-w-0 overflow-hidden">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="flex items-center gap-1 text-text-secondary shrink-0">
                <Lock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span className="font-mono text-micro font-semibold uppercase">
                  {caseData.classification.replace(/_/g, " ")}
                </span>
              </div>

              <span className="text-border-strong shrink-0">|</span>

              <div className="flex items-center gap-1 shrink-0">
                <Radio className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span className="text-micro font-medium">PII Masking: Strict</span>
              </div>

              <span className="text-border-strong hidden xl:inline shrink-0">|</span>

              <span className="hidden xl:inline text-micro truncate">
                Owner: {caseData.owner_id}
              </span>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-1 font-mono text-micro text-text-muted">
                <Database className="h-3 w-3 text-border-strong shrink-0" />
                <span className="hidden sm:inline">Secure Integration</span>
              </div>
            </div>
          </div>
        }
      />

      <ProvenanceViewer />
    </>
  );
}
