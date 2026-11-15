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
import { Switch } from "@/components/ui/switch";
import type { ExpenseCategory } from "@/db/types";
import { getErrorMessage } from "@/lib/api";

import type { ExpenseCategoryInput } from "./types";

const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama kategori minimal 2 karakter.")
    .max(60, "Nama kategori maksimal 60 karakter."),
  isActive: z.boolean(),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

const emptyValues: CategoryFormValues = {
  name: "",
  isActive: true,
};

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: ExpenseCategory | null;
  onSave: (input: ExpenseCategoryInput) => Promise<void>;
}

export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
  onSave,
}: CategoryFormDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (!open) return;

    form.reset(
      category
        ? {
            name: category.name,
            isActive: category.is_active === 1,
          }
        : emptyValues,
    );
    setServerError(null);
  }, [category, form, open]);

  const isSubmitting = form.formState.isSubmitting;

  const submit = form.handleSubmit(async (values) => {
    setServerError(null);

    try {
      await onSave({
        name: values.name.trim(),
        isActive: values.isActive,
      });
      onOpenChange(false);
    } catch (error) {
      setServerError(
        getErrorMessage(
          error,
          "Gagal menyimpan kategori pengeluaran. Silakan coba lagi.",
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
        className="max-w-md"
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
            {category ? "Ubah Kategori" : "Tambah Kategori"}
          </DialogTitle>
          <DialogDescription>
            {category
              ? `Kategori "${category.name}" akan diperbarui.`
              : "Kelompokkan pengeluaran agar laporan lebih mudah dibaca."}
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

          <div className="space-y-2">
            <Label htmlFor="category-name">
              Nama kategori <span className="text-destructive">*</span>
            </Label>
            <Input
              id="category-name"
              placeholder="Contoh: Listrik & Air"
              autoFocus
              disabled={isSubmitting}
              aria-invalid={Boolean(form.formState.errors.name)}
              {...form.register("name")}
            />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/30 px-3.5 py-3">
            <div>
              <Label htmlFor="category-active">Kategori aktif</Label>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Kategori nonaktif tidak dapat dipilih saat mencatat pengeluaran
                baru.
              </p>
            </div>
            <Controller
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <Switch
                  id="category-active"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isSubmitting}
                />
              )}
            />
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Menyimpan...
                </>
              ) : category ? (
                "Simpan Perubahan"
              ) : (
                "Tambah Kategori"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
