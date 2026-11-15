import { useEffect } from "react";

/**
 * Menyamakan judul jendela dengan halaman yang sedang dibuka.
 * Judul selalu diakhiri nama aplikasi agar mudah dikenali di taskbar.
 */
export function useDocumentTitle(title?: string | null): void {
  useEffect(() => {
    document.title = title ? `${title} · LaundryKu` : "LaundryKu";
  }, [title]);
}
