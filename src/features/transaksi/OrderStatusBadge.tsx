import { Badge } from "@/components/ui/badge";
import type { OrderStatus, PaymentStatus } from "@/db/types";
import {
  orderStatusLabels,
  paymentStatusLabels,
} from "@/lib/order-labels";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const variant =
    status === "selesai"
      ? "success"
      : status === "proses"
        ? "default"
        : "warning";

  return <Badge variant={variant}>{orderStatusLabels[status]}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const variant =
    status === "lunas"
      ? "success"
      : status === "dp"
        ? "warning"
        : "destructive";

  return <Badge variant={variant}>{paymentStatusLabels[status]}</Badge>;
}
