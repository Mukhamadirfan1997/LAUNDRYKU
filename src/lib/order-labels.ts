import type {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "@/db/types";

export const orderStatusLabels: Record<OrderStatus, string> = {
  masuk: "Masuk",
  proses: "Proses",
  selesai: "Selesai",
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  belum_bayar: "Belum bayar",
  dp: "DP",
  lunas: "Lunas",
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  tunai: "Tunai",
  transfer: "Transfer",
  qris: "QRIS",
};

export const orderStatusOrder: OrderStatus[] = ["masuk", "proses", "selesai"];
