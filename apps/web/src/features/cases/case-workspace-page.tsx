import { useEffect, useState } from "react";
import { useParams, useSearchParams, useLocation, useNavigate, Link } from "react-router-dom";
import { Layers, Network, FileCheck2, Clock, CheckSquare, ShieldCheck, Lock, Radio, Database, ArrowRight, BarChart2, MapPin, Star } from "lucide-react";
import { InvestigationShell } from "@/layouts/InvestigationShell/investigation-shell";
import { CaseHeader } from "./components/case-header";
import { CaseOverviewView } from "./components/case-overview-view";
import { CaseEvidenceView } from "./evidence/case-evidence-view";
import { CaseTimeline } from "./timeline/case-timeline";
import { CaseAuditView } from "./audit/case-audit-view";
import { CaseAnalysisPage } from "./analysis/case-analysis-page";
import { InvestigationMapView } from "./map/investigation-map-view";
import { CaseReviewsView } from "./reviews/case-reviews-view";
import { CaseDetailSidebar } from "./components/case-detail-sidebar";
import { ProvenanceViewer } from "@/components/evidence/ProvenanceViewer";
import { useUIStore } from "@/stores/uiStore";
import { getCaseDetails } from "@/services/api/casesApi";
import { cn } from "@/lib/utils";
import type { CaseDetail } from "@/types/case";
import { Button } from "@/components/ui/button";

const CASE_NAV_TABS = [
  { id: "overview",  label: "Case Overview",    icon: Layers },
  { id: "graph",     label: "Investigation Map", icon: Network,  isRoute: true },
  { id: "map",       label: "Location Map",      icon: MapPin },
  { id: "evidence",  label: "Evidence & Records",icon: FileCheck2 },
  { id: "timeline",  label: "Event Timeline",    icon: Clock },
  { id: "analysis",  label: "Graph Analysis",    icon: BarChart2 },
  { id: "hitl",      label: "Analyst Review",    icon: CheckSquare },
  { id: "reviews",   label: "Decisions",         icon: Star },
  { id: "audit",     label: "Audit Trail",       icon: ShieldCheck },
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
  const {  caseId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  let activeTab = "overview";
  if (location.pathname.endsWith("/timeline")) activeTab = "timeline";
  else if (location.pathname.endsWith("/evidence")) activeTab = "evidence";
  else if (location.pathname.endsWith("/audit")) activeTab = "audit";
  else if (location.pathname.endsWith("/overview")) activeTab = "overview";
  else if (location.pathname.endsWith("/map")) activeTab = "map";
  else if (location.pathname.endsWith("/analysis")) activeTab = "analysis";
  else if (location.pathname.endsWith("/reviews")) activeTab = "reviews";
  else activeTab = searchParams.get("tab") || "overview";

  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const {  caseInfoPanelExpanded, toggleCaseInfoPanel } = useUIStore();

  useEffect(() => {
    let isMounted = true;
    async function load() {
      if (!caseId) return;
      // DEF-078: drop the previous case before loading, and keep the failure reason (a 403 used to leave the old
      // case's header and data on screen, or show a bare "Failed to load case data").
      setCaseData(null);
      setLoadError(null);
      setIsLoading(true);
      try {
        const res = await getCaseDetails(caseId);
        if (isMounted && res.data) {
          setCaseData(res.data);
        }
      } catch (e: any) {
        if (isMounted) setLoadError(e?.message || "error");
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
    const directRoutes: Record<string, string> = {
      graph: `/cases/${caseId}/graph`,
      timeline: `/cases/${caseId}/timeline`,
      evidence: `/cases/${caseId}/evidence`,
      hitl: `/cases/${caseId}/hitl`,
      audit: `/cases/${caseId}/audit`,
      overview: `/cases/${caseId}/overview`,
      map: `/cases/${caseId}/map`,
      analysis: `/cases/${caseId}/analysis`,
      reviews: `/cases/${caseId}/reviews`,
    };
    if (directRoutes[tabId]) { navigate(directRoutes[tabId]); return; }
    setSearchParams({ tab: tabId });
  };

  if (isLoading) { return <div className="flex h-screen items-center justify-center">Loading Workspace...</div>; }
  if (!caseData) { return <div role="alert" className="p-8 text-center text-text-muted">Could not load case {caseId}{loadError ? `: ${loadError}` : "."}</div>; }

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
            <CaseEvidenceView />
          ) : activeTab === "audit" ? (
            <CaseAuditView caseId={caseId} />
          ) : activeTab === "map" ? (
            <InvestigationMapView />
          ) : activeTab === "analysis" ? (
            <CaseAnalysisPage />
          ) : activeTab === "reviews" ? (
            <CaseReviewsView />
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
