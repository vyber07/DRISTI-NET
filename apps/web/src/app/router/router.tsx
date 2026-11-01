import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/layouts/AppShell/app-shell";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { LoginPage } from "@/features/auth/login-page";
import { CommandCenterPage } from "@/features/command-center/command-center-page";
import { CasesDirectoryPage } from "@/features/cases/cases-directory-page";
import { CaseGraphPage } from "@/features/cases/case-graph-page";
import { CaseWorkspacePage } from "@/features/cases/case-workspace-page";
import { HITLWorkspacePage } from "@/features/hitl/hitl-workspace-page";
import { ReportsPage } from "@/features/reports/reports-page";
import { SettingsPage } from "@/features/settings/settings-page";
import { ProfilePage } from "@/features/profile/profile-page";
import { GlobalAuditPage } from "@/features/audit/global-audit-page";

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
      { path: "cases/:caseId/map", element: <CaseWorkspacePage /> },
      { path: "cases/:caseId/analysis", element: <CaseWorkspacePage /> },
      { path: "cases/:caseId/reviews", element: <CaseWorkspacePage /> },
      { path: "cases/:caseId/notes", element: <CaseWorkspacePage /> },
      { path: "cases/:caseId/report", element: <ReportsPage /> },
      { path: "cases/:caseId/reports", element: <ReportsPage /> },
      { path: "cases/:caseId/audit", element: <CaseWorkspacePage /> },
      { path: "cases/:caseId/hitl", element: <HITLWorkspacePage /> },
      { path: "cases/:caseId/hitl/:taskId", element: <HITLWorkspacePage /> },
      { path: "profile", element: <ProfilePage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "audit", element: <GlobalAuditPage /> },
      { path: "*", element: <Navigate to="/command-center" replace /> },
    ],
  },
]);
