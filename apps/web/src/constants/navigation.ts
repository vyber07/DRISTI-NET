import { Home, FileStack, ShieldCheck } from "lucide-react";

export interface NavItem {
  label: string;
  path: string;
  icon: typeof Home;
  tooltip: string;
  section?: "primary" | "system";
  roles?: string[]; // if set, only show for these roles
}

export const PRIMARY_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",      path: "/command-center", icon: Home,       tooltip: "Overview & active cases" },
  { label: "Case Directory", path: "/cases",           icon: FileStack,  tooltip: "View all active investigations" },
];

export const SYSTEM_NAV_ITEMS: NavItem[] = [
  {
    label: "Audit Trail",
    path: "/audit",
    icon: ShieldCheck,
    tooltip: "Global tamper-evident audit log",
    roles: ["AUDITOR", "ADMIN"],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = [...PRIMARY_NAV_ITEMS, ...SYSTEM_NAV_ITEMS];
