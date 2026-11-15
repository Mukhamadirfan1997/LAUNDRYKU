import { documentDir, join } from "@tauri-apps/api/path";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";

import { isTauriRuntime } from "./api";

export interface SaveFileFilter {
  name: string;
  extensions: string[];
}

export interface SaveFileOptions {
  defaultFileName: string;
  filters?: SaveFileFilter[];
}

function safeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim() || "LaundryKu";
}

/**
 * Menyimpan file melalui dialog Save As lalu menulis isi file dengan plugin fs.
 * Mengembalikan `null` bila pengguna membatalkan dialog.
 */
export async function saveFileWithDialog(
  contents: Uint8Array,
  options: SaveFileOptions,
): Promise<string | null> {
  if (!isTauriRuntime()) {
    throw new Error(
      "Penyimpanan file hanya tersedia saat aplikasi dijalankan melalui LaundryKu desktop.",
    );
  }

  const fileName = safeFileName(options.defaultFileName);
  let defaultPath = fileName;

  try {
    const documentFolder = await documentDir();
    if (documentFolder) {
      defaultPath = await join(documentFolder, fileName);
    }
  } catch {
    // Dialog tetap bisa dibuka dengan nama file saja bila folder default tidak tersedia.
  }

  const selectedPath = await save({
    defaultPath,
    filters: options.filters ?? [
      { name: "Berkas PDF", extensions: ["pdf"] },
    ],
  });

  if (!selectedPath) return null;

  try {
    await writeFile(selectedPath, contents);
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : String(error ?? "");
    const lower = detail.toLowerCase();

    if (lower.includes("denied") || lower.includes("not allowed")) {
      throw new Error(
        "Tidak memiliki izin menulis ke folder tersebut. Pilih folder lain atau periksa izin akses file.",
      );
    }
    if (lower.includes("disk") || lower.includes("space")) {
      throw new Error(
        "Penyimpanan perangkat penuh. Kosongkan ruang disk, lalu coba lagi.",
      );
    }
    if (lower.includes("locked") || lower.includes("in use")) {
      throw new Error(
        "File sedang dipakai aplikasi lain. Tutup file tersebut atau pilih nama file lain.",
      );
    }

    throw new Error(
      "File tidak dapat disimpan. Periksa izin folder, ruang disk, atau pilih lokasi lain.",
    );
  }

  return selectedPath;
}

/** Membuka file hasil ekspor memakai aplikasi bawaan sistem. */
export async function openSavedFile(path: string): Promise<void> {
  if (!isTauriRuntime()) return;
  await openPath(path);
}

/** Membuka folder dan menyorot file hasil ekspor di File Explorer. */
export async function revealSavedFile(path: string): Promise<void> {
  if (!isTauriRuntime()) return;
  await revealItemInDir(path);
}

/** Menampilkan notifikasi sistem setelah file berhasil disimpan. */
export async function notifyFileSaved(
  title: string,
  body: string,
): Promise<void> {
  if (!isTauriRuntime()) return;

  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      granted = (await requestPermission()) === "granted";
    }
    if (granted) {
      sendNotification({ title, body });
    }
  } catch (error) {
    console.warn("Notifikasi sistem tidak dapat ditampilkan:", error);
  }
}
