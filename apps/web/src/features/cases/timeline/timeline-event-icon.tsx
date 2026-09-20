import {
  PhoneCall,
  Landmark,
  Footprints,
  AlertTriangle,
  Radio,
  Cpu,
  AlertOctagon,
  Scale,
} from "lucide-react";
import type { TimelineEventType } from "@/types/timeline";
import { cn } from "@/lib/utils";

interface TimelineEventIconProps {
  type: TimelineEventType;
  hasContradiction?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function TimelineEventIcon({
  type,
  hasContradiction,
  className,
  size = "md",
}: TimelineEventIconProps) {
  if (hasContradiction || type === "CONTRADICTION_FLAGGED") {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-full border border-critical-red/40 bg-critical-red/15 text-critical-red shrink-0 shadow-sm",
          size === "sm" && "h-6 w-6",
          size === "md" && "h-8 w-8",
          size === "lg" && "h-10 w-10",
          className,
        )}
        title="Contradiction Flagged"
      >
        <AlertOctagon className={cn(size === "sm" ? "h-3 w-3" : size === "md" ? "h-4 w-4" : "h-5 w-5")} />
      </div>
    );
  }

  const iconMap: Record<
    TimelineEventType,
    { icon: typeof PhoneCall; colors: string; label: string }
  > = {
    COMMUNICATION: {
      icon: PhoneCall,
      colors: "border-blue-500/40 bg-blue-500/15 text-blue-400",
      label: "Communication",
    },
    FINANCIAL_TRANSACTION: {
      icon: Landmark,
      colors: "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
      label: "Financial Transaction",
    },
    PHYSICAL_MOVEMENT: {
      icon: Footprints,
      colors: "border-amber-500/40 bg-amber-500/15 text-amber-400",
      label: "Physical Movement / Sightings",
    },
    INCIDENT: {
      icon: AlertTriangle,
      colors: "border-rose-500/40 bg-rose-500/15 text-rose-400",
      label: "Incident",
    },
    SURVEILLANCE: {
      icon: Radio,
      colors: "border-purple-500/40 bg-purple-500/15 text-purple-400",
      label: "Surveillance / Intercept",
    },
    FORENSIC_INGESTION: {
      icon: Cpu,
      colors: "border-cyan-500/40 bg-cyan-500/15 text-cyan-400",
      label: "Forensic Extraction / Hardware Bind",
    },
    CONTRADICTION_FLAGGED: {
      icon: AlertOctagon,
      colors: "border-critical-red/40 bg-critical-red/15 text-critical-red",
      label: "Contradiction Flagged",
    },
    PROCEDURAL_ACTION: {
      icon: Scale,
      colors: "border-slate-500/40 bg-slate-500/15 text-slate-300",
      label: "Procedural Action / Statutory Order",
    },
  };

  const config = iconMap[type] || iconMap.PROCEDURAL_ACTION;
  const IconComponent = config.icon;

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full border shrink-0 shadow-sm transition-transform",
        config.colors,
        size === "sm" && "h-6 w-6",
        size === "md" && "h-8 w-8",
        size === "lg" && "h-10 w-10",
        className,
      )}
      title={config.label}
    >
      <IconComponent className={cn(size === "sm" ? "h-3 w-3" : size === "md" ? "h-4 w-4" : "h-5 w-5")} />
    </div>
  );
}
