import type { UserRole } from "@/db/types";

/** Data pengguna yang dikirim Rust setelah login; tidak pernah memuat hash password. */
export interface SessionUser {
  id: number;
  username: string;
  role: UserRole;
  employeeId: number | null;
  employeeName: string | null;
  position: string | null;
}

export interface LoginResponse {
  token: string;
  user: SessionUser;
  /** Unix timestamp dalam detik. */
  expiresAt: number;
}

export interface SessionValidation {
  user: SessionUser;
  /** Unix timestamp dalam detik. */
  expiresAt: number;
}

export const roleLabels: Record<UserRole, string> = {
  admin: "Admin",
  kasir: "Kasir",
  operator: "Operator",
};

export function getDisplayName(user: SessionUser | null): string {
  if (!user) return "Pengguna";
  return user.employeeName?.trim() || user.username;
}

export function getUserInitials(user: SessionUser | null): string {
  const name = getDisplayName(user);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "LK";
  if (parts.length === 1) return (parts[0] ?? "LK").slice(0, 2).toUpperCase();
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

export function getRoleHome(role: UserRole): "/" | "/transaksi/antrian" {
  return role === "operator" ? "/transaksi/antrian" : "/";
}
