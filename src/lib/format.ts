import { format, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";

const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const angkaFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 2,
});

const tanggalFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function toDate(value: string | Date): Date | null {
  const date = value instanceof Date ? value : parseISO(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Rp 10.000 */
export function formatRupiah(value: number): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  return rupiahFormatter.format(safeValue).replace(/\u00A0/g, " ");
}

/** 2,5 */
export function formatAngka(value: number): string {
  return angkaFormatter.format(Number.isFinite(value) ? value : 0);
}

/** 09 November 2026 */
export function formatTanggal(
  value: string | Date | null | undefined,
  fallback = "—",
): string {
  if (!value) return fallback;
  const date = toDate(value);
  return date ? tanggalFormatter.format(date) : fallback;
}

/** 09 Nov 2026 */
export function formatTanggalSingkat(
  value: string | Date | null | undefined,
  fallback = "—",
): string {
  if (!value) return fallback;
  const date = toDate(value);
  return date ? format(date, "d MMM yyyy", { locale: localeId }) : fallback;
}

/** 09 Nov */
export function formatTanggalPendek(
  value: string | Date | null | undefined,
  fallback = "—",
): string {
  if (!value) return fallback;
  const date = toDate(value);
  return date ? format(date, "d MMM", { locale: localeId }) : fallback;
}

/** 09 November 2026, 14.30 */
export function formatTanggalWaktu(
  value: string | Date | null | undefined,
  fallback = "—",
): string {
  if (!value) return fallback;
  const date = toDate(value);
  return date
    ? format(date, "d MMMM yyyy, HH.mm", { locale: localeId })
    : fallback;
}

/** Senin, 09 November 2026 */
export function formatHariTanggal(
  value: string | Date | null | undefined,
  fallback = "—",
): string {
  if (!value) return fallback;
  const date = toDate(value);
  return date
    ? format(date, "EEEE, d MMMM yyyy", { locale: localeId })
    : fallback;
}

/** Tanggal lokal hari ini dalam format YYYY-MM-DD. */
export function todayIso(): string {
  const now = new Date();
  return toIsoDate(now);
}

/** Tanggal lokal dalam format YYYY-MM-DD. */
export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Ukuran file yang ramah dibaca, mis. 1,2 MB. */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** index;
  return `${angkaFormatter.format(value)} ${units[index]}`;
}

/** Inisial nama, maksimal 2 huruf. */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
