import { Link, useRouterState } from "@tanstack/react-router";

import { Logo } from "@/components/brand/Logo";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuthStore } from "@/features/auth/auth-store";
import { cn } from "@/lib/utils";

import { isNavItemActive, navSections } from "./nav-config";

interface SidebarContentProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function SidebarContent({
  collapsed = false,
  onNavigate,
}: SidebarContentProps) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const role = useAuthStore((state) => state.user?.role ?? null);

  const visibleSections = role
    ? navSections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => item.roles.includes(role)),
        }))
        .filter((section) => section.items.length > 0)
    : [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-sidebar-border",
          collapsed ? "justify-center px-2" : "px-4",
        )}
      >
        <Logo collapsed={collapsed} showTagline={!collapsed} />
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {visibleSections.map((section, sectionIndex) => (
          <div
            key={section.label}
            className={cn(sectionIndex > 0 && "mt-4", "last:mb-0")}
          >
            {collapsed ? (
              sectionIndex > 0 ? (
                <div className="mx-auto mb-3 h-px w-7 bg-sidebar-border" />
              ) : null
            ) : (
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                {section.label}
              </p>
            )}

            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isNavItemActive(pathname, item.to);
                const Icon = item.icon;

                const link = (
                  <Link
                    to={item.to}
                    onClick={onNavigate}
                    className={cn(
                      "group relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                      collapsed && "justify-center px-0",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    {active ? (
                      <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-sidebar-primary" />
                    ) : null}
                    <Icon
                      className={cn(
                        "size-[18px] shrink-0",
                        active
                          ? "text-sidebar-primary"
                          : "text-muted-foreground group-hover:text-sidebar-accent-foreground",
                      )}
                    />
                    {!collapsed ? (
                      <span className="truncate">{item.title}</span>
                    ) : null}
                  </Link>
                );

                return (
                  <li key={item.to}>
                    {collapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right" sideOffset={10}>
                          {item.title}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border p-3">
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-lg bg-sidebar-accent/60 px-3 py-2",
            collapsed && "justify-center px-0",
          )}
        >
          <span className="relative flex size-2.5 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
          </span>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-sidebar-foreground">
                Offline siap
              </p>
              <p className="truncate text-[10px] text-muted-foreground">
                Data lokal · v{__APP_VERSION__}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
