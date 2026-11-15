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
import type { Item } from "@/db/types";
import { getErrorMessage } from "@/lib/api";

import type { ItemInput } from "./catalog-api";

const itemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama barang minimal 2 karakter.")
    .max(80, "Nama barang maksimal 80 karakter."),
  unit: z
    .string()
    .trim()
    .min(1, "Satuan wajib diisi.")
    .max(20, "Satuan maksimal 20 karakter."),
  price: z
    .string()
    .trim()
    .min(1, "Harga wajib diisi.")
    .regex(/^\d+$/, "Harga harus berupa angka bulat tanpa titik atau koma.")
    .refine(
      (value) => Number(value) <= 1_000_000_000,
      "Harga terlalu besar. Maksimal Rp 1.000.000.000.",
    ),
  stock: z
    .string()
    .trim()
    .min(1, "Stok wajib diisi.")
    .regex(/^\d+$/, "Stok harus berupa angka bulat tanpa titik atau koma.")
    .refine(
      (value) => Number(value) <= 1_000_000,
      "Stok terlalu besar. Maksimal 1.000.000.",
    ),
  isActive: z.boolean(),
});

type ItemFormValues = z.infer<typeof itemSchema>;

const emptyValues: ItemFormValues = {
  name: "",
  unit: "",
  price: "",
  stock: "",
  isActive: true,
};

interface ItemFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Item | null;
  onSave: (input: ItemInput) => Promise<void>;
}

export function ItemFormDialog({
  open,
  onOpenChange,
  item,
  onSave,
}: ItemFormDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (!open) return;

    form.reset(
      item
        ? {
            name: item.name,
            unit: item.unit,
            price: String(item.price),
            stock: String(item.stock),
            isActive: item.is_active === 1,
          }
        : emptyValues,
    );
    setServerError(null);
  }, [form, item, open]);

  const isSubmitting = form.formState.isSubmitting;

  const submit = form.handleSubmit(async (values) => {
    setServerError(null);

    try {
      await onSave({
        name: values.name.trim(),
        unit: values.unit.trim(),
        price: Number(values.price),
        stock: Number(values.stock),
        isActive: values.isActive,
      });
      onOpenChange(false);
    } catch (error) {
      setServerError(
        getErrorMessage(error, "Gagal menyimpan barang. Silakan coba lagi."),
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
          <DialogTitle>{item ? "Ubah Barang" : "Tambah Barang"}</DialogTitle>
          <DialogDescription>
            {item
              ? "Perbarui data barang. Perubahan langsung dipakai pada transaksi berikutnya."
              : "Tambahkan barang yang dijual atau dipakai dalam operasional laundry."}
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
            <Label htmlFor="item-name">
              Nama barang <span className="text-destructive">*</span>
            </Label>
            <Input
              id="item-name"
              placeholder="Contoh: Deterjen Bubuk"
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="item-unit">
                Satuan <span className="text-destructive">*</span>
              </Label>
              <Input
                id="item-unit"
                placeholder="pcs, kg, liter"
                disabled={isSubmitting}
                aria-invalid={Boolean(form.formState.errors.unit)}
                {...form.register("unit")}
              />
              {form.formState.errors.unit ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.unit.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-stock">
                Stok <span className="text-destructive">*</span>
              </Label>
              <Input
                id="item-stock"
                inputMode="numeric"
                placeholder="0"
                disabled={isSubmitting}
                aria-invalid={Boolean(form.formState.errors.stock)}
                {...form.register("stock")}
              />
              {form.formState.errors.stock ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.stock.message}
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Masukkan angka tanpa titik atau koma.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-price">
              Harga <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                Rp
              </span>
              <Input
                id="item-price"
                inputMode="numeric"
                placeholder="15000"
                className="pl-9"
                disabled={isSubmitting}
                aria-invalid={Boolean(form.formState.errors.price)}
                {...form.register("price")}
              />
            </div>
            {form.formState.errors.price ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.price.message}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Harga jual atau nilai barang per satuan.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/30 px-3.5 py-3">
            <div>
              <Label htmlFor="item-active">Barang aktif</Label>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Barang nonaktif tidak ditampilkan saat membuat transaksi baru.
              </p>
            </div>
            <Controller
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <Switch
                  id="item-active"
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
                  Menyimpan…
                </>
              ) : item ? (
                "Simpan Perubahan"
              ) : (
                "Tambah Barang"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
