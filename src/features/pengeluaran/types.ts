import type { Expense, ExpenseCategory } from "@/db/types";

export interface ExpenseWithCategory extends Expense {
  category_name: string;
  category_active: number;
}

export interface ExpenseCategoryWithUsage extends ExpenseCategory {
  usage_count: number;
}

export interface ExpenseInput {
  expenseDate: string;
  categoryId: number;
  description: string;
  amount: number;
}

export interface ExpenseCategoryInput {
  name: string;
  isActive: boolean;
}
