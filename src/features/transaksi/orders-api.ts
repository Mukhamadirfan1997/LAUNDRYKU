import { invoke } from "@tauri-apps/api/core";

import type { OrderStatus } from "@/db/types";

import type {
  CreateOrderInput,
  CreatedOrderResponse,
  PaymentInput,
} from "./types";

export async function createOrderRequest(
  token: string,
  input: CreateOrderInput,
): Promise<CreatedOrderResponse> {
  return invoke<CreatedOrderResponse>("create_order", {
    token,
    customerId: input.customerId,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    orderDate: input.orderDate,
    notes: input.notes,
    lines: input.lines,
  });
}

export async function updateOrderStatusRequest(
  token: string,
  orderId: number,
  status: OrderStatus,
): Promise<void> {
  return invoke<void>("update_order_status", {
    token,
    orderId,
    status,
  });
}

export async function recordPaymentRequest(
  token: string,
  input: PaymentInput,
): Promise<void> {
  return invoke<void>("record_payment", {
    token,
    orderId: input.orderId,
    amount: input.amount,
    method: input.method,
    note: input.note,
  });
}
