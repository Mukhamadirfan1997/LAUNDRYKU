export type IsoDateTime = string;
export type IsoDate = string;

export type UserRole = "admin" | "kasir" | "operator";
export type EmployeePosition = "Admin" | "Operator" | "Kasir";
/** Kategori dan kecepatan layanan bebas agar master layanan bisa CRUD penuh. */
export type ServiceCategory = string;
export type ServiceSpeed = string;
export type OrderStatus = "masuk" | "proses" | "selesai";
export type PaymentStatus = "belum_bayar" | "dp" | "lunas";
export type PaymentMethod = "tunai" | "transfer" | "qris";
export type ActivityAction =
  | "login"
  | "logout"
  | "create"
  | "update"
  | "delete"
  | "status_change"
  | "payment"
  | "export"
  | "backup"
  | "restore";

export interface Employee {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  position: EmployeePosition;
  is_active: number;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface User {
  id: number;
  employee_id: number | null;
  username: string;
  password_hash: string;
  role: UserRole;
  is_active: number;
  last_login_at: IsoDateTime | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

/** Data user yang aman dikirim ke frontend (tanpa password_hash). */
export type SafeUser = Omit<User, "password_hash">;

export interface BusinessProfile {
  id: number;
  business_name: string;
  owner_name: string;
  address: string;
  phone: string;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  address: string | null;
  notes: string | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface Item {
  id: number;
  name: string;
  unit: string;
  price: number;
  stock: number;
  is_active: number;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface Service {
  id: number;
  category: ServiceCategory;
  speed: ServiceSpeed;
  unit: string;
  price: number;
  is_active: number;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

/** Nama tampilan layanan, contoh: "Cuci + Setrika - Express". */
export function getServiceName(service: Pick<Service, "category" | "speed">): string {
  return `${service.category} - ${service.speed}`;
}

export interface Order {
  id: number;
  order_number: string;
  customer_id: number | null;
  customer_name: string;
  customer_phone: string;
  order_date: IsoDate;
  status: OrderStatus;
  payment_status: PaymentStatus;
  total: number;
  notes: string | null;
  created_by: number | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface OrderItem {
  id: number;
  order_id: number;
  line_type: "service" | "item";
  service_id: number | null;
  item_id: number | null;
  name_snapshot: string;
  unit: string;
  price: number;
  qty: number;
  subtotal: number;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface Payment {
  id: number;
  order_id: number;
  amount: number;
  method: PaymentMethod;
  paid_at: IsoDateTime;
  note: string | null;
  created_by: number | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface ExpenseCategory {
  id: number;
  name: string;
  is_active: number;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface Expense {
  id: number;
  expense_date: IsoDate;
  category_id: number;
  description: string;
  amount: number;
  created_by: number | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface ActivityLog {
  id: number;
  user_id: number | null;
  user_name: string;
  action: ActivityAction;
  entity: string | null;
  entity_id: number | null;
  description: string;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}
