import { getDatabase } from "@/db/client";
import type { BusinessProfile, Order, OrderItem, Payment } from "@/db/types";

import type { OrderDetail, OrderSummary } from "./types";

type OrderSummaryRow = Order & {
  paid_amount: number;
  item_count: number;
};

const ORDER_SUMMARY_SELECT = `
  SELECT o.*,
         COALESCE(
           (SELECT SUM(p.amount) FROM payments p WHERE p.order_id = o.id),
           0
         ) AS paid_amount,
         (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
  FROM orders o
`;

export const ordersQueryKey = ["transaksi", "orders"] as const;
export const orderDetailQueryKey = (orderId: number) =>
  ["transaksi", "order", orderId] as const;
export const businessProfileQueryKey = ["app", "business-profile"] as const;

function mapOrderSummary(row: OrderSummaryRow): OrderSummary {
  const paidAmount = Number(row.paid_amount);
  const total = Number(row.total);

  return {
    ...row,
    total,
    paid_amount: paidAmount,
    remaining_amount: Math.max(0, total - paidAmount),
    item_count: Number(row.item_count),
  };
}

export async function fetchOrders(): Promise<OrderSummary[]> {
  const db = await getDatabase();
  const rows = await db.select<OrderSummaryRow[]>(
    `${ORDER_SUMMARY_SELECT}
     ORDER BY o.order_date DESC, o.id DESC`,
  );

  return rows.map(mapOrderSummary);
}

export async function fetchOrderDetail(
  orderId: number,
): Promise<OrderDetail | null> {
  const db = await getDatabase();
  const orders = await db.select<OrderSummaryRow[]>(
    `${ORDER_SUMMARY_SELECT}
     WHERE o.id = ?
     LIMIT 1`,
    [orderId],
  );

  const order = orders[0];
  if (!order) return null;

  const [items, payments] = await Promise.all([
    db.select<OrderItem[]>(
      `SELECT * FROM order_items
       WHERE order_id = ?
       ORDER BY id ASC`,
      [orderId],
    ),
    db.select<Payment[]>(
      `SELECT * FROM payments
       WHERE order_id = ?
       ORDER BY paid_at ASC, id ASC`,
      [orderId],
    ),
  ]);

  return {
    ...mapOrderSummary(order),
    items: items.map((item) => ({
      ...item,
      price: Number(item.price),
      qty: Number(item.qty),
      subtotal: Number(item.subtotal),
    })),
    payments: payments.map((payment) => ({
      ...payment,
      amount: Number(payment.amount),
    })),
  };
}

export async function fetchBusinessProfile(): Promise<BusinessProfile | null> {
  const db = await getDatabase();
  const rows = await db.select<BusinessProfile[]>(
    "SELECT * FROM business_profile WHERE id = 1 LIMIT 1",
  );
  return rows[0] ?? null;
}
