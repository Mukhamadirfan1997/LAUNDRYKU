import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuthStore } from "@/features/auth/auth-store";
import { useDocumentTitle } from "@/lib/use-document-title";
import { useSidebarStore } from "@/stores/sidebar-store";

import { getPageTitle } from "./nav-config";
import { SidebarContent } from "./Sidebar";
import { Topbar } from "./Topbar";

/** Dialog/modal Radix yang sedang terbuka menghalangi shortcut navigasi. */
function hasOpenDialog(): boolean {
  return (
    document.querySelector('[role="dialog"][data-state="open"]') !== null
  );
}

export function AppLayout() {
  const collapsed = useSidebarStore((state) => state.collapsed);
  const toggleSidebar = useSidebarStore((state) => state.toggle);
  const [mobileOpen, setMobileOpen] = useState(false);
  const expiresAt = useAuthStore((state) => state.expiresAt);
  const clearSession = useAuthStore((state) => state.clearSession);
  const role = useAuthStore((state) => state.user?.role ?? null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const pageTitle = getPageTitle(pathname);
  const mainRef = useRef<HTMLElement>(null);

  useDocumentTitle(pageTitle);

  // Pindahkan fokus ke konten utama setiap pindah halaman agar pembaca layar
  // dan pengguna keyboard tidak tertinggal di menu navigasi.
  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  // Keluar otomatis tepat saat sesi 8 jam berakhir.
  useEffect(() => {
    if (!expiresAt) return;

    const remainingMs = expiresAt * 1000 - Date.now();
    const expire = (): void => {
      clearSession();
      queryClient.clear();
      toast.info("Sesi Anda telah berakhir. Silakan login kembali.");
      void navigate({ to: "/login", replace: true });
    };

    if (remainingMs <= 0) {
      expire();
      return;
    }

    const timer = window.setTimeout(expire, remainingMs);
    return () => window.clearTimeout(timer);
  }, [clearSession, expiresAt, navigate, queryClient]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!event.ctrlKey || event.altKey || event.metaKey) return;
      if (event.key.toLowerCase() !== "b") return;

      event.preventDefault();
      if (window.innerWidth >= 1024) {
        toggleSidebar();
      } else {
        setMobileOpen((open) => !open);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  // Shortcut transaksi baru hanya untuk role yang boleh membuat order.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!event.ctrlKey || event.altKey || event.metaKey) return;
      if (event.key.toLowerCase() !== "n") return;
      if (role !== "admin" && role !== "kasir") return;
      if (event.isComposing || hasOpenDialog()) return;

      event.preventDefault();
      void navigate({ to: "/transaksi/baru" });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate, role]);

  return (
    <TooltipProvider>
      <a
        href="#main-content"
        className="sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:m-0 focus:h-auto focus:w-auto focus:overflow-visible focus:whitespace-normal focus:rounded-md focus:border-0 focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-lg focus:[clip:auto]"
      >
        Lewati ke konten utama
      </a>
      <div className="flex min-h-screen bg-background">
        <aside
          className="sticky top-0 hidden h-screen shrink-0 border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:block"
          style={{ width: collapsed ? 80 : 268 }}
        >
          <SidebarContent collapsed={collapsed} />
        </aside>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            side="left"
            className="w-[280px] border-r-sidebar-border bg-sidebar p-0"
          >
            <SheetTitle className="sr-only">Menu navigasi LaundryKu</SheetTitle>
            <SheetDescription className="sr-only">
              Pilih menu untuk membuka halaman yang diinginkan.
            </SheetDescription>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onOpenMobileSidebar={() => setMobileOpen(true)} />

          <main
            ref={mainRef}
            id="main-content"
            tabIndex={-1}
            aria-label="Konten utama"
            className="flex-1 px-4 py-5 outline-none sm:px-6 lg:px-8 lg:py-6"
          >
            <div className="mx-auto w-full max-w-[1440px]">
              <Outlet />
            </div>
          </main>

          <footer className="border-t px-4 py-3 text-center text-[11px] text-muted-foreground sm:px-6 lg:px-8">
            LaundryKu v{__APP_VERSION__} — data tersimpan lokal di perangkat
            Anda
          </footer>
        </div>
      </div>
    </TooltipProvider>
  );
}
