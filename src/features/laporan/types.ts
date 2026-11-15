import type { BusinessProfile } from "@/db/types";

export type ReportMode = "monthly" | "yearly";
export type ReportModeLabel = "Bulanan" | "Tahunan";

export interface ReportPeriod {
  mode: ReportMode;
  modeLabel: ReportModeLabel;
  periodLabel: string;
  startDate: string;
  endDate: string;
  fileBase: string;
}

export interface ReportCategoryTotal {
  categoryId: number;
  name: string;
  amount: number;
  percentage: number;
}

export interface ReportTrendPoint {
  key: string;
  axisLabel: string;
  label: string;
  revenue: number;
  expense: number;
  balance: number;
}

export interface ReportData extends ReportPeriod {
  profile: BusinessProfile | null;
  orderCount: number;
  completedOrderCount: number;
  orderValue: number;
  itemQty: number;
  itemLineCount: number;
  revenue: number;
  expenseTotal: number;
  balance: number;
  expenseCategories: ReportCategoryTotal[];
  trend: ReportTrendPoint[];
}
