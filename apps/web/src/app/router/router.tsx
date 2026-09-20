import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/layouts/AppShell/app-shell";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { LoginPage } from "@/features/auth/login-page";
import { CommandCenterPage } from "@/features/command-center/command-center-page";
import { CasesDirectoryPage } from "@/features/cases/cases-directory-page";
import { WorkspaceSkeletonPreview } from "@/features/cases/workspace-skeleton-preview";
import { CaseGraphPage } from "@/features/cases/case-graph-page";
import { CaseWorkspacePage } from "@/features/cases/case-workspace-page";
import { HITLWorkspacePage } from "@/features/hitl/hitl-workspace-page";
import { AlertsPage } from "@/features/alerts/alerts-page";
import { ReportsPage } from "@/features/reports/reports-page";
import { SettingsPage } from "@/features/settings/settings-page";
import MapView from "@/legacy/MapView";
import AnalysisPanel from "@/legacy/AnalysisPanel";
import ReportPanel from "@/legacy/ReportPanel";

/**
 * Route table updated for Phase 5 & SIH 2026 Evaluation:
 * Adds dedicated mock login screen with protected route gating.
 */
export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/command-center" replace /> },
      { path: "command-center", element: <CommandCenterPage /> },
      { path: "cases", element: <CasesDirectoryPage /> },
      { path: "cases/:caseId", element: <CaseWorkspacePage /> },
      { path: "cases/:caseId/overview", element: <CaseWorkspacePage /> },
      { path: "cases/:caseId/graph", element: <CaseGraphPage /> },
      { path: "cases/:caseId/timeline", element: <CaseWorkspacePage /> },
      { path: "cases/:caseId/evidence", element: <CaseWorkspacePage /> },
      { path: "cases/:caseId/notes", element: <CaseWorkspacePage /> },
      { path: "cases/:caseId/map", element: <MapView caseId="TODO_EXTRACT_FROM_PARAMS" /> },
      { path: "cases/:caseId/analysis", element: <AnalysisPanel caseId="TODO" /> },
      { path: "cases/:caseId/report", element: <ReportPanel caseId="TODO" /> },

      { path: "cases/:caseId/audit", element: <CaseWorkspacePage /> },
      { path: "graph", element: <CaseGraphPage /> },
      { path: "evidence", element: <Navigate to="/cases/DR-2026-00421/evidence" replace /> },
      { path: "timeline", element: <Navigate to="/cases/DR-2026-00421/timeline" replace /> },
      { path: "audit", element: <Navigate to="/cases/DR-2026-00421/audit" replace /> },
      { path: "hitl", element: <HITLWorkspacePage /> },
      { path: "hitl/:taskId", element: <HITLWorkspacePage /> },
      { path: "alerts", element: <AlertsPage /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "cases/preview", element: <WorkspaceSkeletonPreview /> },
      { path: "*", element: <Navigate to="/command-center" replace /> },
    ],
  },
]);

