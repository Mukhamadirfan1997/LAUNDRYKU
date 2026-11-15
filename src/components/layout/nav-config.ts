import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  ListChecks,
  Package,
  ReceiptText,
  Settings,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";

import type { UserRole } from "@/db/types";

export interface NavItem {
  title: string;
  to: string;
  icon: LucideIcon;
  roles: UserRole[];
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    label: "Utama",
    items: [
      {
        title: "Dashboard",
        to: "/",
        icon: LayoutDashboard,
        roles: ["admin", "kasir"],
      },
    ],
  },
  {
    label: "Operasional",
    items: [
      {
        title: "Master Barang",
        to: "/operasional/barang",
        icon: Package,
        roles: ["admin", "kasir"],
      },
      {
        title: "Master Layanan",
        to: "/operasional/layanan",
        icon: Sparkles,
        roles: ["admin", "kasir"],
      },
    ],
  },
  {
    label: "Transaksi",
    items: [
      {
        title: "Antrian Masuk",
        to: "/transaksi/antrian",
        icon: ClipboardList,
        roles: ["admin", "kasir", "operator"],
      },
      {
        title: "Status Order",
        to: "/transaksi/status",
        icon: ListChecks,
        roles: ["admin", "kasir", "operator"],
      },
      {
        title: "Data Pelanggan",
        to: "/transaksi/pelanggan",
        icon: Users,
        roles: ["admin", "kasir"],
      },
    ],
  },
  {
    label: "Keuangan",
    items: [
      {
        title: "Pengeluaran",
        to: "/pengeluaran",
        icon: Wallet,
        roles: ["admin"],
      },
      {
        title: "Laporan",
        to: "/laporan",
        icon: BarChart3,
        roles: ["admin"],
      },
    ],
  },
  {
    label: "Sistem",
    items: [
      {
        title: "Pengaturan",
        to: "/pengaturan",
        icon: Settings,
        roles: ["admin"],
      },
    ],
  },
];

const flatNav = navSections.flatMap((section) => section.items);

export function isNavItemActive(pathname: string, to: string): boolean {
  if (to === "/") return pathname === "/";
  if (to === "/transaksi/antrian" && pathname === "/transaksi/baru") {
    return true;
  }
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function getPageTitle(pathname: string): string {
  if (pathname === "/") return "Dashboard";
  if (pathname === "/akses-ditolak") return "Akses Ditolak";
  if (pathname === "/transaksi/baru") return "Transaksi Baru";
  if (pathname === "/pengeluaran/kategori") return "Kategori Pengeluaran";
  const match = [...flatNav]
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => isNavItemActive(pathname, item.to));
  return match?.title ?? "LaundryKu";
}

export const quickAccess: Array<{
  title: string;
  description: string;
  to: string;
  icon: LucideIcon;
  color: string;
  roles: UserRole[];
}> = [
  {
    title: "Antrian Masuk",
    description: "Catat order laundry baru",
    to: "/transaksi/antrian",
    icon: ReceiptText,
    color: "text-cyan-600 dark:text-cyan-400",
    roles: ["admin", "kasir", "operator"],
  },
  {
    title: "Pengeluaran",
    description: "Catat biaya operasional",
    to: "/pengeluaran",
    icon: Wallet,
    color: "text-red-600 dark:text-red-400",
    roles: ["admin"],
  },
  {
    title: "Laporan",
    description: "Lihat ringkasan keuangan",
    to: "/laporan",
    icon: BarChart3,
    color: "text-emerald-600 dark:text-emerald-400",
    roles: ["admin"],
  },
];
