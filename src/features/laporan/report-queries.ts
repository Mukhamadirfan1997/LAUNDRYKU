import { eachDayOfInterval, format } from "date-fns";
import { id as localeId } from "date-fns/locale";

import { getDatabase } from "@/db/client";
import type { BusinessProfile } from "@/db/types";
import { toIsoDate } from "@/lib/format";

import type {
  ReportCategoryTotal,
  ReportData,
  ReportMode,
  ReportPeriod,
  ReportTrendPoint,
} from "./types";

export const reportsQueryKey = ["laporan"] as const;

interface OrderAggregateRow {
  order_count: number;
  completed_order_count: number;
  order_value: number;
}

interface ItemAggregateRow {
  item_qty: number;
  item_line_count: number;
}

interface PaymentRow {
  date: string;
  total: number;
}

interface ExpenseRow {
  date: string;
  category_id: number;
  category_name: string;
  amount: number;
}

/**
 * Membentuk rentang tanggal laporan dari kontrol bulan/tahun.
 * Mengembalikan null bila input belum valid agar query tidak berjalan.
 */
export function buildReportPeriod(
  mode: ReportMode,
  monthValue: string,
  yearValue: number,
): ReportPeriod | null {
  if (mode === "monthly") {
    const match = /^(\d{4})-(\d{2})$/.exec(monthValue);
    if (!match) return null;

    const year = Number(match[1]);
    const monthNumber = Number(match[2]);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return null;
    }
    if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
      return null;
    }

    const start = new Date(year, monthNumber - 1, 1);
    const end = new Date(year, monthNumber, 0);

    return {
      mode,
      modeLabel: "Bulanan",
      periodLabel: format(start, "MMMM yyyy", { locale: localeId }),
      startDate: toIsoDate(start),
      endDate: toIsoDate(end),
      fileBase: `Laporan-Bulanan-${year}-${String(monthNumber).padStart(2, "0")}`,
    };
  }

  if (!Number.isInteger(yearValue) || yearValue < 2000 || yearValue > 2100) {
    return null;
  }

  return {
    mode,
    modeLabel: "Tahunan",
    periodLabel: `Tahun ${yearValue}`,
    startDate: `${yearValue}-01-01`,
    endDate: `${yearValue}-12-31`,
    fileBase: `Laporan-Tahunan-${yearValue}`,
  };
}

function trendKey(mode: ReportMode, date: string): string {
  return mode === "yearly" ? date.slice(0, 7) : date;
}

function buildTrend(
  period: ReportPeriod,
  revenueByKey: Map<string, number>,
  expenseByKey: Map<string, number>,
): ReportTrendPoint[] {
  if (period.mode === "monthly") {
    const start = new Date(`${period.startDate}T00:00:00`);
    const end = new Date(`${period.endDate}T00:00:00`);

    return eachDayOfInterval({ start, end }).map((date) => {
      const key = toIsoDate(date);
      const revenue = revenueByKey.get(key) ?? 0;
      const expense = expenseByKey.get(key) ?? 0;

      return {
        key,
        axisLabel: format(date, "d", { locale: localeId }),
        label: format(date, "d MMM", { locale: localeId }),
        revenue,
        expense,
        balance: revenue - expense,
      };
    });
  }

  const year = Number(period.startDate.slice(0, 4));
  return Array.from({ length: 12 }).map((_, monthIndex) => {
    const date = new Date(year, monthIndex, 1);
    const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
    const revenue = revenueByKey.get(key) ?? 0;
    const expense = expenseByKey.get(key) ?? 0;

    return {
      key,
      axisLabel: format(date, "MMM", { locale: localeId }),
      label: format(date, "MMMM", { locale: localeId }),
      revenue,
      expense,
      balance: revenue - expense,
    };
  });
}

export async function fetchReportData(
  period: ReportPeriod,
): Promise<ReportData> {
  const db = await getDatabase();

  const [
    orderRows,
    itemRows,
    paymentRows,
    expenseRows,
    profiles,
  ] = await Promise.all([
    db.select<OrderAggregateRow[]>(
      `SELECT COUNT(*) AS order_count,
              COALESCE(SUM(CASE WHEN status = 'selesai' THEN 1 ELSE 0 END), 0) AS completed_order_count,
              COALESCE(SUM(total), 0) AS order_value
       FROM orders
       WHERE order_date BETWEEN ? AND ?`,
      [period.startDate, period.endDate],
    ),
    db.select<ItemAggregateRow[]>(
      `SELECT COALESCE(SUM(oi.qty), 0) AS item_qty,
              COUNT(*) AS item_line_count
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.order_date BETWEEN ? AND ?`,
      [period.startDate, period.endDate],
    ),
    db.select<PaymentRow[]>(
      `SELECT date(paid_at, 'localtime') AS date,
              COALESCE(SUM(amount), 0) AS total
       FROM payments
       WHERE date(paid_at, 'localtime') BETWEEN ? AND ?
       GROUP BY date(paid_at, 'localtime')
       ORDER BY date ASC`,
      [period.startDate, period.endDate],
    ),
    db.select<ExpenseRow[]>(
      `SELECT e.expense_date AS date,
              e.category_id,
              c.name AS category_name,
              e.amount
       FROM expenses e
       JOIN expense_categories c ON c.id = e.category_id
       WHERE e.expense_date BETWEEN ? AND ?
       ORDER BY e.expense_date ASC, e.id ASC`,
      [period.startDate, period.endDate],
    ),
    db.select<BusinessProfile[]>(
      "SELECT * FROM business_profile WHERE id = 1 LIMIT 1",
    ),
  ]);

  const order = orderRows[0];
  const items = itemRows[0];
  const revenueByKey = new Map<string, number>();
  const expenseByKey = new Map<string, number>();
  const categoryMap = new Map<number, { name: string; amount: number }>();
  let revenue = 0;
  let expenseTotal = 0;

  for (const row of paymentRows) {
    const amount = Number(row.total);
    revenue += amount;
    const key = trendKey(period.mode, row.date);
    revenueByKey.set(key, (revenueByKey.get(key) ?? 0) + amount);
  }

  for (const row of expenseRows) {
    const amount = Number(row.amount);
    expenseTotal += amount;

    const key = trendKey(period.mode, row.date);
    expenseByKey.set(key, (expenseByKey.get(key) ?? 0) + amount);

    const categoryId = Number(row.category_id);
    const current = categoryMap.get(categoryId);
    categoryMap.set(categoryId, {
      name: row.category_name,
      amount: (current?.amount ?? 0) + amount,
    });
  }

  const expenseCategories: ReportCategoryTotal[] = [...categoryMap.entries()]
    .map(([categoryId, category]) => ({
      categoryId,
      name: category.name,
      amount: category.amount,
      percentage:
        expenseTotal > 0 ? (category.amount / expenseTotal) * 100 : 0,
    }))
    .sort((first, second) => second.amount - first.amount);

  return {
    ...period,
    profile: profiles[0] ?? null,
    orderCount: Number(order?.order_count ?? 0),
    completedOrderCount: Number(order?.completed_order_count ?? 0),
    orderValue: Number(order?.order_value ?? 0),
    itemQty: Number(items?.item_qty ?? 0),
    itemLineCount: Number(items?.item_line_count ?? 0),
    revenue,
    expenseTotal,
    balance: revenue - expenseTotal,
    expenseCategories,
    trend: buildTrend(period, revenueByKey, expenseByKey),
  };
}
