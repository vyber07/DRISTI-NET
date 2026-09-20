import type { ReactNode } from "react";
import { MonitorSmartphone } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface InvestigationShellProps {
  /** Case header row: case title, search, breadcrumb — supplied by the feature layer in Phase 3. */
  header: ReactNode;
  /** Left case navigation (Overview/Graph/Timeline/Evidence/Alerts/Reports) — Phase 3. */
  caseNav: ReactNode;
  /** Center pane — the Investigation Graph in Phase 2. */
  main: ReactNode;
  /** Right pane — Entity/Edge Drawer in Phase 2. */
  detailPanel?: ReactNode;
  /** Bottom bar — graph status/filters/temporal controls in Phase 2. */
  footer: ReactNode;
  /** Optional collapsed state for the right detail panel / rail */
  isDetailPanelCollapsed?: boolean;
}

/**
 * Structural skeleton for the primary investigation shell (frontend spec §8).
 * This component intentionally contains no graph, drawer, or provenance logic —
 * it only defines the three-pane layout contract that Phase 2 fills in. Each
 * region is a typed slot so the eventual GraphCanvas/EntityDrawer/EdgeDrawer
 * mount directly into this shell without a layout rewrite.
 *
 * This shell is deliberately desktop-only (spec's persona table gives Field
 * Operators a genuinely separate mobile/tablet experience — masked sub-graph
 * lists via FieldShell — rather than a cramped version of the analyst graph
 * workspace). Below the width a three-pane graph workspace can reasonably
 * work, we show an explicit notice instead of silently squeezing the case
 * nav and detail panel until the graph pane disappears.
 */
function InvestigationShell({
  header,
  caseNav,
  main,
  detailPanel,
  footer,
  isDetailPanelCollapsed = false,
}: InvestigationShellProps) {
  return (
    <div className="h-full w-full max-w-full min-h-0 min-w-0 overflow-hidden flex flex-col">
      <div className="hidden h-full flex-1 flex-col min-h-0 min-w-0 w-full max-w-full overflow-hidden md:flex">
        {/* Pinned Case Header */}
        <div className="border-b border-border-subtle bg-surface-1 shrink-0 w-full max-w-full min-w-0 overflow-hidden">
          {header}
        </div>

        {/* Workspace Area: 3-column when detailPanel open, 2-column when closed */}
        <div
          className={cn(
            "flex-1 min-h-0 min-w-0 w-full max-w-full grid overflow-hidden transition-all duration-150",
            detailPanel
              ? isDetailPanelCollapsed
                ? "grid-cols-[150px_minmax(0,1fr)_44px] xl:grid-cols-[155px_minmax(0,1fr)_44px]"
                : "grid-cols-[150px_minmax(0,1fr)_290px] xl:grid-cols-[155px_minmax(0,1fr)_300px]"
              : "grid-cols-[150px_minmax(0,1fr)] xl:grid-cols-[155px_minmax(0,1fr)]",
          )}
        >
          {/* Left: Case Navigation Tabs */}
          <div className="border-r border-border-subtle bg-surface-1 overflow-y-auto overflow-x-hidden min-w-0 min-h-0 w-[150px] xl:w-[155px] max-w-[150px] xl:max-w-[155px]">
            {caseNav}
          </div>

          {/* Center: Main Workspace Content */}
          <div className="relative min-w-0 min-h-0 w-full max-w-full bg-background overflow-hidden flex flex-col">
            {main}
          </div>

          {/* Right: Case Detail & Intelligence Panel */}
          {detailPanel && (
            <div
              className={cn(
                "border-l border-border-subtle bg-surface-1 overflow-y-auto overflow-x-hidden min-h-0 transition-all duration-150",
                isDetailPanelCollapsed
                  ? "w-[44px] max-w-[44px]"
                  : "min-w-0 w-[290px] xl:w-[300px] max-w-[290px] xl:max-w-[300px]",
              )}
            >
              {detailPanel}
            </div>
          )}
        </div>

        {/* Pinned Bottom Footer */}
        <Separator className="shrink-0" />
        <div className="bg-surface-1 shrink-0 w-full max-w-full min-w-0 overflow-hidden">
          {footer}
        </div>
      </div>

      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center md:hidden">
        <div className="rounded-lg border border-border-subtle bg-surface-2 p-3 text-text-muted">
          <MonitorSmartphone className="h-6 w-6 text-teal-primary" />
        </div>
        <div className="max-w-xs space-y-1">
          <p className="text-sm font-semibold text-text-primary">
            Best experienced on tablet or desktop
          </p>
          <p className="text-xs text-text-muted">
            The interactive map, clue drawer, and evidence documents are optimized for screens 768px and wider.
          </p>
        </div>
      </div>
    </div>
  );
}

export { InvestigationShell };
