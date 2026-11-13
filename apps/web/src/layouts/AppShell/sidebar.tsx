import { NavLink } from "react-router-dom";
import { ChevronsLeft, ChevronsRight, Compass, UserRound, X } from "lucide-react";
import { NAV_ITEMS } from "@/constants/navigation";
import { useUIStore } from "@/stores/uiStore";
import { useAuthStore } from "@/stores/authStore";
import { can, roleLabel } from "@/lib/permissions";
import { cn } from "@/lib/utils";

function itemClass(isActive: boolean, collapsed: boolean) {
  return cn(
    "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
    collapsed && "justify-center",
    isActive ? "bg-white/12 text-white font-semibold shadow-[inset_3px_0_0_#5fc4bd]" : "text-[#c5d4de] hover:bg-white/8 hover:text-white",
  );
}

/**
 * Global navigation: Home, Cases, Audit log (auditor/admin), Account.
 * ≥1024px: fixed column that can collapse to icons. <1024px: overlay drawer opened from the top bar menu button.
 */
export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, mobileNavOpen, setMobileNavOpen } = useUIStore();
  const { user } = useAuthStore();
  const items = NAV_ITEMS.filter((i) => !i.requires || can(user?.role, i.requires));
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
          <button type="button" onClick={close} aria-label="Close navigation" className="rounded-md p-1.5 text-[#c5d4de] hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <nav aria-label="Main" className="flex-1 overflow-y-auto p-2">
        {!collapsed && <p className="px-2.5 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-[#8fa6b6]">Workspace</p>}
        <ul className="flex flex-col gap-0.5">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.path}>
                <NavLink to={item.path} onClick={mobile ? close : undefined} title={collapsed ? `${item.label} — ${item.description}` : undefined}
                  className={({ isActive }) => itemClass(isActive, collapsed)}>
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-white/10 p-2 shrink-0 space-y-1">
        {user && (
          <NavLink to="/profile" onClick={mobile ? close : undefined} title={collapsed ? `Account — ${user.display_name}` : undefined}
            className={({ isActive }) => itemClass(isActive, collapsed)}>
            <UserRound className="h-4 w-4 shrink-0" aria-hidden="true" />
            {collapsed ? <span className="sr-only">Account</span> : (
              <span className="min-w-0 text-left">
                <span className="block truncate text-sm">Account</span>
                <span className="block truncate text-xs text-[#9fb4c3] font-normal">{roleLabel(user.role)}</span>
              </span>
            )}
          </NavLink>
        )}
        {!mobile && (
          <button type="button" onClick={toggleSidebar}
            className={cn("flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs text-[#9fb4c3] hover:bg-white/8 hover:text-white", collapsed && "justify-center")}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} aria-expanded={!collapsed}>
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /><span>Collapse</span></>}
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
      <aside className={cn("hidden lg:flex h-full flex-col bg-[#0f2a3d] shrink-0 transition-[width] duration-[var(--motion-base)]",
        sidebarCollapsed ? "w-14" : "w-56")}>
        {body(sidebarCollapsed, false)}
      </aside>
      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-black/40" onClick={close} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 flex w-64 max-w-[85vw] flex-col bg-[#0f2a3d] shadow-drawer">
            {body(false, true)}
          </aside>
        </div>
      )}
    </>
  );
}
