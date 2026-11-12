import { createBrowserRouter, Navigate, useParams } from "react-router-dom";
import { AppShell } from "@/layouts/AppShell/app-shell";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { LoginPage } from "@/features/auth/login-page";
import { CommandCenterPage } from "@/features/command-center/command-center-page";
import { CasesDirectoryPage } from "@/features/cases/cases-directory-page";
import { CaseLayout } from "@/features/cases/case-layout";
import { CaseOverviewView } from "@/features/cases/components/case-overview-view";
import { CaseEvidenceView } from "@/features/cases/evidence/case-evidence-view";
import { ReviewQueuePage } from "@/features/review/review-page";
import { CaseGraphPage } from "@/features/cases/case-graph-page";
import { CaseTimelineTab } from "@/features/cases/timeline/case-timeline";
import { InvestigationMapView } from "@/features/cases/map/investigation-map-view";
import { CaseAnalysisPage } from "@/features/cases/analysis/case-analysis-page";
import { CaseReviewsView } from "@/features/cases/reviews/case-reviews-view";
import { CaseAuditTab } from "@/features/cases/audit/case-audit-view";
import { ReportsPage } from "@/features/reports/reports-page";
import { ProfilePage } from "@/features/profile/profile-page";
import { GlobalAuditPage } from "@/features/audit/global-audit-page";
import { UserManagementPage } from "@/features/admin/user-management-page";
import { PermissionOverridesPage } from "@/features/admin/permission-overrides-page";
import { NotFoundPage } from "@/features/not-found/not-found-page";
import { RouteErrorPage } from "@/features/not-found/route-error-page";

/** Redirect that keeps the :caseId (and optional :taskId) of an old URL. */
function CaseRedirect({ to }: { to: string }) {
  const { caseId = "", taskId } = useParams();
  const target = to.replace(":caseId", encodeURIComponent(caseId)).replace(":taskId", taskId ? encodeURIComponent(taskId) : "");
  return <Navigate to={target.replace(/\/$/, "")} replace />;
}

/**
 * Route map (frontend-design/PROPOSED_INFORMATION_ARCHITECTURE.md). Every case page renders inside CaseLayout, so the
 * case title, breadcrumb and tabs are always present. Old URLs redirect; unknown URLs get a real "not found" page.
 */
export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage />, errorElement: <RouteErrorPage /> },
  {
    path: "/",
    errorElement: <RouteErrorPage />,
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/command-center" replace /> },
      { path: "command-center", element: <CommandCenterPage /> },
      { path: "home", element: <Navigate to="/command-center" replace /> },
      { path: "cases", element: <CasesDirectoryPage /> },
      {
        path: "cases/:caseId",
        element: <CaseLayout />,
        children: [
          { index: true, element: <CaseOverviewView /> },
          { path: "evidence", element: <CaseEvidenceView /> },
          { path: "review", element: <ReviewQueuePage /> },
          { path: "review/:taskId", element: <ReviewQueuePage /> },
          { path: "graph", element: <CaseGraphPage /> },
          { path: "timeline", element: <CaseTimelineTab /> },
          { path: "locations", element: <InvestigationMapView /> },
          { path: "analysis", element: <CaseAnalysisPage /> },
          { path: "decisions", element: <CaseReviewsView /> },
          { path: "reports", element: <ReportsPage /> },
          { path: "audit", element: <CaseAuditTab /> },
          // Old URLs (bookmarks, links in reports and docs) keep working.
          { path: "overview", element: <CaseRedirect to="/cases/:caseId" /> },
          { path: "hitl", element: <CaseRedirect to="/cases/:caseId/review" /> },
          { path: "hitl/:taskId", element: <CaseRedirect to="/cases/:caseId/review/:taskId" /> },
          { path: "map", element: <CaseRedirect to="/cases/:caseId/locations" /> },
          { path: "reviews", element: <CaseRedirect to="/cases/:caseId/decisions" /> },
          { path: "report", element: <CaseRedirect to="/cases/:caseId/reports" /> },
          { path: "notes", element: <CaseRedirect to="/cases/:caseId" /> },
          { path: "*", element: <NotFoundPage inCase /> },
        ],
      },
      { path: "profile", element: <ProfilePage /> },
      { path: "settings", element: <Navigate to="/profile" replace /> },
      { path: "audit", element: <GlobalAuditPage /> },
      { path: "admin/users", element: <UserManagementPage /> },
      { path: "admin/overrides", element: <PermissionOverridesPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
