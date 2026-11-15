import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";

import { AppLayout } from "@/components/layout/AppLayout";
import { Toaster } from "@/components/ui/sonner";
import { AuthLoadingPage } from "@/features/auth/AuthLoadingPage";
import { ForbiddenPage } from "@/features/auth/ForbiddenPage";
import { ensureSession, redirectAuthenticated, requireRole } from "@/features/auth/guards";
import { LoginPage } from "@/features/auth/LoginPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { NotFoundPage } from "@/features/errors/NotFoundPage";
import { RouteErrorPage } from "@/features/errors/RouteErrorPage";
import { LaporanPage } from "@/features/laporan/LaporanPage";
import { MasterBarangPage } from "@/features/operasional/MasterBarangPage";
import { MasterLayananPage } from "@/features/operasional/MasterLayananPage";
import { KategoriPengeluaranPage } from "@/features/pengeluaran/KategoriPengeluaranPage";
import { PengeluaranPage } from "@/features/pengeluaran/PengeluaranPage";
import { PengaturanPage } from "@/features/pengaturan/PengaturanPage";
import { AntrianPage } from "@/features/transaksi/AntrianPage";
import { OrderFormPage } from "@/features/transaksi/OrderFormPage";
import { PelangganPage } from "@/features/transaksi/PelangganPage";
import { StatusOrderPage } from "@/features/transaksi/StatusOrderPage";

function RootComponent() {
  return (
    <>
      <Outlet />
      <Toaster />
    </>
  );
}

const rootRoute = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundPage,
  errorComponent: RouteErrorPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
  beforeLoad: redirectAuthenticated,
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  component: AppLayout,
  beforeLoad: ensureSession,
  pendingComponent: AuthLoadingPage,
  pendingMs: 0,
});

const dashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/",
  component: DashboardPage,
  beforeLoad: requireRole(["admin", "kasir"]),
});

const masterBarangRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "operasional/barang",
  component: MasterBarangPage,
  beforeLoad: requireRole(["admin", "kasir"]),
});

const masterLayananRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "operasional/layanan",
  component: MasterLayananPage,
  beforeLoad: requireRole(["admin", "kasir"]),
});

const antrianRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "transaksi/antrian",
  component: AntrianPage,
  beforeLoad: requireRole(["admin", "kasir", "operator"]),
  validateSearch: (
    search: Record<string, unknown>,
  ): { order?: number } => {
    const order = Number(search.order);
    return Number.isInteger(order) && order > 0 ? { order } : {};
  },
});

const newOrderRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "transaksi/baru",
  component: OrderFormPage,
  beforeLoad: requireRole(["admin", "kasir"]),
});

const statusOrderRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "transaksi/status",
  component: StatusOrderPage,
  beforeLoad: requireRole(["admin", "kasir", "operator"]),
});

const pelangganRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "transaksi/pelanggan",
  component: PelangganPage,
  beforeLoad: requireRole(["admin", "kasir"]),
});

const pengeluaranRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "pengeluaran",
  component: PengeluaranPage,
  beforeLoad: requireRole(["admin"]),
});

const kategoriPengeluaranRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "pengeluaran/kategori",
  component: KategoriPengeluaranPage,
  beforeLoad: requireRole(["admin"]),
});

const laporanRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "laporan",
  component: LaporanPage,
  beforeLoad: requireRole(["admin"]),
});

const pengaturanRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "pengaturan",
  component: PengaturanPage,
  beforeLoad: requireRole(["admin"]),
});

const forbiddenRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "akses-ditolak",
  component: ForbiddenPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  appRoute.addChildren([
    dashboardRoute,
    masterBarangRoute,
    masterLayananRoute,
    antrianRoute,
    newOrderRoute,
    statusOrderRoute,
    pelangganRoute,
    pengeluaranRoute,
    kategoriPengeluaranRoute,
    laporanRoute,
    pengaturanRoute,
    forbiddenRoute,
  ]),
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
