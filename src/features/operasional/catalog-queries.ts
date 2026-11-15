import { getDatabase } from "@/db/client";
import type { Item, Service } from "@/db/types";

export interface ItemWithUsage extends Item {
  /** Jumlah baris order_items yang memakai barang ini. */
  usage_count: number;
}

export interface ServiceWithUsage extends Service {
  /** Jumlah baris order_items yang memakai layanan ini. */
  usage_count: number;
}

export const itemsQueryKey = ["catalog", "items"] as const;
export const servicesQueryKey = ["catalog", "services"] as const;

export async function fetchItems(): Promise<ItemWithUsage[]> {
  const db = await getDatabase();
  const rows = await db.select<ItemWithUsage[]>(
    `SELECT i.*,
            (SELECT COUNT(*) FROM order_items oi WHERE oi.item_id = i.id) AS usage_count
     FROM items i
     ORDER BY i.name COLLATE NOCASE ASC`,
  );

  return rows.map((row) => ({
    ...row,
    usage_count: Number(row.usage_count),
  }));
}

export async function fetchServices(): Promise<ServiceWithUsage[]> {
  const db = await getDatabase();
  const rows = await db.select<ServiceWithUsage[]>(
    `SELECT s.*,
            (SELECT COUNT(*) FROM order_items oi WHERE oi.service_id = s.id) AS usage_count
     FROM services s
     ORDER BY s.category COLLATE NOCASE ASC,
              s.speed COLLATE NOCASE ASC`,
  );

  return rows.map((row) => ({
    ...row,
    usage_count: Number(row.usage_count),
  }));
}
