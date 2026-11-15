import { getDatabase } from "@/db/client";

import type { CustomerWithOrderCount } from "./types";

export const customersQueryKey = ["transaksi", "customers"] as const;

export async function fetchCustomers(): Promise<CustomerWithOrderCount[]> {
  const db = await getDatabase();
  const rows = await db.select<CustomerWithOrderCount[]>(
    `SELECT c.*,
            (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS order_count
     FROM customers c
     ORDER BY c.name COLLATE NOCASE ASC`,
  );

  return rows.map((row) => ({
    ...row,
    order_count: Number(row.order_count),
  }));
}
