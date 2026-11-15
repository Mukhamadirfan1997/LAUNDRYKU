import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/features/auth/auth-store";
import { bootstrapQueryKey } from "@/db/queries/bootstrap";
import type { OrderStatus } from "@/db/types";
import { getErrorMessage } from "@/lib/api";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { orderStatusLabels, orderStatusOrder } from "@/lib/order-labels";
import { cn } from "@/lib/utils";

import { OrderDetailDialog } from "./OrderDetailDialog";
import { PaymentStatusBadge } from "./OrderStatusBadge";
import { PaymentDialog } from "./PaymentDialog";
import { ReceiptDialog } from "./ReceiptDialog";
import { updateOrderStatusRequest } from "./orders-api";
import {
  fetchOrders,
  orderDetailQueryKey,
  ordersQueryKey,
} from "./orders-queries";
import type { OrderSummary } from "./types";

const columnStyles: Record<OrderStatus, string> = {
  masuk: "border-t-amber-500",
  proses: "border-t-cyan-500",
  selesai: "border-t-emerald-500",
};

const nextStatus: Record<OrderStatus, OrderStatus | null> = {
  masuk: "proses",
  proses: "selesai",
  selesai: null,
};

const nextActionLabel: Record<OrderStatus, string> = {
  masuk: "Mulai Proses",
  proses: "Selesaikan",
  selesai: "",
};

