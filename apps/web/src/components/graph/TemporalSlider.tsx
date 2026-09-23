import { useEffect } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Clock,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useGraphStore } from "@/stores/graphStore";
import { cn } from "@/lib/utils";
import { formatCompactTimestamp, formatDateOnly } from "@/lib/formatters";

export function TemporalSlider({ className }: { className?: string }) {
  const { 
    minTimestamp,
    maxTimestamp,
    currentTimestamp,
    isPlaying,
    setCurrentTimestamp,
    togglePlay,
    stepTemporal,
    edges,
  } = useGraphStore();

  // Animation loop when isPlaying is true
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      const {  minTimestamp, maxTimestamp, currentTimestamp } = useGraphStore.getState();
      const step = (maxTimestamp - minTimestamp) / 80;
      let next = currentTimestamp + step;
      if (next >= maxTimestamp) {
        next = minTimestamp;
      }
      setCurrentTimestamp(next);
    }, 150);

    return () => clearInterval(interval);
  }, [isPlaying, setCurrentTimestamp]);

  const progressPercent = maxTimestamp > minTimestamp
    ? Math.min(100, Math.max(0, ((currentTimestamp - minTimestamp) / (maxTimestamp - minTimestamp)) * 100))
    : 100;

  const activeEdgeCount = edges.filter((e) => {
    const t = new Date(e.firstSeen || e.lastSeen || 0).getTime();
    return isNaN(t) || t <= currentTimestamp;
  }).length;

  return (
    <div
      data-testid="temporal-slider"
      className={cn(
        "flex h-12 items-center justify-between gap-2.5 sm:gap-4 px-3 sm:px-4 bg-surface-1 border-t border-border-subtle max-w-full min-w-0 overflow-hidden select-none",
        className,
      )}
    >
      {/* Playback Controls */}
      <div className="flex items-center gap-1 shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-text-secondary hover:text-text-primary"
              onClick={() => setCurrentTimestamp(minTimestamp)}
              aria-label="Reset to start"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Reset to Timeline Start</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-text-secondary hover:text-text-primary"
              onClick={() => stepTemporal(-1)}
              aria-label="Step backward"
            >
              <SkipBack className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Step Backward</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isPlaying ? "primary" : "secondary"}
              size="sm"
              className={cn("h-8 px-2.5 text-xs font-medium gap-1.5")}
              onClick={togglePlay}
            >
              {isPlaying ? (
                <>
                  <Pause className="h-3.5 w-3.5" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  <span>Play</span>
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {isPlaying ? "Pause Timeline Progression" : "Animate Case Progression"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-text-secondary hover:text-text-primary"
              onClick={() => stepTemporal(1)}
              aria-label="Step forward"
            >
              <SkipForward className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Step Forward</TooltipContent>
        </Tooltip>
      </div>

      {/* Scrubber track */}
      <div className="flex flex-1 items-center gap-3 min-w-0">
        <span className="text-micro font-mono text-text-muted shrink-0 hidden sm:inline">
          {formatDateOnly(minTimestamp)}
        </span>

        <div className="relative flex-1 flex items-center py-2 group">
          <input
            type="range"
            min={minTimestamp}
            max={maxTimestamp}
            step={(maxTimestamp - minTimestamp) / 100}
            value={currentTimestamp}
            onChange={(e) => setCurrentTimestamp(Number(e.target.value))}
            aria-label="Temporal scrubber"
            className="w-full h-1.5 bg-surface-3 rounded-pill appearance-none cursor-pointer accent-electric-blue"
          />

          {/* Progress fill */}
          <div
            className="absolute left-0 h-1.5 rounded-pill bg-electric-blue pointer-events-none"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <span className="text-micro font-mono text-text-muted shrink-0 hidden sm:inline">
          {formatDateOnly(maxTimestamp)}
        </span>
      </div>

      {/* Current timestamp and stats readout */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="flex items-center gap-1.5 rounded bg-surface-2 px-2 py-1 border border-border-subtle shrink-0">
          <Clock className="h-3.5 w-3.5 text-electric-blue-soft shrink-0" />
          <span className="text-xs font-mono font-medium text-text-primary whitespace-nowrap">
            {formatCompactTimestamp(currentTimestamp)}
          </span>
        </div>

        <div className="text-micro font-mono text-text-muted shrink-0 whitespace-nowrap hidden sm:block">
          Active: <span className="text-text-primary font-semibold">{activeEdgeCount}</span>/{edges.length} edges
        </div>
      </div>
    </div>
  );
}
