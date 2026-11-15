import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CreditCard,
  Loader2,
  ReceiptText,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuthStore } from "@/features/auth/auth-store";
import { bootstrapQueryKey } from "@/db/queries/bootstrap";
import type { OrderStatus } from "@/db/types";
import { getErrorMessage } from "@/lib/api";
import {
  formatAngka,
  formatRupiah,
  formatTanggal,
  formatTanggalWaktu,
} from "@/lib/format";
import {
  orderStatusLabels,
  orderStatusOrder,
  paymentMethodLabels,
} from "@/lib/order-labels";

import { OrderStatusBadge, PaymentStatusBadge } from "./OrderStatusBadge";
import { updateOrderStatusRequest } from "./orders-api";
import {
  fetchOrderDetail,
  orderDetailQueryKey,
  ordersQueryKey,
} from "./orders-queries";
import type { OrderSummary } from "./types";

interface OrderDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: number | null;
  onPay: (order: OrderSummary) => void;
  onReceipt: (order: OrderSummary) => void;
}

export function OrderDetailDialog({
  open,
  onOpenChange,
  orderId,
  onPay,
  onReceipt,
}: OrderDetailDialogProps) {
  const role = useAuthStore((state) => state.user?.role ?? null);
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  const canHandlePayment = role === "admin" || role === "kasir";

  const detailQuery = useQuery({
    queryKey: orderDetailQueryKey(orderId ?? 0),
    queryFn: () => fetchOrderDetail(orderId ?? 0),
    enabled: open && Boolean(orderId),
  });

  const order = detailQuery.data ?? null;

  const statusMutation = useMutation({
    mutationFn: async (status: OrderStatus) => {
      if (!token) {
        throw new Error("Sesi Anda tidak valid. Silakan login kembali.");
      }
      if (!orderId) throw new Error("Order tidak ditemukan.");
      await updateOrderStatusRequest(token, orderId, status);
    },
    onSuccess: async (_data, status) => {
      await queryClient.invalidateQueries({ queryKey: ordersQueryKey });
      if (orderId) {
        await queryClient.invalidateQueries({
          queryKey: orderDetailQueryKey(orderId),
        });
      }
      await queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
      toast.success(
        `Status order diubah menjadi ${orderStatusLabels[status]}.`,
      );
    },
    onError: (error) => {
      toast.error(
        getErrorMessage(error, "Gagal mengubah status order."),
      );
    },
  });

  const isPending = statusMutation.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isPending) onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        className="max-w-2xl"
        showCloseButton={!isPending}
        onEscapeKeyDown={(event) => {
          if (isPending) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (isPending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {order ? order.order_number : "Detail Order"}
          </DialogTitle>
          <DialogDescription>
            {order
              ? `${order.customer_name} · ${order.customer_phone}`
              : "Memuat detail transaksi…"}
          </DialogDescription>
        </DialogHeader>

        {detailQuery.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : detailQuery.isError ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-destructive/25 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <p>{getErrorMessage(detailQuery.error)}</p>
          </div>
        ) : !order ? (
          <p className="text-sm text-muted-foreground">
            Order tidak ditemukan. Muat ulang daftar order.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <OrderStatusBadge status={order.status} />
              <PaymentStatusBadge status={order.payment_status} />
              <Badge variant="outline">
                {order.item_count} baris item
              </Badge>
            </div>

            <div className="grid gap-3 rounded-lg bg-muted/40 p-3 text-sm sm:grid-cols-3">
              <div>
                <p className="text-[11px] text-muted-foreground">
                  Tanggal order
                </p>
                <p className="font-medium text-foreground">
                  {formatTanggal(order.order_date)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Dibuat</p>
                <p className="font-medium text-foreground">
                  {formatTanggalWaktu(order.created_at)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">
                  Total tagihan
                </p>
                <p className="font-semibold text-foreground">
                  {formatRupiah(order.total)}
                </p>
              </div>
              {order.notes ? (
                <div className="sm:col-span-3">
                  <p className="text-[11px] text-muted-foreground">Catatan</p>
                  <p className="whitespace-pre-wrap text-sm text-foreground">
                    {order.notes}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Harga</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="whitespace-normal">
                        <p className="font-medium text-foreground">
                          {item.name_snapshot}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {item.line_type === "service" ? "Layanan" : "Barang"}{" "}
                          · per {item.unit}
                        </p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatRupiah(item.price)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatAngka(item.qty)} {item.unit}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatRupiah(item.subtotal)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 rounded-lg border p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Pembayaran
                </p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Dibayar</span>
                  <span className="font-medium text-foreground">
                    {formatRupiah(order.paid_amount)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Sisa</span>
                  <span className="font-semibold text-primary">
                    {formatRupiah(order.remaining_amount)}
                  </span>
                </div>
                <Separator />
                {order.payments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Belum ada pembayaran.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {order.payments.map((payment) => (
                      <div key={payment.id} className="text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-foreground">
                            {paymentMethodLabels[payment.method]}
                          </span>
                          <span className="font-semibold text-foreground">
                            {formatRupiah(payment.amount)}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {formatTanggalWaktu(payment.paid_at)}
                          {payment.note ? ` · ${payment.note}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2 rounded-lg border p-3">
                <Label htmlFor="detail-order-status">Status order</Label>
                <Select
                  value={order.status}
                  onValueChange={(value) =>
                    statusMutation.mutate(value as OrderStatus)
                  }
                  disabled={isPending}
                >
                  <SelectTrigger id="detail-order-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {orderStatusOrder.map((status) => (
                      <SelectItem key={status} value={status}>
                        {orderStatusLabels[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Semua role yang berwenang dapat memperbarui status order.
                </p>
                {isPending ? (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    Menyimpan status…
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Tutup
          </Button>
          {order && canHandlePayment ? (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  onOpenChange(false);
                  onReceipt(order);
                }}
                disabled={isPending}
              >
                <ReceiptText className="size-4" />
                Struk
              </Button>
              <Button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onPay(order);
                }}
                disabled={isPending || order.remaining_amount <= 0}
              >
                <CreditCard className="size-4" />
                {order.remaining_amount <= 0 ? "Sudah lunas" : "Bayar"}
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
