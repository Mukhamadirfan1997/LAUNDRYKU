import { toIsoDate, todayIso } from "@/lib/format";

import { getDatabase } from "../client";
import type { BusinessProfile, Service } from "../types";

export interface RevenuePoint {
  date: string;
  total: number;
}

export interface BootstrapCounts {
  activeServices: number;
  totalServices: number;
  activeCategories: number;
  totalCustomers: number;
  ordersToday: number;
  unfinishedOrders: number;
  revenueToday: number;
}

export interface BootstrapData {
  profile: BusinessProfile | null;
  services: Service[];
  counts: BootstrapCounts;
  revenueLast7Days: RevenuePoint[];
}

export const bootstrapQueryKey = ["app", "bootstrap"] as const;

export async function fetchBootstrapData(): Promise<BootstrapData> {
  const db = await getDatabase();
  const today = todayIso();

  const profiles = await db.select<BusinessProfile[]>(
    "SELECT * FROM business_profile WHERE id = 1 LIMIT 1",
  );

  const services = await db.select<Service[]>(
    `SELECT * FROM services
     ORDER BY CASE category WHEN 'Cuci + Setrika' THEN 0 ELSE 1 END,
              CASE speed WHEN 'Reguler' THEN 0 WHEN 'Express' THEN 1 ELSE 2 END`,
  );

  const [serviceCounts] = await db.select<
    Array<{ active: number; total: number }>
  >(
    "SELECT COALESCE(SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END), 0) AS active, COUNT(*) AS total FROM services",
  );

  const [categoryCounts] = await db.select<Array<{ total: number }>>(
    "SELECT COUNT(*) AS total FROM expense_categories WHERE is_active = 1",
  );

  const [customerCounts] = await db.select<Array<{ total: number }>>(
    "SELECT COUNT(*) AS total FROM customers",
  );

  const [orderCounts] = await db.select<
    Array<{ today: number; unfinished: number }>
  >(
    `SELECT
       COALESCE(SUM(CASE WHEN order_date = ? THEN 1 ELSE 0 END), 0) AS today,
       COALESCE(SUM(CASE WHEN status IN ('masuk', 'proses') THEN 1 ELSE 0 END), 0) AS unfinished
     FROM orders`,
    [today],
  );

  const [revenue] = await db.select<Array<{ total: number }>>(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM payments
     WHERE date(paid_at, 'localtime') = date('now', 'localtime')`,
  );

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const startDate = toIsoDate(sevenDaysAgo);

  const revenueRows = await db.select<RevenuePoint[]>(
    `SELECT date(paid_at, 'localtime') AS date,
            COALESCE(SUM(amount), 0) AS total
     FROM payments
     WHERE date(paid_at, 'localtime') BETWEEN ? AND ?
     GROUP BY date(paid_at, 'localtime')
     ORDER BY date ASC`,
    [startDate, today],
  );

  return {
    profile: profiles[0] ?? null,
    services,
    counts: {
      activeServices: Number(serviceCounts?.active ?? 0),
      totalServices: Number(serviceCounts?.total ?? 0),
      activeCategories: Number(categoryCounts?.total ?? 0),
      totalCustomers: Number(customerCounts?.total ?? 0),
      ordersToday: Number(orderCounts?.today ?? 0),
      unfinishedOrders: Number(orderCounts?.unfinished ?? 0),
      revenueToday: Number(revenue?.total ?? 0),
    },
    revenueLast7Days: revenueRows.map((row) => ({
      date: row.date,
      total: Number(row.total),
    })),
  };
}
