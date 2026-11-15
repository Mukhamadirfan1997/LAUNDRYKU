import { invoke } from "@tauri-apps/api/core";

export interface AppInfo {
  name: string;
  version: string;
  identifier: string;
  dbPath: string;
}

/** Apakah kode berjalan di dalam webview Tauri (bukan browser biasa). */
export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function getAppInfo(): Promise<AppInfo> {
  if (!isTauriRuntime()) {
    return {
      name: "LaundryKu",
      version: __APP_VERSION__,
      identifier: "com.laundryku.app",
      dbPath: "Hanya tersedia di aplikasi desktop",
    };
  }

  return invoke<AppInfo>("app_info");
}

/** Mengubah error apa pun menjadi pesan yang layak ditampilkan ke pengguna. */
export function getErrorMessage(
  error: unknown,
  fallback = "Terjadi kesalahan. Silakan coba lagi.",
): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  const message = raw.trim();
  if (!message) return fallback;

  const lower = message.toLowerCase();

  if (lower.includes("database is locked") || lower.includes("database locked")) {
    return "Database sedang digunakan proses lain. Tutup jendela LaundryKu lain, lalu coba lagi.";
  }
  if (lower.includes("disk is full") || lower.includes("disk full")) {
    return "Penyimpanan perangkat penuh. Kosongkan ruang disk, lalu coba lagi.";
  }
  if (lower.includes("no such table") || lower.includes("no such column")) {
    return "Struktur database tidak cocok. Jalankan ulang aplikasi atau pulihkan dari cadangan.";
  }
  if (lower.includes("not allowed") || lower.includes("permission denied")) {
    return "Akses ditolak. Periksa izin folder atau jalankan aplikasi dengan izin yang sesuai.";
  }
  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return "Koneksi ke database lokal gagal. Pastikan aplikasi dijalankan melalui LaundryKu desktop.";
  }

  return message;
}
