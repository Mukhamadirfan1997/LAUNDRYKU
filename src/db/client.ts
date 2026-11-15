import Database from "@tauri-apps/plugin-sql";

import { isTauriRuntime } from "@/lib/api";

const DATABASE_URL = "sqlite:laundryku.db";

let databasePromise: Promise<Database> | null = null;

/**
 * Koneksi SQLite tunggal untuk seluruh aplikasi.
 * Database dan migrasi dibuat otomatis oleh tauri-plugin-sql saat pertama dimuat.
 */
export function getDatabase(): Promise<Database> {
  if (!isTauriRuntime()) {
    return Promise.reject(
      new Error(
        "Database lokal hanya tersedia saat aplikasi dijalankan melalui LaundryKu desktop.",
      ),
    );
  }

  if (!databasePromise) {
    databasePromise = Database.load(DATABASE_URL).catch((error: unknown) => {
      databasePromise = null;
      const detail =
        error instanceof Error ? error.message : String(error ?? "tidak diketahui");
      throw new Error(
        `Database LaundryKu gagal dimuat (${detail}). Tutup lalu jalankan ulang aplikasi.`,
      );
    });
  }

  return databasePromise;
}

/** Lokasi file database sebenarnya, dibaca dari SQLite. */
export async function getDatabasePath(): Promise<string> {
  const db = await getDatabase();
  const rows = await db.select<Array<{ seq: number; name: string; file: string }>>(
    "PRAGMA database_list",
  );
  return rows.find((row) => row.name === "main")?.file ?? "—";
}
