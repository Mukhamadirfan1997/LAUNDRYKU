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
import type { EmployeePosition } from "@/db/types";
import { getErrorMessage } from "@/lib/api";

import type { EmployeeInput, EmployeeWithAccountCount } from "./types";
import { positionDescriptions, positionLabels } from "./types";

const employeeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama pegawai minimal 2 karakter.")
    .max(100, "Nama pegawai maksimal 100 karakter."),
  position: z.enum(["Admin", "Kasir", "Operator"]),
  phone: z
    .string()
    .trim()
    .max(30, "No. telepon maksimal 30 karakter."),
  address: z.string().trim().max(250, "Alamat maksimal 250 karakter."),
});

type EmployeeFormValues = z.infer<typeof employeeSchema>;

const emptyValues: EmployeeFormValues = {
  name: "",
  position: "Kasir",
  phone: "",
  address: "",
};

interface EmployeeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: EmployeeWithAccountCount | null;
  positionLocked?: boolean;
  onSave: (input: EmployeeInput) => Promise<void>;
}

export function EmployeeFormDialog({
  open,
  onOpenChange,
  employee,
  positionLocked = false,
  onSave,
}: EmployeeFormDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      employee
        ? {
            name: employee.name,
            position: employee.position,
            phone: employee.phone ?? "",
            address: employee.address ?? "",
          }
        : emptyValues,
    );
    setServerError(null);
  }, [employee, form, open]);

  const isSubmitting = form.formState.isSubmitting;

  const submit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await onSave({
        name: values.name.trim(),
        position: values.position,
        phone: values.phone.trim(),
        address: values.address.trim(),
      });
      onOpenChange(false);
    } catch (error) {
      setServerError(
        getErrorMessage(error, "Gagal menyimpan pegawai. Silakan coba lagi."),
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
          <DialogTitle>{employee ? "Ubah Pegawai" : "Tambah Pegawai"}</DialogTitle>
          <DialogDescription>
            Jabatan pegawai menentukan role akun login yang dapat dibuat.
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
            <Label htmlFor="employee-name">
              Nama pegawai <span className="text-destructive">*</span>
            </Label>
            <Input
              id="employee-name"
              placeholder="Nama lengkap pegawai"
              autoFocus
              {...form.register("name")}
            />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>
              Jabatan <span className="text-destructive">*</span>
            </Label>
            <Controller
              control={form.control}
              name="position"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(value) =>
                    field.onChange(value as EmployeePosition)
                  }
                  disabled={positionLocked}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih jabatan" />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.keys(positionLabels) as EmployeePosition[]
                    ).map((position) => (
                      <SelectItem key={position} value={position}>
                        {positionLabels[position]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-muted-foreground">
              {positionDescriptions[form.watch("position")]}
            </p>
            {positionLocked ? (
              <p className="text-xs text-muted-foreground">
                Jabatan akun Anda sendiri tidak dapat diubah dari halaman ini.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="employee-phone">No. telepon</Label>
            <Input
              id="employee-phone"
              inputMode="tel"
              placeholder="Opsional"
              {...form.register("phone")}
            />
            {form.formState.errors.phone ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.phone.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="employee-address">Alamat</Label>
            <Textarea
              id="employee-address"
              rows={2}
              placeholder="Opsional"
              {...form.register("address")}
            />
            {form.formState.errors.address ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.address.message}
              </p>
            ) : null}
          </div>

          <DialogFooter>
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
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {employee ? "Simpan Perubahan" : "Tambah Pegawai"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
