import { useGraphStore } from "@/stores/graphStore";
import { cn } from "@/lib/utils";

const CONFIDENCE_PRESETS = [
  { label: "All", value: 0 },
  { label: "≥ 50%", value: 0.5 },
  { label: "≥ 75%", value: 0.75 },
  { label: "≥ 90%", value: 0.9 },
];

export function ConfidenceRangeFilter() {
  const {  minConfidence, setMinConfidence, nodes, edges } = useGraphStore();

  const passingNodes = nodes.filter(
    (n) => (1) >= minConfidence,
  ).length;
  const passingEdges = edges.filter(
    (e) => (e.minConfidence ?? 1) >= minConfidence,
  ).length;

  const percentage = Math.round(minConfidence * 100);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-micro font-semibold uppercase tracking-wider text-text-muted">
          Min. Algorithmic Confidence
        </span>
        <span className="font-mono text-xs font-semibold text-electric-blue-soft">
          {percentage}% ({minConfidence.toFixed(2)})
        </span>
      </div>

      {/* Slider */}
      <div className="space-y-1">
        <input
          id="confidence-range-slider"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={minConfidence}
          onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
          aria-label="Minimum algorithmic confidence threshold"
          className="w-full h-1.5 bg-surface-3 rounded-lg appearance-none cursor-pointer accent-electric-blue"
        />
        <div className="flex justify-between text-micro font-mono text-text-muted">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Quick Presets */}
      <div className="flex items-center gap-1">
        {CONFIDENCE_PRESETS.map((preset) => {
          const isSelected = Math.abs(minConfidence - preset.value) < 0.01;
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => setMinConfidence(preset.value)}
              className={cn(
                "flex-1 py-1 text-micro font-mono font-medium rounded border transition-colors",
                isSelected
                  ? "bg-electric-blue/20 border-electric-blue text-electric-blue-soft font-semibold"
                  : "bg-surface-2 border-border-subtle text-text-muted hover:text-text-primary hover:border-border-strong",
              )}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* Threshold pass summary */}
      <div className="flex items-center justify-between text-micro font-mono text-text-muted pt-0.5 border-t border-border-subtle/50">
        <span>Nodes passing:</span>
        <span className="text-text-secondary">
          {passingNodes} / {nodes.length}
        </span>
      </div>
      <div className="flex items-center justify-between text-micro font-mono text-text-muted">
        <span>Edges passing:</span>
        <span className="text-text-secondary">
          {passingEdges} / {edges.length}
        </span>
      </div>
    </div>
  );
}
