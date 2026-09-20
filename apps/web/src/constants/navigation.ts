import {
  Home,
  FileStack,
  Network,
  FileCheck2,
  Clock,
  AlertCircle,
  FileText,
  CheckSquare,
  ShieldCheck,
  Settings,
} from "lucide-react";

export interface NavItem {
  label: string;
  path: string;
  icon: typeof Home;
  tooltip: string;
  section?: "primary" | "system";
}

/**
 * Primary navigation for DRISTI-NET.
 * Plain-language labels designed for intuitive non-technical understanding.
 */
export const PRIMARY_NAV_ITEMS: NavItem[] = [
  { label: "Home", path: "/command-center", icon: Home, tooltip: "Overview, case introduction & guide" },
  { label: "Cases", path: "/cases", icon: FileStack, tooltip: "View all active investigations" },
  { label: "Investigation Map", path: "/graph", icon: Network, tooltip: "Visual map of connected clues & people" },
  { label: "Evidence", path: "/evidence", icon: FileCheck2, tooltip: "Original case documents and verified proof" },
  { label: "Timeline", path: "/timeline", icon: Clock, tooltip: "Chronological story of case events" },
  { label: "Alerts", path: "/alerts", icon: AlertCircle, tooltip: "Items needing investigator attention" },
  { label: "Reports", path: "/reports", icon: FileText, tooltip: "Case summary and official dossier" },
];

export const SYSTEM_NAV_ITEMS: NavItem[] = [
  { label: "Review", path: "/hitl", icon: CheckSquare, tooltip: "Analyst review & contradiction sign-off" },
  { label: "Audit", path: "/audit", icon: ShieldCheck, tooltip: "Tamper-evident activity & access log" },
  { label: "Settings", path: "/settings", icon: Settings, tooltip: "Preferences and security settings" },
];

export const ALL_NAV_ITEMS: NavItem[] = [...PRIMARY_NAV_ITEMS, ...SYSTEM_NAV_ITEMS];

