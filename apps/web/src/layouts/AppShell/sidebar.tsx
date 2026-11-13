import { NavLink, useMatch } from "react-router-dom";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronsLeft, ChevronsRight, Compass, UserRound, X } from "lucide-react";
import { NAV_GROUPS, NAV_ITEMS, type NavItem } from "@/constants/navigation";
import { useUIStore } from "@/stores/uiStore";
import { useAuthStore } from "@/stores/authStore";
import { can, roleLabel } from "@/lib/permissions";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function itemClass(isActive: boolean, collapsed: boolean) {
  return cn(
    "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5fc4bd]",
    collapsed && "justify-center",
    isActive ? "bg-white/12 text-white font-semibold shadow-[inset_3px_0_0_#5fc4bd]" : "text-[#c5d4de] hover:bg-white/8 hover:text-white",
  );
}

/**
 * A link, with its name in a tooltip when only the icon is visible (shown on hover and on keyboard focus).
 * The class is a plain string computed from useMatch, not NavLink's className function: TooltipTrigger asChild merges
 * className as strings, which dropped the function and left collapsed icons dark-on-dark (caught in P2.2's screenshot).
 * NavLink still sets aria-current="page" itself, with the same matching rule (prefix match, as NavLink's default).
 */
function NavEntry({ to, label, hint, icon: Icon, collapsed, onNavigate, children }: {
  to: string; label: string; hint?: string; icon: NavItem["icon"]; collapsed: boolean; onNavigate?: () => void; children?: React.ReactNode;
}) {
  const active = useMatch({ path: to, end: false }) !== null;
  const link = (
    <NavLink to={to} onClick={onNavigate} className={itemClass(active, collapsed)}>
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {collapsed ? <span className="sr-only">{label}</span> : (children ?? <span className="truncate">{label}</span>)}
    </NavLink>
  );
  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right"><span className="font-medium">{label}</span>{hint && <span className="block text-text-secondary">{hint}</span>}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Global navigation (P2.2).
 * - Sections: Workspace (everyone), Oversight and Administration (only what the role may open; a section with nothing
 *   to show is hidden). Account is at the bottom. The server still authorizes every page.
 * - ≥1024px: a column that collapses to icons; the choice is remembered (uiStore). Collapsed icons name themselves in a
 *   tooltip on hover and on keyboard focus.
 * - <1024px: a drawer opened from the top bar's menu button. It is a real modal dialog (Radix): focus moves into it and
 *   stays there, Esc, the close button or the backdrop close it, focus returns to the menu button, and following a link
 *   closes it.
 */
export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, mobileNavOpen, setMobileNavOpen } = useUIStore();
  const { user } = useAuthStore();
  const visible = NAV_ITEMS.filter((i) => !i.requires || can(user?.role, i.requires));
  const groups = NAV_GROUPS.map((g) => ({ ...g, items: visible.filter((i) => i.group === g.id) })).filter((g) => g.items.length > 0);
  const close = () => setMobileNavOpen(false);

  const body = (collapsed: boolean, mobile: boolean) => (
    <>
      <div className="flex h-14 items-center gap-2.5 px-3 shrink-0 border-b border-white/10">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#21706e] bg-gradient-to-br from-[#2b8f8b] to-[#1b5e5c] text-white shadow-[0_2px_6px_rgba(0,0,0,0.25)] shrink-0">
          <Compass className="h-5 w-5" aria-hidden="true" />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-white leading-none tracking-wide">DRISTI&#8209;NET</span>
            <span className="block text-xs text-[#9fb4c3] mt-0.5 truncate">Case evidence review</span>
          </div>
        )}
        {mobile && (
          <DialogPrimitive.Close aria-label="Close navigation"
            className="rounded-md p-1.5 text-[#c5d4de] hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5fc4bd]">
            <X className="h-4 w-4" aria-hidden="true" />
          </DialogPrimitive.Close>
        )}
      </div>
      <nav aria-label="Main" className="flex-1 overflow-y-auto p-2">
        {groups.map((g, gi) => (
          <div key={g.id} data-nav-group={g.id} role="group" aria-labelledby={`nav-group-${g.id}${mobile ? "-m" : ""}`}
            className={cn(gi > 0 && (collapsed ? "mt-2 border-t border-white/10 pt-2" : "mt-3"))}>
            <p id={`nav-group-${g.id}${mobile ? "-m" : ""}`}
              className={collapsed ? "sr-only" : "px-2.5 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-[#8fa6b6]"}>
              {g.label}
            </p>
            <ul className="flex flex-col gap-0.5">
              {g.items.map((item) => (
                <li key={item.path}>
                  <NavEntry to={item.path} label={item.label} hint={item.description} icon={item.icon} collapsed={collapsed}
                    onNavigate={mobile ? close : undefined} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 p-2 shrink-0 space-y-1">
        {user && (
          <NavEntry to="/profile" label="Account" hint={`${user.display_name} · ${roleLabel(user.role)}`} icon={UserRound}
            collapsed={collapsed} onNavigate={mobile ? close : undefined}>
            <span className="min-w-0 text-left">
              <span className="block truncate text-sm">Account</span>
              <span className="block truncate text-xs text-[#9fb4c3] font-normal">{roleLabel(user.role)}</span>
            </span>
          </NavEntry>
        )}
        {!mobile && (
          <button type="button" onClick={toggleSidebar}
            className={cn("flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs text-[#9fb4c3] hover:bg-white/8 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5fc4bd]", collapsed && "justify-center")}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} aria-expanded={!collapsed} aria-controls="app-sidebar">
            {collapsed ? <ChevronsRight className="h-4 w-4" aria-hidden="true" /> : <><ChevronsLeft className="h-4 w-4" aria-hidden="true" /><span>Collapse</span></>}
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
      <aside id="app-sidebar" className={cn("hidden lg:flex h-full flex-col bg-[#0f2a3d] shrink-0 transition-[width] duration-[var(--motion-base)]",
        sidebarCollapsed ? "w-14" : "w-56")}>
        {body(sidebarCollapsed, false)}
      </aside>
      <DialogPrimitive.Root open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="lg:hidden fixed inset-0 z-40 bg-black/40" />
          <DialogPrimitive.Content id="mobile-nav" data-nav-drawer aria-label="Navigation" aria-describedby={undefined}
            // Always hand focus back to the menu button. Radix restores the element focused before opening, which after a
            // tap on a touch screen is <body> (a tap does not focus the button), leaving keyboard users nowhere.
            onCloseAutoFocus={(e) => { const t = document.getElementById("mobile-nav-trigger"); if (t && t.offsetParent !== null) { e.preventDefault(); t.focus(); } }}
            className="lg:hidden fixed inset-y-0 left-0 z-40 flex w-64 max-w-[85vw] flex-col bg-[#0f2a3d] shadow-drawer focus:outline-none">
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            {body(false, true)}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
