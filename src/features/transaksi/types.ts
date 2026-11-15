import type {
  Customer,
  Order,
  OrderItem,
  Payment,
  PaymentMethod,
} from "@/db/types";

export interface CustomerWithOrderCount extends Customer {
  order_count: number;
}

export interface OrderSummary extends Order {
  paid_amount: number;
  remaining_amount: number;
  item_count: number;
}

export interface OrderDetail extends OrderSummary {
  items: OrderItem[];
  payments: Payment[];
}

export interface OrderLineInput {
  lineType: "service" | "item";
  refId: number;
  price: number;
  qty: number;
}

export interface CreateOrderInput {
  customerId: number | null;
  customerName: string;
  customerPhone: string;
  orderDate: string;
  notes: string | null;
  lines: OrderLineInput[];
}

export interface CreatedOrderResponse {
  id: number;
  orderNumber: string;
}

export interface PaymentInput {
  orderId: number;
  amount: number;
  method: PaymentMethod;
  note: string | null;
}
