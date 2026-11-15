import { redirect } from "@tanstack/react-router";

import type { UserRole } from "@/db/types";

import { validateSessionRequest } from "./auth-api";
import { useAuthStore } from "./auth-store";
import { getRoleHome } from "./types";

const VALIDATION_INTERVAL_MS = 60_000;

export function isSessionExpired(expiresAt: number | null): boolean {
  if (!expiresAt) return true;
  return expiresAt * 1000 <= Date.now();
}

/**
 * Memastikan token masih valid di Rust. Hasil validasi disimpan maksimal
 * satu menit agar perpindahan menu tidak memanggil backend terus-menerus.
 */
export async function ensureSession(): Promise<void> {
  const state = useAuthStore.getState();

  if (!state.token) {
    throw redirect({ to: "/login" });
  }

  if (isSessionExpired(state.expiresAt)) {
    state.clearSession();
    throw redirect({ to: "/login" });
  }

  const freshlyValidated =
    state.validatedAt !== null &&
    Date.now() - state.validatedAt < VALIDATION_INTERVAL_MS;

  if (state.user && freshlyValidated) return;

  try {
    const validation = await validateSessionRequest(state.token);
    useAuthStore.getState().applyValidation(state.token, validation);
  } catch {
    useAuthStore.getState().clearSession();
    throw redirect({ to: "/login" });
  }
}

export function requireRole(roles: UserRole[]): () => Promise<void> {
  return async () => {
    await ensureSession();
    const user = useAuthStore.getState().user;

    if (!user || !roles.includes(user.role)) {
      throw redirect({ to: "/akses-ditolak" });
    }
  };
}

/** Mencegah pengguna yang sudah login kembali ke halaman login. */
export function redirectAuthenticated(): void {
  const { token, user, expiresAt, validatedAt } = useAuthStore.getState();

  if (!token || !user || !expiresAt || !validatedAt) return;
  if (isSessionExpired(expiresAt)) return;

  throw redirect({ to: getRoleHome(user.role) });
}
