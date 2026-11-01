import { NavLink, useNavigate } from "react-router-dom";
import { ChevronsLeft, ChevronsRight, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PRIMARY_NAV_ITEMS, SYSTEM_NAV_ITEMS, type NavItem } from "@/constants/navigation";
import { useUIStore } from "@/stores/uiStore";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";

function NavItemLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const Icon = item.icon;

  const content = (
    <NavLink
      to={item.path}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors duration-[var(--motion-fast)]",
          isActive
            ? "bg-electric-blue/10 text-electric-blue font-semibold"
            : "text-text-secondary hover:bg-surface-2 hover:text-text-primary",
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  );

  return (
    <li>
      <Tooltip>
        <TooltipTrigger asChild>
          <div>{content}</div>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          <p className="font-semibold text-text-primary">{item.label}</p>
          <p className="text-micro text-text-secondary">{item.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </li>
  );
}

function ProfileButton({ collapsed }: { collapsed: boolean }) {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  if (!user) return null;

  const initials = user.display_name
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase();

  const button = (
    <button
      onClick={() => navigate("/profile")}
      className={cn(
        "w-full flex items-center gap-2.5 rounded-md px-2 py-2 transition-colors duration-[var(--motion-fast)]",
        "text-text-secondary hover:bg-surface-2 hover:text-text-primary",
        "[&.active]:bg-electric-blue/10 [&.active]:text-electric-blue"
      )}
      aria-label="View profile"
    >
      {/* Avatar circle */}
      <div className="h-7 w-7 rounded-full bg-electric-blue/20 border border-electric-blue/30 flex items-center justify-center shrink-0">
        <span className="font-mono text-[10px] font-bold text-electric-blue">{initials}</span>
      </div>
      {!collapsed && (
        <div className="flex-1 min-w-0 text-left">
          <p className="text-xs font-semibold text-text-primary truncate leading-tight">
            {user.display_name}
          </p>
          <p className="text-[10px] text-text-muted font-mono truncate leading-tight">
            {user.role}
          </p>
        </div>
      )}
    </button>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          <p className="font-semibold text-text-primary">{user.display_name}</p>
          <p className="text-micro text-text-secondary">{user.role} · {user.jurisdiction}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
}

function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const { user } = useAuthStore();

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border-subtle bg-surface-1 transition-[width] duration-[var(--motion-base)] ease-[var(--motion-ease)] select-none",
        sidebarCollapsed ? "w-14" : "w-60",
      )}
    >
      {/* Brand Header */}
      <div className="flex h-14 items-center gap-2.5 px-4 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-electric-blue/10 text-electric-blue shrink-0">
          <Compass className="h-5 w-5" aria-hidden="true" />
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <span className="text-sm font-bold tracking-tight text-text-primary block leading-none">
              DRISTI&#8209;NET
            </span>
            <span className="text-[10.5px] text-text-muted font-medium block mt-0.5 truncate">
              Investigation Platform
            </span>
          </div>
        )}
      </div>

      <Separator />

      {/* Navigation list */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-4">
        <div className="px-2">
          {!sidebarCollapsed && (
            <div className="px-2 pb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-text-muted">
              Investigation
            </div>
          )}
          <ul className="flex flex-col gap-0.5">
            {PRIMARY_NAV_ITEMS.map((item) => (
              <NavItemLink key={item.path} item={item} collapsed={sidebarCollapsed} />
            ))}
          </ul>
        </div>

        {/* Role-filtered system items */}
        {SYSTEM_NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(user?.role || "")).length > 0 && (
          <>
            <Separator />
            <div className="px-2">
              {!sidebarCollapsed && (
                <div className="px-2 pb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-text-muted">
                  System
                </div>
              )}
              <ul className="flex flex-col gap-0.5">
                {SYSTEM_NAV_ITEMS
                  .filter((item) => !item.roles || item.roles.includes(user?.role || ""))
                  .map((item) => (
                    <NavItemLink key={item.path} item={item} collapsed={sidebarCollapsed} />
                  ))}
              </ul>
            </div>
          </>
        )}
      </nav>

      <Separator />

      {/* Profile button */}
      <div className="px-2 py-2 shrink-0">
        <ProfileButton collapsed={sidebarCollapsed} />
      </div>

      <Separator />

      {/* Collapse Footer */}
      <div className="p-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center text-xs text-text-secondary hover:text-text-primary"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
        >
          {sidebarCollapsed ? (
            <ChevronsRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronsLeft className="h-4 w-4" />
              <span>Collapse Menu</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}

export { Sidebar };
