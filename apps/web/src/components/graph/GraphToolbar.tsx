import { useState } from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Play,
  Pause,
  AlertTriangle,
  Search,
  Filter,
  SlidersHorizontal,
  User,
  Building2,
  MapPin,
  CalendarClock,
  Landmark,
  ShieldHalf,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EVIDENCE_TIER_CONFIG, EVIDENCE_TIER_ORDER } from "@/constants/evidenceTiers";
import type { EntityType } from "@/types/entity";
import { useGraphStore } from "@/stores/graphStore";
import { cn } from "@/lib/utils";
import { maskPersonName, maskSensitiveText } from "@/lib/pii";

interface GraphToolbarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onToggleLayout: () => void;
  isLayoutRunning: boolean;
  className?: string;
}

const POLE_ICONS: Record<EntityType, typeof User> = {
  PERSON: User,
  ORGANIZATION: Building2,
  LOCATION: MapPin,
  EVENT: CalendarClock,
  FINANCIAL: Landmark,
  CYBER: ShieldHalf,
};

export function GraphToolbar({
  onZoomIn,
  onZoomOut,
  onReset,
  onToggleLayout,
  isLayoutRunning,
  className,
}: GraphToolbarProps) {
  const {
    activeTiers,
    activeEntityTypes,
    activeRelationshipTypes,
    minConfidence,
    onlyContradictions,
    searchTerm,
    nodes,
    isFilterPanelOpen,
    toggleTier,
    toggleEntityType,
    setOnlyContradictions,
    setSearchTerm,
    selectNode,
    toggleFilterPanel,
  } = useGraphStore();

  let activeFilterCount = 0;
  if (activeTiers.size < 5) activeFilterCount++;
  if (activeEntityTypes.size < 6) activeFilterCount++;
  if (activeRelationshipTypes.size < 6) activeFilterCount++;
  if (onlyContradictions) activeFilterCount++;
  if (minConfidence > 0) activeFilterCount++;

  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const visibleEntitiesCount = nodes.filter((n) =>
    activeEntityTypes.has((n.entityType || (n as unknown as { type: EntityType }).type) as EntityType),
  ).length;

  const filteredSearchResults = searchTerm.trim()
    ? nodes
        .filter(
          (n) =>
            n.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
            n.maskedLabel.toLowerCase().includes(searchTerm.toLowerCase()),
        )
        .slice(0, 5)
    : [];

  return (
    <div
      className={cn(
        "absolute top-3 left-3 right-3 z-20 flex items-center justify-between gap-1 flex-nowrap max-w-full pointer-events-none select-none",
        className,
      )}
    >
      {/* Left group: Navigation & Controls */}
      <div className="flex items-center gap-1 rounded-md border border-border-strong bg-surface-1/95 p-1 backdrop-blur shadow-panel pointer-events-auto shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-text-secondary hover:text-text-primary shrink-0"
              onClick={onZoomIn}
              aria-label="Zoom in"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Zoom In</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-text-secondary hover:text-text-primary shrink-0"
              onClick={onZoomOut}
              aria-label="Zoom out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Zoom Out</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-text-secondary hover:text-text-primary shrink-0"
              onClick={onReset}
              aria-label="Fit to Screen"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Fit to Screen</TooltipContent>
        </Tooltip>

        <div className="mx-0.5 h-4 w-px bg-border-subtle shrink-0" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isLayoutRunning ? "primary" : "ghost"}
              size="sm"
              className={cn(
                "h-7 px-1.5 sm:px-2 text-xs gap-1 font-medium shrink-0",
                isLayoutRunning && "bg-teal-primary text-white",
              )}
              onClick={onToggleLayout}
            >
              {isLayoutRunning ? (
                <>
                  <Pause className="h-3 w-3" />
                  <span className="hidden sm:inline">Pause</span>
                </>
              ) : (
                <>
                  <Play className="h-3 w-3" />
                  <span className="hidden sm:inline 2xl:hidden">Organize</span>
                  <span className="hidden 2xl:inline">Organize Map</span>
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Automatically arrange clues cleanly</TooltipContent>
        </Tooltip>
      </div>

      {/* Center: Proof Levels + Contradiction Filter */}
      <div className="flex items-center gap-0.5 sm:gap-1 rounded-md border border-border-strong bg-surface-1/95 p-1 backdrop-blur shadow-panel pointer-events-auto shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isFilterPanelOpen ? "primary" : "ghost"}
              size="sm"
              className={cn(
                "h-7 px-1.5 sm:px-2 text-xs gap-1 font-medium shrink-0",
                isFilterPanelOpen && "bg-teal-primary text-white",
              )}
              onClick={toggleFilterPanel}
              aria-label="Toggle Filter Panel"
            >
              <SlidersHorizontal className="h-3 w-3" />
              <span className="hidden sm:inline 2xl:hidden">Filter</span>
              <span className="hidden 2xl:inline">Filter Clues</span>
              {activeFilterCount > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.2 text-micro font-mono",
                    isFilterPanelOpen
                      ? "bg-white/25 text-white"
                      : "bg-teal-primary/20 text-teal-primary font-semibold",
                  )}
                >
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Open Filter Controls
          </TooltipContent>
        </Tooltip>

        <div className="mx-0.5 h-4 w-px bg-border-subtle shrink-0" />

        {EVIDENCE_TIER_ORDER.map((tier) => {
          const cfg = EVIDENCE_TIER_CONFIG[tier];
          const isActive = activeTiers.has(tier);
          return (
            <Tooltip key={tier}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => toggleTier(tier)}
                  className={cn(
                    "flex items-center gap-0.5 rounded px-1 py-0.5 text-[11px] font-mono font-medium transition-colors shrink-0",
                    isActive
                      ? "bg-surface-3 text-text-primary border border-border-strong"
                      : "opacity-40 text-text-disabled hover:opacity-75",
                  )}
                >
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: `var(--tier-${tier}-color)` }}
                  />
                  <span>T{tier}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="font-semibold text-text-primary">{cfg.label}</p>
                <p className="text-text-muted">{cfg.code}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}

        <div className="mx-0.5 h-4 w-px bg-border-subtle shrink-0" />

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setOnlyContradictions(!onlyContradictions)}
              className={cn(
                "flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium transition-colors shrink-0",
                onlyContradictions
                  ? "bg-critical-red/20 border border-critical-red text-critical-red font-semibold"
                  : "text-text-muted hover:text-critical-red",
              )}
            >
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span className="hidden 2xl:inline">Alerts</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Filter to conflicting witness/evidence claims
          </TooltipContent>
        </Tooltip>

        <div className="relative shrink-0 hidden 2xl:block">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-1.5 text-xs gap-1 text-text-secondary hover:text-text-primary shrink-0"
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                aria-label="Filter entities by type"
              >
                <Filter className="h-3 w-3 shrink-0" />
                <span>Clue Types</span>
                <span>
                  ({visibleEntitiesCount === nodes.length ? `${nodes.length}` : `${visibleEntitiesCount}/${nodes.length}`})
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Filter by clue categories ({visibleEntitiesCount} of {nodes.length} clues visible)
            </TooltipContent>
          </Tooltip>

          {showFilterDropdown && (
            <div className="absolute right-0 top-full mt-1.5 w-48 rounded-md border border-border-strong bg-surface-raised p-2 shadow-panel z-50">
              <p className="text-micro font-semibold uppercase tracking-wide text-text-muted mb-1.5 px-1">
                Clue Categories
              </p>
              <div className="space-y-1">
                {(
                  [
                    "PERSON",
                    "ORGANIZATION",
                    "LOCATION",
                    "EVENT",
                    "FINANCIAL",
                    "CYBER",
                  ] as EntityType[]
                ).map((type) => {
                  const Icon = POLE_ICONS[type];
                  const isChecked = activeEntityTypes.has(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleEntityType(type)}
                      className={cn(
                        "w-full flex items-center gap-2 rounded px-2 py-1 text-xs text-left transition-colors",
                        isChecked
                          ? "bg-surface-2 text-text-primary"
                          : "text-text-disabled hover:bg-surface-1",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="capitalize">{type.toLowerCase()}</span>
                      <span className="ml-auto font-mono text-micro text-text-muted">
                        {isChecked ? "ON" : "OFF"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Search Jump Autocomplete */}
      <div className="relative pointer-events-auto shrink-0 mr-1 sm:mr-1.5">
        <div className="flex items-center gap-1 rounded-md border border-border-strong bg-surface-1/95 px-1.5 py-1 backdrop-blur shadow-panel">
          <Search className="h-3 w-3 text-text-muted shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
            placeholder="Search clues..."
            className="w-14 sm:w-16 focus:w-24 transition-all bg-transparent text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="text-text-muted hover:text-text-primary text-xs"
            >
              &times;
            </button>
          )}
        </div>

        {searchFocused && filteredSearchResults.length > 0 && (
          <div className="absolute right-0 top-full mt-1 w-56 rounded-md border border-border-strong bg-surface-raised p-1 shadow-panel z-50">
            {filteredSearchResults.map((n) => (
              <button
                key={n.id}
                type="button"
                className="w-full flex items-center justify-between rounded px-2 py-1.5 text-xs text-left hover:bg-surface-2 transition-colors"
                onMouseDown={() => {
                  selectNode(n.id);
                  setSearchTerm("");
                }}
              >
                <span className="font-medium text-text-primary truncate">
                  {n.entityType === "PERSON"
                    ? maskPersonName(n.maskedLabel || n.label)
                    : maskSensitiveText(n.maskedLabel || n.label)}
                </span>
                <span className="text-micro font-mono text-text-muted ml-2 shrink-0">
                  {n.entityType}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
