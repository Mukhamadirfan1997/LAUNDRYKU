import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Info, Loader2, TriangleAlert } from "lucide-react";
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
import { getServiceName, type Service } from "@/db/types";
import { getErrorMessage } from "@/lib/api";

import type { ServiceInput } from "./catalog-api";

const serviceSchema = z.object({
  category: z
    .string()
    .trim()
    .min(1, "Kategori layanan wajib diisi.")
    .max(60, "Kategori layanan maksimal 60 karakter."),
  speed: z
    .string()
    .trim()
    .min(1, "Kecepatan layanan wajib diisi.")
    .max(60, "Kecepatan layanan maksimal 60 karakter."),
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
  isActive: z.boolean(),
});

type ServiceFormValues = z.infer<typeof serviceSchema>;

const emptyValues: ServiceFormValues = {
  category: "",
  speed: "",
  unit: "kg",
  price: "",
  isActive: true,
};

interface ServiceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: Service | null;
  onSave: (input: ServiceInput) => Promise<void>;
}

export function ServiceFormDialog({
  open,
  onOpenChange,
  service,
  onSave,
}: ServiceFormDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (!open) return;

    form.reset(
      service
        ? {
            category: service.category,
            speed: service.speed,
            unit: service.unit,
            price: String(service.price),
            isActive: service.is_active === 1,
          }
        : emptyValues,
    );
    setServerError(null);
  }, [form, open, service]);

  const isSubmitting = form.formState.isSubmitting;

  const submit = form.handleSubmit(async (values) => {
    setServerError(null);

    try {
      await onSave({
        category: values.category.trim(),
        speed: values.speed.trim(),
        unit: values.unit.trim(),
        price: Number(values.price),
        isActive: values.isActive,
      });
      onOpenChange(false);
    } catch (error) {
      setServerError(
        getErrorMessage(error, "Gagal menyimpan layanan. Silakan coba lagi."),
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
          <DialogTitle>{service ? "Ubah Layanan" : "Tambah Layanan"}</DialogTitle>
          <DialogDescription>
            {service
              ? getServiceName(service)
              : "Buat layanan baru dengan kategori dan kecepatan sesuai kebutuhan usaha."}
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

          <div className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/35 px-3.5 py-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <p>
              Nama tampilan dibentuk dari kategori dan kecepatan. Riwayat
              transaksi tetap memakai salinan nama layanan saat order dibuat.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="service-category">
                Kategori <span className="text-destructive">*</span>
              </Label>
              <Input
                id="service-category"
                placeholder="Cuci + Setrika"
                autoFocus
                disabled={isSubmitting}
                aria-invalid={Boolean(form.formState.errors.category)}
                {...form.register("category")}
              />
              {form.formState.errors.category ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.category.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-speed">
                Kecepatan <span className="text-destructive">*</span>
              </Label>
              <Input
                id="service-speed"
                placeholder="Reguler"
                disabled={isSubmitting}
                aria-invalid={Boolean(form.formState.errors.speed)}
                {...form.register("speed")}
              />
              {form.formState.errors.speed ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.speed.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="service-unit">
                Satuan <span className="text-destructive">*</span>
              </Label>
              <Input
                id="service-unit"
                placeholder="kg"
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
              <Label htmlFor="service-price">
                Harga <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                  Rp
                </span>
                <Input
                  id="service-price"
                  inputMode="numeric"
                  placeholder="10000"
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
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/30 px-3.5 py-3">
            <div>
              <Label htmlFor="service-active">Layanan aktif</Label>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Layanan nonaktif tidak dapat dipilih saat membuat transaksi baru.
              </p>
            </div>
            <Controller
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <Switch
                  id="service-active"
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
              ) : service ? (
                "Simpan Perubahan"
              ) : (
                "Tambah Layanan"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
