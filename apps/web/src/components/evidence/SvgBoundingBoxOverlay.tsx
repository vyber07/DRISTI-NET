import type { BoundingBox } from "@/types/entity";
import { maskPhoneNumbersInText } from "@/lib/pii";
import { cn } from "@/lib/utils";

interface SvgBoundingBoxOverlayProps {
  boundingBoxes: BoundingBox[];
  selectedBoxId?: string | null;
  onSelectBox?: (boxId: string) => void;
  className?: string;
}

export function SvgBoundingBoxOverlay({
  boundingBoxes,
  selectedBoxId,
  onSelectBox,
  className,
}: SvgBoundingBoxOverlayProps) {
  if (boundingBoxes.length === 0) return null;

  return (
    <svg
      className={cn(
        "absolute inset-0 h-full w-full pointer-events-none select-none overflow-visible",
        className,
      )}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <defs>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.8" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {boundingBoxes.map((box) => {
        const isSelected = selectedBoxId === box.id;
        const cornerSize = 1.2;

        return (
          <g
            key={box.id}
            className="pointer-events-auto cursor-pointer group"
            onClick={() => onSelectBox?.(box.id)}
          >
            {/* Main Highlight Rectangle */}
            <rect
              x={box.x}
              y={box.y}
              width={box.width}
              height={box.height}
              fill={isSelected ? "rgba(59, 130, 246, 0.09)" : "rgba(245, 158, 11, 0.06)"}
              stroke={isSelected ? "#3b82f6" : "#f59e0b"}
              strokeWidth={isSelected ? "0.6" : "0.4"}
              strokeDasharray={isSelected ? "none" : "1.5 1"}
              filter="url(#glow)"
              className="transition-colors duration-200"
            />

            {/* Corner Crosshairs */}
            {/* Top-Left */}
            <path
              d={`M ${box.x} ${box.y + cornerSize} L ${box.x} ${box.y} L ${box.x + cornerSize} ${box.y}`}
              fill="none"
              stroke="#60a5fa"
              strokeWidth="0.8"
            />
            {/* Top-Right */}
            <path
              d={`M ${box.x + box.width - cornerSize} ${box.y} L ${box.x + box.width} ${box.y} L ${box.x + box.width} ${box.y + cornerSize}`}
              fill="none"
              stroke="#60a5fa"
              strokeWidth="0.8"
            />
            {/* Bottom-Left */}
            <path
              d={`M ${box.x} ${box.y + box.height - cornerSize} L ${box.x} ${box.y + box.height} L ${box.x + cornerSize} ${box.y + box.height}`}
              fill="none"
              stroke="#60a5fa"
              strokeWidth="0.8"
            />
            {/* Bottom-Right */}
            <path
              d={`M ${box.x + box.width - cornerSize} ${box.y + box.height} L ${box.x + box.width} ${box.y + box.height} L ${box.x + box.width} ${box.y + box.height - cornerSize}`}
              fill="none"
              stroke="#60a5fa"
              strokeWidth="0.8"
            />

            {/* Intelligently Positioned Label Tag (strictly outside the highlighted evidence area) */}
            {(() => {
              const labelText = `${maskPhoneNumbersInText(box.label)} • ${Math.round(box.confidence * 100)}%`;
              const tagWidth = Math.max(14, Math.min(38, labelText.length * 0.72 + 2.4));
              const tagHeight = 2.4;

              // If there is clearance above, place above; otherwise place below the box
              const tagY = box.y >= tagHeight + 0.8
                ? box.y - tagHeight - 0.4
                : Math.min(96, box.y + box.height + 0.6);

              // Prevent horizontal edge overflow
              let tagX = box.x;
              if (tagX + tagWidth > 98) {
                tagX = Math.max(1, box.x + box.width - tagWidth);
              }
              if (tagX + tagWidth > 98) {
                tagX = 98 - tagWidth;
              }
              tagX = Math.max(1, tagX);

              return (
                <g transform={`translate(${tagX}, ${tagY})`}>
                  <rect
                    x="0"
                    y="0"
                    width={tagWidth}
                    height={tagHeight}
                    rx="0.4"
                    fill="#0b1118"
                    fillOpacity="0.95"
                    stroke={isSelected ? "#3b82f6" : "#475569"}
                    strokeWidth="0.25"
                  />
                  <text
                    x="1.0"
                    y="1.65"
                    fill="#f1f5f9"
                    fontSize="1.3"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight="600"
                  >
                    {labelText}
                  </text>
                </g>
              );
            })()}
          </g>
        );
      })}
    </svg>
  );
}
