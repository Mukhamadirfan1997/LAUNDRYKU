import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, TriangleAlert } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Expense } from "@/db/types";
import { getErrorMessage } from "@/lib/api";
import { formatTanggal, todayIso } from "@/lib/format";

import type { ExpenseCategoryWithUsage, ExpenseInput } from "./types";

const expenseSchema = z.object({
  expenseDate: z
    .string()
    .min(1, "Tanggal pengeluaran wajib diisi.")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal pengeluaran tidak valid."),
  categoryId: z.string().min(1, "Kategori pengeluaran wajib dipilih."),
  description: z
    .string()
    .trim()
    .min(2, "Keterangan minimal 2 karakter.")
    .max(200, "Keterangan maksimal 200 karakter."),
  amount: z
    .string()
    .trim()
    .min(1, "Nominal wajib diisi.")
    .regex(/^\d+$/, "Nominal harus berupa angka bulat tanpa titik atau koma.")
    .refine(
      (value) => Number(value) > 0,
      "Nominal pengeluaran harus lebih dari Rp 0.",
    )
    .refine(
      (value) => Number(value) <= 1_000_000_000,
      "Nominal terlalu besar. Maksimal Rp 1.000.000.000.",
    ),
});

type ExpenseFormValues = z.infer<typeof expenseSchema>;

function emptyValues(categories: ExpenseCategoryWithUsage[]): ExpenseFormValues {
  const firstActive = categories.find((category) => category.is_active === 1);
  return {
    expenseDate: todayIso(),
    categoryId: firstActive ? String(firstActive.id) : "",
    description: "",
    amount: "",
  };
}

interface ExpenseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: Expense | null;
  categories: ExpenseCategoryWithUsage[];
  onSave: (input: ExpenseInput) => Promise<void>;
}

export function ExpenseFormDialog({
  open,
  onOpenChange,
  expense,
  categories,
  onSave,
}: ExpenseFormDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: emptyValues(categories),
  });

  useEffect(() => {
    if (!open) return;

    form.reset(
      expense
        ? {
            expenseDate: expense.expense_date,
            categoryId: String(expense.category_id),
            description: expense.description,
            amount: String(expense.amount),
          }
        : emptyValues(categories),
    );
    setServerError(null);
  }, [categories, expense, form, open]);

  const isSubmitting = form.formState.isSubmitting;
  const availableCategories = categories.filter(
    (category) =>
      category.is_active === 1 ||
      (expense !== null && category.id === expense.category_id),
  );

  const submit = form.handleSubmit(async (values) => {
    setServerError(null);

    try {
      await onSave({
        expenseDate: values.expenseDate,
        categoryId: Number(values.categoryId),
        description: values.description.trim(),
        amount: Number(values.amount),
      });
      onOpenChange(false);
    } catch (error) {
      setServerError(
        getErrorMessage(
          error,
          "Gagal menyimpan pengeluaran. Silakan coba lagi.",
        ),
      );
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSubmitting) onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        showCloseButton={!isSubmitting}
        onEscapeKeyDown={(event) => {
          if (isSubmitting) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (isSubmitting) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {expense ? "Ubah Pengeluaran" : "Catat Pengeluaran"}
          </DialogTitle>
          <DialogDescription>
            {expense
              ? `${formatTanggal(expense.expense_date)} · akan diperbarui di laporan keuangan.`
              : "Catat biaya operasional agar laporan pendapatan dan saldo tetap akurat."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4" noValidate>
          {serverError ? (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-destructive/25 bg-destructive/10 px-3.5 py-3 text-sm text-destructive"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <p className="leading-relaxed">{serverError}</p>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="expense-date">
                Tanggal <span className="text-destructive">*</span>
              </Label>
              <Input
                id="expense-date"
                type="date"
                disabled={isSubmitting}
                aria-invalid={Boolean(form.formState.errors.expenseDate)}
                {...form.register("expenseDate")}
              />
              {form.formState.errors.expenseDate ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.expenseDate.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="expense-category">
                Kategori <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={
                      isSubmitting || availableCategories.length === 0
                    }
                  >
                    <SelectTrigger
                      id="expense-category"
                      aria-label="Pilih kategori pengeluaran"
                      aria-invalid={Boolean(
                        form.formState.errors.categoryId,
                      )}
                    >
                      <SelectValue placeholder="Pilih kategori..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCategories.map((category) => (
                        <SelectItem
                          key={category.id}
                          value={String(category.id)}
                        >
                          {category.name}
                          {category.is_active === 1 ? "" : " (nonaktif)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.categoryId ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.categoryId.message}
                </p>
              ) : availableCategories.length === 0 ? (
                <p className="text-xs text-destructive">
                  Belum ada kategori aktif. Tambahkan kategori terlebih dahulu.
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-description">
              Keterangan <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="expense-description"
              placeholder="Contoh: Pembelian deterjen 5 kg"
              disabled={isSubmitting}
              aria-invalid={Boolean(form.formState.errors.description)}
              {...form.register("description")}
            />
            {form.formState.errors.description ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.description.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-amount">
              Nominal <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                Rp
              </span>
              <Input
                id="expense-amount"
                inputMode="numeric"
                placeholder="50000"
                className="pl-9"
                disabled={isSubmitting}
                aria-invalid={Boolean(form.formState.errors.amount)}
                {...form.register("amount")}
              />
            </div>
            {form.formState.errors.amount ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.amount.message}
              </p>
            ) : null}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || availableCategories.length === 0}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Menyimpan...
                </>
              ) : expense ? (
                "Simpan Perubahan"
              ) : (
                "Catat Pengeluaran"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
