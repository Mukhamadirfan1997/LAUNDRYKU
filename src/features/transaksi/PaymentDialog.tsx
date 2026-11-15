import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, TriangleAlert, Wallet } from "lucide-react";
import { toast } from "sonner";

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
import { useAuthStore } from "@/features/auth/auth-store";
import { bootstrapQueryKey } from "@/db/queries/bootstrap";
import type { PaymentMethod } from "@/db/types";
import { getErrorMessage } from "@/lib/api";
import { formatRupiah } from "@/lib/format";

import { recordPaymentRequest } from "./orders-api";
import { orderDetailQueryKey, ordersQueryKey } from "./orders-queries";
import type { OrderSummary } from "./types";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrderSummary | null;
}

export function PaymentDialog({
  open,
  onOpenChange,
  order,
}: PaymentDialogProps) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("tunai");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAmount(order ? String(order.remaining_amount) : "");
    setMethod("tunai");
    setNote("");
    setFormError(null);
  }, [open, order]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!token) {
        throw new Error("Sesi Anda tidak valid. Silakan login kembali.");
      }
      if (!order) {
        throw new Error("Order tidak ditemukan.");
      }

      const nominal = Number(amount);
      if (!Number.isInteger(nominal) || nominal <= 0) {
        throw new Error("Nominal pembayaran harus berupa angka bulat lebih dari 0.");
      }
      if (nominal > order.remaining_amount) {
        throw new Error(
          `Nominal melebihi sisa tagihan (${formatRupiah(order.remaining_amount)}).`,
        );
      }

      await recordPaymentRequest(token, {
        orderId: order.id,
        amount: nominal,
        method,
        note: note.trim() ? note.trim() : null,
      });
    },
    onSuccess: async () => {
      if (!order) return;
      await queryClient.invalidateQueries({ queryKey: ordersQueryKey });
      await queryClient.invalidateQueries({
        queryKey: orderDetailQueryKey(order.id),
      });
      await queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
      toast.success("Pembayaran berhasil dicatat.");
      onOpenChange(false);
    },
    onError: (error) => {
      setFormError(
        getErrorMessage(error, "Gagal mencatat pembayaran. Silakan coba lagi."),
      );
    },
  });

  const isSubmitting = mutation.isPending;
  const remaining = order?.remaining_amount ?? 0;

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
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="size-5 text-primary" />
            Catat Pembayaran
          </DialogTitle>
          <DialogDescription>
            {order
              ? `${order.order_number} · ${order.customer_name}`
              : "Pilih order yang akan dibayar."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-3 text-sm">
          <div>
            <p className="text-[11px] text-muted-foreground">Total tagihan</p>
            <p className="font-semibold text-foreground">
              {formatRupiah(order?.total ?? 0)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground">Sisa bayar</p>
            <p className="font-semibold text-primary">
              {formatRupiah(remaining)}
            </p>
          </div>
        </div>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setFormError(null);
            mutation.mutate();
          }}
          noValidate
        >
          {formError ? (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-destructive/25 bg-destructive/10 px-3.5 py-3 text-sm text-destructive"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <p className="leading-relaxed">{formError}</p>
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="payment-amount">
                Nominal <span className="text-destructive">*</span>
              </Label>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => setAmount(String(remaining))}
                disabled={remaining <= 0 || isSubmitting}
              >
                Isi sisa tagihan
              </Button>
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                Rp
              </span>
              <Input
                id="payment-amount"
                value={amount}
                onChange={(event) => {
                  if (/^\d*$/.test(event.target.value)) {
                    setAmount(event.target.value);
                  }
                }}
                inputMode="numeric"
                className="pl-9 text-right font-semibold"
                disabled={isSubmitting}
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Metode pembayaran</Label>
            <Select
              value={method}
              onValueChange={(value) => setMethod(value as PaymentMethod)}
              disabled={isSubmitting}
            >
              <SelectTrigger aria-label="Metode pembayaran">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tunai">Tunai</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
                <SelectItem value="qris">QRIS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-note">Catatan pembayaran</Label>
            <Textarea
              id="payment-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Opsional, misalnya nomor referensi transfer."
              maxLength={250}
              className="min-h-16"
              disabled={isSubmitting}
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
            <Button
              type="submit"
              disabled={isSubmitting || remaining <= 0}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Menyimpan…
                </>
              ) : (
                "Simpan Pembayaran"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
