import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Loader2, TriangleAlert } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
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
import { useAuthStore } from "@/features/auth/auth-store";
import { getErrorMessage } from "@/lib/api";

import { changePasswordRequest } from "./settings-api";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Password saat ini wajib diisi."),
    newPassword: z
      .string()
      .min(8, "Password baru minimal 8 karakter.")
      .max(72, "Password baru maksimal 72 karakter.")
      .regex(/[A-Z]/, "Password harus memuat huruf besar.")
      .regex(/[a-z]/, "Password harus memuat huruf kecil.")
      .regex(/[0-9]/, "Password harus memuat angka."),
    confirmNewPassword: z
      .string()
      .min(1, "Konfirmasi password baru wajib diisi."),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Konfirmasi password tidak cocok.",
    path: ["confirmNewPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "Password baru harus berbeda dari password saat ini.",
    path: ["newPassword"],
  });

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangePasswordDialog({
  open,
  onOpenChange,
}: ChangePasswordDialogProps) {
  const token = useAuthStore((state) => state.token);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  const isSubmitting = form.formState.isSubmitting;

  const handleSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    if (!token) {
      toast.error("Sesi Anda sudah berakhir. Silakan login kembali.");
      return;
    }

    try {
      await changePasswordRequest(
        token,
        values.currentPassword,
        values.newPassword,
      );
      toast.success("Password Anda berhasil diganti.");
      form.reset();
      onOpenChange(false);
    } catch (error) {
      setServerError(
        getErrorMessage(error, "Gagal mengganti password. Silakan coba lagi."),
      );
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSubmitting) {
          if (!nextOpen) {
            form.reset();
            setServerError(null);
          }
          onOpenChange(nextOpen);
        }
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
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-4 text-primary" />
            Ubah Password
          </DialogTitle>
          <DialogDescription>
            Ganti password login akun Anda. Pastikan password baru mudah Anda
            ingat dan sulit ditebak orang lain.
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
            <Label htmlFor="current-password">
              Password saat ini <span className="text-destructive">*</span>
            </Label>
            <Input
              id="current-password"
              type="password"
              placeholder="Masukkan password saat ini"
              autoFocus
              {...form.register("currentPassword")}
            />
            {form.formState.errors.currentPassword ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.currentPassword.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">
              Password baru <span className="text-destructive">*</span>
            </Label>
            <Input
              id="new-password"
              type="password"
              placeholder="Minimal 8 karakter (huruf besar, kecil, angka)"
              {...form.register("newPassword")}
            />
            {form.formState.errors.newPassword ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.newPassword.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-new-password">
              Konfirmasi password baru <span className="text-destructive">*</span>
            </Label>
            <Input
              id="confirm-new-password"
              type="password"
              placeholder="Ulangi password baru"
              {...form.register("confirmNewPassword")}
            />
            {form.formState.errors.confirmNewPassword ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.confirmNewPassword.message}
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
              Simpan Password Baru
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
