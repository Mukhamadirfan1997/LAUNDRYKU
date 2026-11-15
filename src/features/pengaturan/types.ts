import type {
  ActivityAction,
  ActivityLog,
  Employee,
  EmployeePosition,
  SafeUser,
} from "@/db/types";

export interface EmployeeWithAccountCount extends Employee {
  account_count: number;
  account_username: string | null;
}

export interface AccountWithEmployee extends SafeUser {
  employee_name: string | null;
  employee_position: EmployeePosition | null;
  employee_active: number | null;
}

export interface EmployeeInput {
  name: string;
  position: EmployeePosition;
  phone: string;
  address: string;
}

export interface AccountCreateInput {
  employeeId: number;
  username: string;
  password: string;
  isActive: boolean;
}

export interface AccountUpdateInput {
  employeeId: number;
  username: string;
  isActive: boolean;
}

export interface ActivityLogFilters {
  startDate: string;
  endDate: string;
  userName: string;
  action: "" | ActivityAction;
  search: string;
  page: number;
  pageSize: number;
}

export interface ActivityLogPage {
  rows: ActivityLog[];
  total: number;
}

export interface BackupSnapshot {
  path: string;
  sizeBytes: number;
}

export interface BackupInfo {
  path: string;
  fileName: string;
  sizeBytes: number;
}

export interface RestoreInfo {
  path: string;
  fileName: string;
  users: number;
  orders: number;
  expenses: number;
}

export interface DatabaseInfo {
  path: string;
  sizeBytes: number;
  pageCount: number;
  pageSize: number;
}

export const positionLabels: Record<EmployeePosition, string> = {
  Admin: "Admin",
  Kasir: "Kasir",
  Operator: "Operator",
};

export const positionDescriptions: Record<EmployeePosition, string> = {
  Admin: "Akses penuh ke seluruh modul dan pengaturan.",
  Kasir: "Transaksi, pelanggan, pembayaran, dan master read-only.",
  Operator: "Antrian dan perubahan status order.",
};

export function roleForPosition(position: EmployeePosition): "admin" | "kasir" | "operator" {
  if (position === "Admin") return "admin";
  if (position === "Kasir") return "kasir";
  return "operator";
}

export const activityActionLabels: Record<ActivityAction, string> = {
  login: "Login",
  logout: "Logout",
  create: "Tambah",
  update: "Ubah",
  delete: "Hapus",
  status_change: "Ubah status",
  payment: "Pembayaran",
  export: "Ekspor",
  backup: "Backup",
  restore: "Restore",
};

export const activityActionOptions = Object.entries(activityActionLabels).map(
  ([value, label]) => ({
    value: value as ActivityAction,
    label,
  }),
);

export const entityLabels: Record<string, string> = {
  business_profile: "Profil usaha",
  customers: "Pelanggan",
  database: "Database",
  employees: "Pegawai",
  expense_categories: "Kategori pengeluaran",
  expenses: "Pengeluaran",
  items: "Barang",
  order_items: "Item order",
  orders: "Order",
  payments: "Pembayaran",
  services: "Layanan",
  users: "Akun",
};
