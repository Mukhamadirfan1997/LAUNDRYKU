import { getDatabase, getDatabasePath } from "@/db/client";
import type { ActivityLog } from "@/db/types";

import type {
  AccountWithEmployee,
  ActivityLogFilters,
  ActivityLogPage,
  DatabaseInfo,
  EmployeeWithAccountCount,
} from "./types";

export const settingsEmployeesQueryKey = ["pengaturan", "pegawai"] as const;
export const settingsAccountsQueryKey = ["pengaturan", "akun"] as const;
export const settingsActivityUsersQueryKey = [
  "pengaturan",
  "log",
  "pengguna",
] as const;
export const settingsActivityLogsQueryKey = [
  "pengaturan",
  "log",
] as const;
export const settingsRecentBackupsQueryKey = [
  "pengaturan",
  "backup",
  "terakhir",
] as const;
export const settingsDatabaseInfoQueryKey = [
  "pengaturan",
  "database",
  "info",
] as const;

export async function fetchEmployees(): Promise<EmployeeWithAccountCount[]> {
  const db = await getDatabase();
  return db.select<EmployeeWithAccountCount[]>(
    `SELECT e.*,
            COUNT(u.id) AS account_count,
            MAX(u.username) AS account_username
     FROM employees e
     LEFT JOIN users u ON u.employee_id = e.id
     GROUP BY e.id
     ORDER BY e.name COLLATE NOCASE ASC`,
  );
}

export async function fetchAccounts(): Promise<AccountWithEmployee[]> {
  const db = await getDatabase();
  return db.select<AccountWithEmployee[]>(
    `SELECT u.id, u.employee_id, u.username, u.role, u.is_active,
            u.last_login_at, u.created_at, u.updated_at,
            e.name AS employee_name,
            e.position AS employee_position,
            e.is_active AS employee_active
     FROM users u
     LEFT JOIN employees e ON e.id = u.employee_id
     ORDER BY u.username COLLATE NOCASE ASC`,
  );
}

export async function fetchActivityUsers(): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.select<Array<{ user_name: string }>>(
    `SELECT DISTINCT user_name
     FROM activity_logs
     WHERE user_name <> ''
     ORDER BY user_name COLLATE NOCASE ASC`,
  );
  return rows.map((row) => row.user_name);
}

export async function fetchActivityLogs(
  filters: ActivityLogFilters,
): Promise<ActivityLogPage> {
  const db = await getDatabase();
  const conditions: string[] = [];
  const values: Array<string | number> = [];

  if (filters.startDate) {
    conditions.push("date(created_at, 'localtime') >= date(?)");
    values.push(filters.startDate);
  }
  if (filters.endDate) {
    conditions.push("date(created_at, 'localtime') <= date(?)");
    values.push(filters.endDate);
  }
  if (filters.userName) {
    conditions.push("user_name = ?");
    values.push(filters.userName);
  }
  if (filters.action) {
    conditions.push("action = ?");
    values.push(filters.action);
  }
  if (filters.search.trim()) {
    const pattern = `%${filters.search.trim()}%`;
    conditions.push(
      "(description LIKE ? OR entity LIKE ? OR user_name LIKE ?)",
    );
    values.push(pattern, pattern, pattern);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (filters.page - 1) * filters.pageSize;

  const [countRow] = await db.select<Array<{ total: number }>>(
    `SELECT COUNT(*) AS total FROM activity_logs ${where}`,
    values,
  );
  const rows = await db.select<ActivityLog[]>(
    `SELECT * FROM activity_logs ${where}
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`,
    [...values, filters.pageSize, offset],
  );

  return {
    rows,
    total: Number(countRow?.total ?? 0),
  };
}

export async function fetchRecentBackups(): Promise<ActivityLog[]> {
  const db = await getDatabase();
  return db.select<ActivityLog[]>(
    `SELECT * FROM activity_logs
     WHERE action IN ('backup', 'restore')
     ORDER BY created_at DESC, id DESC
     LIMIT 6`,
  );
}

export async function fetchDatabaseInfo(): Promise<DatabaseInfo> {
  const db = await getDatabase();
  const [path, pageCountRows, pageSizeRows] = await Promise.all([
    getDatabasePath(),
    db.select<Array<{ page_count: number }>>("PRAGMA page_count"),
    db.select<Array<{ page_size: number }>>("PRAGMA page_size"),
  ]);

  const pageCount = Number(pageCountRows[0]?.page_count ?? 0);
  const pageSize = Number(pageSizeRows[0]?.page_size ?? 0);

  return {
    path,
    pageCount,
    pageSize,
    sizeBytes: pageCount * pageSize,
  };
}
