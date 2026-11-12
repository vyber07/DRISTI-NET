import { Briefcase, FolderOpen, Home, Inbox, ScrollText, ShieldCheck, Users } from "lucide-react";
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
  { label: "Requests", path: "/requests", icon: Inbox, description: "Ask an administrator for access, a role change or support, and follow its progress" },
  { label: "Audit log", path: "/audit", icon: ScrollText, description: "Audit events across all cases", requires: "globalAudit" },
  { label: "Users", path: "/admin/users", icon: Users, description: "Create, update and deactivate accounts", requires: "manageUsers" },
  { label: "Case assignments", path: "/admin/case-assignments", icon: Briefcase, description: "Who is on each case: assign, remove and hand over investigators", requires: "viewCaseAssignments" },
  { label: "Permission overrides", path: "/admin/overrides", icon: ShieldCheck, description: "Review and manage time-limited permission exceptions", requires: "viewOverrides" },
];
