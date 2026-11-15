import { invoke } from "@tauri-apps/api/core";

import type { ExpenseCategoryInput, ExpenseInput } from "./types";

export async function createExpenseRequest(
  token: string,
  input: ExpenseInput,
): Promise<number> {
  return invoke<number>("create_expense", {
    token,
    expenseDate: input.expenseDate,
    categoryId: input.categoryId,
    description: input.description,
    amount: input.amount,
  });
}

export async function updateExpenseRequest(
  token: string,
  expenseId: number,
  input: ExpenseInput,
): Promise<void> {
  return invoke<void>("update_expense", {
    token,
    expenseId,
    expenseDate: input.expenseDate,
    categoryId: input.categoryId,
    description: input.description,
    amount: input.amount,
  });
}

export async function deleteExpenseRequest(
  token: string,
  expenseId: number,
): Promise<void> {
  return invoke<void>("delete_expense", { token, expenseId });
}

export async function createExpenseCategoryRequest(
  token: string,
  input: ExpenseCategoryInput,
): Promise<number> {
  return invoke<number>("create_expense_category", {
    token,
    name: input.name,
    isActive: input.isActive,
  });
}

export async function updateExpenseCategoryRequest(
  token: string,
  categoryId: number,
  input: ExpenseCategoryInput,
): Promise<void> {
  return invoke<void>("update_expense_category", {
    token,
    categoryId,
    name: input.name,
    isActive: input.isActive,
  });
}

export async function setExpenseCategoryActiveRequest(
  token: string,
  categoryId: number,
  isActive: boolean,
): Promise<void> {
  return invoke<void>("set_expense_category_active", {
    token,
    categoryId,
    isActive,
  });
}

export async function deleteExpenseCategoryRequest(
  token: string,
  categoryId: number,
): Promise<void> {
  return invoke<void>("delete_expense_category", { token, categoryId });
}
