import { useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import {
  ChevronDown,
  Loader2,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  WifiOff,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuthStore } from "@/features/auth/auth-store";
import {
  getDisplayName,
  getUserInitials,
  roleLabels,
} from "@/features/auth/types";
import { useLogout } from "@/features/auth/use-logout";
import { useSidebarStore } from "@/stores/sidebar-store";

import { getPageTitle } from "./nav-config";
import { ThemeToggle } from "./ThemeToggle";

interface TopbarProps {
  onOpenMobileSidebar: () => void;
}

export function Topbar({ onOpenMobileSidebar }: TopbarProps) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const collapsed = useSidebarStore((state) => state.collapsed);
  const toggleSidebar = useSidebarStore((state) => state.toggle);
  const user = useAuthStore((state) => state.user);
  const logout = useLogout();
  const [loggingOut, setLoggingOut] = useState(false);
  const pageTitle = getPageTitle(pathname);

  const handleLogout = async (): Promise<void> => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur-md sm:px-5">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onOpenMobileSidebar}
        aria-label="Buka menu navigasi"
      >
        <Menu className="size-5" />
      </Button>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex"
            onClick={toggleSidebar}
            aria-label={collapsed ? "Bentangkan sidebar" : "Lipat sidebar"}
            aria-keyshortcuts="Control+B"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-[18px]" />
            ) : (
              <PanelLeftClose className="size-[18px]" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Lipat sidebar (Ctrl+B)</TooltipContent>
      </Tooltip>

      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">
          {pageTitle}
        </p>
        <p className="hidden truncate text-[11px] text-muted-foreground sm:block">
          LaundryKu · Manajemen keuangan laundry
        </p>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <Badge
          variant="outline"
          className="hidden gap-1.5 border-emerald-500/30 bg-emerald-500/5 text-[11px] text-emerald-700 md:inline-flex dark:text-emerald-400"
        >
          <WifiOff className="size-3" />
          Mode offline
        </Badge>

        <ThemeToggle />

        <Separator
          orientation="vertical"
          className="mx-1 hidden h-6 sm:block"
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg p-1 pr-1.5 outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:pr-2"
              aria-label="Menu akun"
            >
              <Avatar className="size-8">
                <AvatarFallback>{getUserInitials(user)}</AvatarFallback>
              </Avatar>
              <div className="hidden text-left sm:block">
                <p className="text-xs font-semibold leading-tight text-foreground">
                  {getDisplayName(user)}
                </p>
                <p className="text-[10px] leading-tight text-muted-foreground">
                  {user ? roleLabels[user.role] : "Pengguna"}
                </p>
              </div>
              <ChevronDown className="hidden size-3.5 text-muted-foreground sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="text-sm font-semibold text-foreground">
                {getDisplayName(user)}
              </p>
              <p className="mt-0.5 text-[11px] font-normal text-muted-foreground">
                @{user?.username ?? "-"} ·{" "}
                {user ? roleLabels[user.role] : "Pengguna"}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={loggingOut}
              onSelect={() => {
                void handleLogout();
              }}
            >
              {loggingOut ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <LogOut className="size-4" />
              )}
              {loggingOut ? "Keluar…" : "Keluar"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
