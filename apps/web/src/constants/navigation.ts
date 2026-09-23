import {
  Home,
  FileStack,
  Settings,
} from "lucide-react";

export interface NavItem {
  label: string;
  path: string;
  icon: typeof Home;
  tooltip: string;
  section?: "primary" | "system";
}

export const PRIMARY_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", path: "/command-center", icon: Home, tooltip: "Overview & active cases" },
  { label: "Case Directory", path: "/cases", icon: FileStack, tooltip: "View all active investigations" },
];

export const SYSTEM_NAV_ITEMS: NavItem[] = [
  { label: "Settings", path: "/settings", icon: Settings, tooltip: "Preferences and security settings" },
];

export const ALL_NAV_ITEMS: NavItem[] = [...PRIMARY_NAV_ITEMS, ...SYSTEM_NAV_ITEMS];
