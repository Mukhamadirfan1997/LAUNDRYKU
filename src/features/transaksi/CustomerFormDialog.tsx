import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, TriangleAlert } from "lucide-react";
import { useForm } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import type { Customer } from "@/db/types";
import { getErrorMessage } from "@/lib/api";

import type { CustomerInput } from "./customers-api";

const customerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama pelanggan minimal 2 karakter.")
    .max(100, "Nama pelanggan maksimal 100 karakter."),
  phone: z
    .string()
    .trim()
    .min(6, "Nomor HP minimal 6 karakter.")
    .max(25, "Nomor HP maksimal 25 karakter.")
    .regex(
      /^[0-9+()\s-]+$/,
      "Nomor HP hanya boleh berisi angka dan tanda +, -, spasi, atau kurung.",
    ),
  address: z.string().trim().max(250, "Alamat maksimal 250 karakter."),
  notes: z.string().trim().max(500, "Catatan maksimal 500 karakter."),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

const emptyValues: CustomerFormValues = {
  name: "",
  phone: "",
  address: "",
  notes: "",
};

interface CustomerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
  onSave: (input: CustomerInput) => Promise<void>;
}

export function CustomerFormDialog({
  open,
  onOpenChange,
  customer,
  onSave,
}: CustomerFormDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (!open) return;

    form.reset(
      customer
        ? {
            name: customer.name,
            phone: customer.phone,
            address: customer.address ?? "",
            notes: customer.notes ?? "",
          }
        : emptyValues,
    );
    setServerError(null);
  }, [customer, form, open]);

  const isSubmitting = form.formState.isSubmitting;

  const submit = form.handleSubmit(async (values) => {
    setServerError(null);

    try {
      await onSave({
        name: values.name.trim(),
        phone: values.phone.trim(),
        address: values.address.trim() ? values.address.trim() : null,
        notes: values.notes.trim() ? values.notes.trim() : null,
      });
      onOpenChange(false);
    } catch (error) {
      setServerError(
        getErrorMessage(error, "Gagal menyimpan pelanggan. Silakan coba lagi."),
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
            {customer ? "Ubah Pelanggan" : "Tambah Pelanggan"}
          </DialogTitle>
          <DialogDescription>
            {customer
              ? "Perbarui data pelanggan. Order lama tetap memakai salinan nama dan HP."
              : "Simpan data pelanggan agar transaksi berikutnya lebih cepat dicatat."}
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
            <Label htmlFor="customer-form-name">
              Nama pelanggan <span className="text-destructive">*</span>
            </Label>
            <Input
              id="customer-form-name"
              placeholder="Contoh: Ibu Sari"
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

          <div className="space-y-2">
            <Label htmlFor="customer-form-phone">
              Nomor HP <span className="text-destructive">*</span>
            </Label>
            <Input
              id="customer-form-phone"
              placeholder="0812xxxxxxx"
              inputMode="tel"
              disabled={isSubmitting}
              aria-invalid={Boolean(form.formState.errors.phone)}
              {...form.register("phone")}
            />
            {form.formState.errors.phone ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.phone.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-form-address">Alamat</Label>
            <Textarea
              id="customer-form-address"
              placeholder="Alamat pelanggan (opsional)"
              maxLength={250}
              className="min-h-16"
              disabled={isSubmitting}
              aria-invalid={Boolean(form.formState.errors.address)}
              {...form.register("address")}
            />
            {form.formState.errors.address ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.address.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-form-notes">Catatan</Label>
            <Textarea
              id="customer-form-notes"
              placeholder="Catatan khusus pelanggan (opsional)"
              maxLength={500}
              className="min-h-16"
              disabled={isSubmitting}
              aria-invalid={Boolean(form.formState.errors.notes)}
              {...form.register("notes")}
            />
            {form.formState.errors.notes ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.notes.message}
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Menyimpan…
                </>
              ) : customer ? (
                "Simpan Perubahan"
              ) : (
                "Tambah Pelanggan"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
