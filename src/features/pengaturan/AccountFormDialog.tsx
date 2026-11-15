import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Info, Loader2, TriangleAlert } from "lucide-react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
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
import { getErrorMessage } from "@/lib/api";

import type {
  AccountWithEmployee,
  EmployeeWithAccountCount,
} from "./types";
import { positionDescriptions, roleForPosition } from "./types";

const usernameRegex = /^[a-zA-Z0-9._-]+$/;

const createAccountSchema = z
  .object({
    employeeId: z.string().min(1, "Pilih pegawai."),
    username: z
      .string()
      .trim()
      .min(3, "Username minimal 3 karakter.")
      .max(50, "Username maksimal 50 karakter.")
      .regex(
        usernameRegex,
        "Username hanya boleh huruf, angka, titik, garis bawah, atau strip.",
      ),
    password: z
      .string()
      .min(8, "Password minimal 8 karakter.")
      .max(72, "Password maksimal 72 karakter.")
      .regex(/[A-Z]/, "Password harus memuat huruf besar.")
      .regex(/[a-z]/, "Password harus memuat huruf kecil.")
      .regex(/[0-9]/, "Password harus memuat angka."),
    confirmPassword: z.string().min(1, "Konfirmasi password wajib diisi."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Konfirmasi password tidak cocok.",
    path: ["confirmPassword"],
  });

const updateAccountSchema = z.object({
  employeeId: z.string().min(1, "Pilih pegawai."),
  username: z
    .string()
    .trim()
    .min(3, "Username minimal 3 karakter.")
    .max(50, "Username maksimal 50 karakter.")
    .regex(
      usernameRegex,
      "Username hanya boleh huruf, angka, titik, garis bawah, atau strip.",
    ),
});

type CreateValues = z.infer<typeof createAccountSchema>;

interface AccountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: AccountWithEmployee | null;
  employees: EmployeeWithAccountCount[];
  isOwnAccount?: boolean;
  onSaveCreate: (input: {
    employeeId: number;
    username: string;
    password: string;
    isActive: boolean;
  }) => Promise<void>;
  onSaveUpdate: (input: {
    employeeId: number;
    username: string;
    isActive: boolean;
  }) => Promise<void>;
}

export function AccountFormDialog({
  open,
  onOpenChange,
  account,
  employees,
  isOwnAccount = false,
  onSaveCreate,
  onSaveUpdate,
}: AccountFormDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);

  // Pegawai aktif tanpa akun, ditambah pegawai milik akun yang sedang diubah
  // agar akun nonaktif tetap dapat diperbaiki datanya.
  const availableEmployees = employees.filter(
    (emp) =>
      (account !== null && emp.id === account.employee_id) ||
      (emp.is_active === 1 && emp.account_count === 0),
  );

  const resolver = (account
    ? zodResolver(updateAccountSchema)
    : zodResolver(createAccountSchema)) as Resolver<CreateValues>;

  const form = useForm<CreateValues>({
    resolver,
    defaultValues: {
      employeeId: "",
      username: "",
      password: "",
      confirmPassword: "",
    },
  });

  const selectedEmployeeId = Number(form.watch("employeeId"));
  const selectedEmployee = employees.find(
    (emp) => emp.id === selectedEmployeeId,
  );
  const derivedRole = selectedEmployee
    ? roleForPosition(selectedEmployee.position)
    : account?.role ?? null;

  useEffect(() => {
    if (!open) return;
    setServerError(null);

    if (account) {
      form.reset({
        employeeId: account.employee_id ? String(account.employee_id) : "",
        username: account.username,
        password: "",
        confirmPassword: "",
      });
    } else {
      const firstAvailable = availableEmployees[0];
      form.reset({
        employeeId: firstAvailable ? String(firstAvailable.id) : "",
        username: "",
        password: "",
        confirmPassword: "",
      });
    }
  }, [account, open]);

  const isSubmitting = form.formState.isSubmitting;

  const handleSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      if (account) {
        await onSaveUpdate({
          employeeId: Number(values.employeeId),
          username: values.username.trim(),
          isActive: account.is_active === 1,
        });
      } else {
        await onSaveCreate({
          employeeId: Number(values.employeeId),
          username: values.username.trim(),
          password: values.password,
          isActive: true,
        });
      }
      onOpenChange(false);
    } catch (error) {
      setServerError(
        getErrorMessage(
          error,
          "Gagal menyimpan akun pengguna. Silakan coba lagi.",
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
        onEscapeKeyDown={(e) => {
          if (isSubmitting) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (isSubmitting) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {account ? "Ubah Akun Login" : "Buat Akun Login"}
          </DialogTitle>
          <DialogDescription>
            Role akun ditentukan otomatis oleh jabatan pegawai yang dipilih.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
            <Label>
              Pegawai <span className="text-destructive">*</span>
            </Label>
            <Controller
              control={form.control}
              name="employeeId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isOwnAccount || availableEmployees.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih pegawai" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableEmployees.map((emp) => (
                      <SelectItem key={emp.id} value={String(emp.id)}>
                        {emp.name} ({emp.position})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.employeeId ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.employeeId.message}
              </p>
            ) : null}
            {!account && availableEmployees.length === 0 ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Semua pegawai aktif sudah memiliki akun. Tambahkan pegawai baru di
                tab Pegawai terlebih dahulu.
              </p>
            ) : null}
          </div>

          {selectedEmployee ? (
            <div className="rounded-lg border bg-muted/40 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Role Otomatis:</span>
                <Badge
                  variant={
                    derivedRole === "admin"
                      ? "default"
                      : derivedRole === "kasir"
                        ? "secondary"
                        : "outline"
                  }
                  className="uppercase tracking-wider"
                >
                  {derivedRole}
                </Badge>
              </div>
              <p className="mt-1.5 text-muted-foreground">
                {positionDescriptions[selectedEmployee.position]}
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="account-username">
              Username <span className="text-destructive">*</span>
            </Label>
            <Input
              id="account-username"
              placeholder="Contoh: kasir1"
              autoFocus={!account}
              {...form.register("username")}
            />
            {form.formState.errors.username ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.username.message}
              </p>
            ) : null}
          </div>

          {!account ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="account-password">
                  Password <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="account-password"
                  type="password"
                  placeholder="Minimal 8 karakter (huruf besar, kecil, angka)"
                  {...form.register("password")}
                />
                {form.formState.errors.password ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.password.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="account-confirm-password">
                  Konfirmasi Password <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="account-confirm-password"
                  type="password"
                  placeholder="Ulangi password"
                  {...form.register("confirmPassword")}
                />
                {form.formState.errors.confirmPassword ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.confirmPassword.message}
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-2.5 text-xs text-muted-foreground">
              <Info className="size-4 shrink-0 text-muted-foreground" />
              <span>
                Password akun tidak diubah melalui form ini. Gunakan tombol{" "}
                <strong className="text-foreground">Ubah Password</strong> di
                header tab Akun untuk mengganti password Anda sendiri.
              </span>
            </div>
          )}

          <DialogFooter>
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
              disabled={isSubmitting || (!account && availableEmployees.length === 0)}
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {account ? "Simpan Perubahan" : "Buat Akun"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
