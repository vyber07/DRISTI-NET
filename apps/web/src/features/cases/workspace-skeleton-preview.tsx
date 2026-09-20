import { Link } from "react-router-dom";
import { Waypoints, PanelRightClose, ListTree, SlidersHorizontal } from "lucide-react";
import { InvestigationShell } from "@/layouts/InvestigationShell/investigation-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const CASE_NAV_LABELS = ["Overview", "Graph", "Timeline", "Evidence", "Alerts", "Reports"];

function PlaceholderPane({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="rounded-lg border border-border-subtle bg-surface-2 p-3 text-text-muted">
        {icon}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-text-primary">{title}</p>
        <p className="max-w-xs text-xs text-text-muted">{description}</p>
      </div>
    </div>
  );
}

/**
 * Renders the InvestigationShell with placeholder content in every slot.
 *
 * This is a Phase 1 structural check only — it verifies the three-pane grid,
 * borders, and scroll regions behave correctly. It intentionally contains no
 * case data, no Sigma.js/Graphology graph, and no drawer logic. The real
 * `/cases/:caseId/graph` route mounts the same InvestigationShell component
 * with live slots in Phase 2/3.
 */
function WorkspaceSkeletonPreview() {
  return (
    <InvestigationShell
      header={
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/command-center">&larr; Back</Link>
            </Button>
            <span className="text-sm font-semibold text-text-primary">
              DR-2026-00421 &mdash; Interstate Extortion Syndicate
            </span>
            <Badge tone="neutral">Layout skeleton &mdash; Phase 1</Badge>
          </div>
        </div>
      }
      caseNav={
        <nav className="p-2">
          <ul className="flex flex-col gap-0.5">
            {CASE_NAV_LABELS.map((label, i) => (
              <li
                key={label}
                className={
                  "rounded-md px-2.5 py-2 text-sm font-medium " +
                  (i === 1
                    ? "bg-surface-2 text-text-primary"
                    : "text-text-secondary")
                }
              >
                {label}
              </li>
            ))}
          </ul>
        </nav>
      }
      main={
        <PlaceholderPane
          icon={<Waypoints className="h-6 w-6" />}
          title="Investigation Graph"
          description="Sigma.js + Graphology WebGL canvas mounts here in Phase 2. This pane is layout-only for now."
        />
      }
      detailPanel={
        <PlaceholderPane
          icon={<PanelRightClose className="h-6 w-6" />}
          title="Entity / Edge Panel"
          description="EntityDrawer and EdgeDrawer render here once a node or edge is selected (Phase 2)."
        />
      }
      footer={
        <div className="flex h-10 items-center gap-2 px-4 text-xs text-text-muted">
          <ListTree className="h-3.5 w-3.5" />
          <span>System / graph status</span>
          <span className="text-border-strong">|</span>
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Filters &amp; temporal controls arrive in Phase 2</span>
        </div>
      }
    />
  );
}

export { WorkspaceSkeletonPreview };
