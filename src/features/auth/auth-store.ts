import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { LoginResponse, SessionUser, SessionValidation } from "./types";

interface AuthState {
  token: string | null;
  user: SessionUser | null;
  /** Unix timestamp dalam detik dari Rust. */
  expiresAt: number | null;
  /** Kapan sesi terakhir diverifikasi ke Rust (epoch ms); tidak dipersist. */
  validatedAt: number | null;
  setSession: (response: LoginResponse) => void;
  applyValidation: (token: string, validation: SessionValidation) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      expiresAt: null,
      validatedAt: null,
      setSession: (response) =>
        set({
          token: response.token,
          user: response.user,
          expiresAt: response.expiresAt,
          validatedAt: Date.now(),
        }),
      applyValidation: (token, validation) =>
        set({
          token,
          user: validation.user,
          expiresAt: validation.expiresAt,
          validatedAt: Date.now(),
        }),
      clearSession: () =>
        set({
          token: null,
          user: null,
          expiresAt: null,
          validatedAt: null,
        }),
    }),
    {
      name: "laundryku-session",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        expiresAt: state.expiresAt,
      }),
    },
  ),
);
