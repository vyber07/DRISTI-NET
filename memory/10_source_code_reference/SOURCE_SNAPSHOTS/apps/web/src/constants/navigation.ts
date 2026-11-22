import { FolderOpen, Home, ScrollText, Users } from "lucide-react";
import type { Capability } from "@/lib/permissions";

export interface NavItem {
  label: string;
  path: string;
  icon: typeof Home;
  description: string;
  /** Shown only to roles with this capability (UI convenience; the backend enforces it). */
  requires?: Capability;
}

/** Global navigation. Everything about one case lives in the case tabs, not here. */
export const NAV_ITEMS: NavItem[] = [
  { label: "Home", path: "/command-center", icon: Home, description: "Your cases and work waiting for you" },
  { label: "Cases", path: "/cases", icon: FolderOpen, description: "All cases you may open" },
  { label: "Audit log", path: "/audit", icon: ScrollText, description: "Audit events across all cases", requires: "globalAudit" },
  { label: "Users", path: "/admin/users", icon: Users, description: "Create, update and deactivate accounts", requires: "manageUsers" },
];
