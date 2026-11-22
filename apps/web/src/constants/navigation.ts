import { Briefcase, FolderOpen, Home, Inbox, ScrollText, ShieldCheck, Users } from "lucide-react";
import type { Capability } from "@/lib/permissions";

export type NavGroupId = "workspace" | "oversight" | "administration";

export interface NavItem {
  label: string;
  path: string;
  icon: typeof Home;
  description: string;
  group: NavGroupId;
  /** Shown only to roles with this capability (UI convenience; the backend enforces it). */
  requires?: Capability;
}

/** Sidebar sections, in display order. A section with no item the user may open is not shown. */
export const NAV_GROUPS: { id: NavGroupId; label: string }[] = [
  { id: "workspace", label: "Workspace" },
  { id: "oversight", label: "Oversight" },
  { id: "administration", label: "Administration" },
];

/**
 * Global navigation (P2.2: grouped). Only implemented pages; everything about one case lives in the case tabs, and the
 * account page is at the bottom of the sidebar. Every path here is a route in app/router/router.tsx
 * (scripts/reliability/verify_sidebar.mjs opens each one for each role).
 */
export const NAV_ITEMS: NavItem[] = [
  { label: "Home", path: "/command-center", icon: Home, group: "workspace", description: "Your cases and work waiting for you" },
  { label: "Cases", path: "/cases", icon: FolderOpen, group: "workspace", description: "All cases you may open" },
  { label: "Requests", path: "/requests", icon: Inbox, group: "workspace", description: "Ask an administrator for access, a role change or support, and follow its progress" },
  { label: "Audit log", path: "/audit", icon: ScrollText, group: "oversight", description: "Audit events across all cases", requires: "globalAudit" },
  { label: "Users", path: "/admin/users", icon: Users, group: "administration", description: "Create, update and deactivate accounts", requires: "manageUsers" },
  { label: "Case assignments", path: "/admin/case-assignments", icon: Briefcase, group: "administration", description: "Who is on each case: assign, remove and hand over investigators", requires: "viewCaseAssignments" },
  { label: "Permission overrides", path: "/admin/overrides", icon: ShieldCheck, group: "administration", description: "Review and manage time-limited permission exceptions", requires: "viewOverrides" },
];
