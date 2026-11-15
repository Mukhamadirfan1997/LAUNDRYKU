import { getDatabase } from "@/db/client";

import type {
  ExpenseCategoryWithUsage,
  ExpenseWithCategory,
} from "./types";

export const expensesQueryKey = ["pengeluaran", "expenses"] as const;
export const expenseCategoriesQueryKey = [
  "pengeluaran",
  "categories",
] as const;

export async function fetchExpenses(): Promise<ExpenseWithCategory[]> {
  const db = await getDatabase();
  const rows = await db.select<ExpenseWithCategory[]>(
    `SELECT e.*, c.name AS category_name, c.is_active AS category_active
     FROM expenses e
     JOIN expense_categories c ON c.id = e.category_id
     ORDER BY e.expense_date DESC, e.id DESC`,
  );

  return rows.map((row) => ({
    ...row,
    category_id: Number(row.category_id),
    amount: Number(row.amount),
    category_active: Number(row.category_active),
  }));
}

export async function fetchExpenseCategories(): Promise<
  ExpenseCategoryWithUsage[]
> {
  const db = await getDatabase();
  const rows = await db.select<ExpenseCategoryWithUsage[]>(
    `SELECT c.*,
            (SELECT COUNT(*) FROM expenses e WHERE e.category_id = c.id) AS usage_count
     FROM expense_categories c
     ORDER BY c.name COLLATE NOCASE ASC`,
  );

  return rows.map((row) => ({
    ...row,
    is_active: Number(row.is_active),
    usage_count: Number(row.usage_count),
  }));
}