export function StatusOrderPage() {
  const role = useAuthStore((state) => state.user?.role ?? null);
  const token = useAuthStore((state) => state.token);
  const canHandlePayment = role === "admin" || role === "kasir";
  const queryClient = useQueryClient();
  const searchRef = useRef<HTMLInputElement>(null);

  const ordersQuery = useQuery({
    queryKey: ordersQueryKey,
    queryFn: fetchOrders,
  });

  const [search, setSearch] = useState("");
  const [detailOrderId, setDetailOrderId] = useState<number | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<OrderSummary | null>(null);
  const [receiptOrderId, setReceiptOrderId] = useState<number | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!event.ctrlKey || event.altKey || event.metaKey) return;
      if (event.key.toLowerCase() !== "k") return;

      event.preventDefault();
      searchRef.current?.focus();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const statusMutation = useMutation({
    mutationFn: async (input: { order: OrderSummary; status: OrderStatus }) => {
      if (!token) {
        throw new Error("Sesi Anda tidak valid. Silakan login kembali.");
      }
      await updateOrderStatusRequest(token, input.order.id, input.status);
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ordersQueryKey });
      await queryClient.invalidateQueries({
        queryKey: orderDetailQueryKey(variables.order.id),
      });
      await queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
      toast.success(
        `Order ${variables.order.order_number} menjadi ${orderStatusLabels[variables.status]}.`,
      );
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Gagal mengubah status order."));
    },
  });

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = ordersQuery.data ?? [];
    if (!query) return rows;

    return rows.filter(
      (order) =>
        order.order_number.toLowerCase().includes(query) ||
        order.customer_name.toLowerCase().includes(query) ||
        order.customer_phone.toLowerCase().includes(query),
    );
  }, [ordersQuery.data, search]);

  const columns = useMemo(
    () =>
      orderStatusOrder.map((status) => ({
        status,
        orders: filteredOrders.filter((order) => order.status === status),
      })),
    [filteredOrders],
  );

  return (
    <>
      <PageHeader
        title="Status Order"
        description="Papan kanban alur order: Masuk, Proses, lalu Selesai."
        actions={
          canHandlePayment ? (
            <Button asChild>
              <Link to="/transaksi/baru">
                <Plus className="size-4" />
                Transaksi Baru
              </Link>
            </Button>
          ) : (
            <Badge variant="secondary">
              <CheckCircle2 className="size-3.5" />
              Ubah status order
            </Badge>
          )
        }
      />

      <Card className="mb-4 gap-0 py-0">
        <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nomor order, pelanggan, atau HP… (Ctrl+K)"
              className="pl-9"
              aria-label="Cari order pada papan status"
              aria-keyshortcuts="Control+K"
            />
          </div>
          <Badge variant="outline" className="w-fit">
            {filteredOrders.length} order ditampilkan
          </Badge>
        </CardContent>
      </Card>

      {ordersQuery.isError ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <TriangleAlert className="size-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">
                Gagal memuat papan status
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {getErrorMessage(ordersQuery.error)}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => void ordersQuery.refetch()}
              disabled={ordersQuery.isFetching}
            >
              <RefreshCw
                className={
                  ordersQuery.isFetching ? "size-4 animate-spin" : "size-4"
                }
              />
              Coba lagi
            </Button>
          </CardContent>
        </Card>
      ) : ordersQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {columns.map((column) => (
            <Card
              key={column.status}
              className={cn(
                "min-w-[290px] flex-1 gap-0 border-t-4 py-0",
                columnStyles[column.status],
              )}
            >
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {orderStatusLabels[column.status]}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {column.orders.length} order
                  </p>
                </div>
                <Badge variant="outline">{column.orders.length}</Badge>
              </div>
              <CardContent className="space-y-3 p-3">
                {column.orders.length === 0 ? (
                  <EmptyState
                    icon={Search}
                    title="Tidak ada order"
                    description={
                      search.trim()
                        ? "Tidak ada order yang cocok dengan pencarian."
                        : "Order akan muncul di kolom ini."
                    }
                    className="border-0 bg-transparent px-3 py-6"
                  />
                ) : (
                  column.orders.map((order) => {
                    const next = nextStatus[order.status];
                    const isUpdating =
                      statusMutation.isPending &&
                      statusMutation.variables?.order.id === order.id;

                    return (
                      <div
                        key={order.id}
                        className="rounded-lg border bg-background p-3 shadow-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            className="min-w-0 text-left"
                            onClick={() => setDetailOrderId(order.id)}
                          >
                            <p className="font-mono text-xs font-semibold text-foreground">
                              {order.order_number}
                            </p>
                            <p className="mt-1 truncate text-sm font-medium text-foreground">
                              {order.customer_name}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {order.customer_phone} ·{" "}
                              {formatTanggal(order.order_date)}
                            </p>
                          </button>
                          <PaymentStatusBadge status={order.payment_status} />
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 rounded-md bg-muted/45 px-2.5 py-2 text-xs">
                          <div>
                            <p className="text-[10px] text-muted-foreground">
                              Total
                            </p>
                            <p className="font-semibold text-foreground">
                              {formatRupiah(order.total)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-muted-foreground">
                              Sisa
                            </p>
                            <p className="font-semibold text-primary">
                              {formatRupiah(order.remaining_amount)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>{order.item_count} baris item</span>
                          <button
                            type="button"
                            className="font-medium text-primary hover:underline"
                            onClick={() => setDetailOrderId(order.id)}
                          >
                            Detail
                          </button>
                        </div>

                        {next ? (
                          <Button
                            type="button"
                            size="sm"
                            className="mt-3 w-full"
                            onClick={() =>
                              statusMutation.mutate({
                                order,
                                status: next,
                              })
                            }
                            disabled={isUpdating}
                          >
                            {isUpdating ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <ArrowRight className="size-3.5" />
                            )}
                            {nextActionLabel[order.status]}
                          </Button>
                        ) : (
                          <div className="mt-3 flex items-center justify-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="size-3.5" />
                            Order selesai
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <OrderDetailDialog
        open={detailOrderId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailOrderId(null);
        }}
        orderId={detailOrderId}
        onPay={(order) => setPaymentOrder(order)}
        onReceipt={(order) => setReceiptOrderId(order.id)}
      />

      <PaymentDialog
        open={paymentOrder !== null}
        onOpenChange={(open) => {
          if (!open) setPaymentOrder(null);
        }}
        order={paymentOrder}
      />

      <ReceiptDialog
        open={receiptOrderId !== null}
        onOpenChange={(open) => {
          if (!open) setReceiptOrderId(null);
        }}
        orderId={receiptOrderId}
      />
    </>
  );
}
