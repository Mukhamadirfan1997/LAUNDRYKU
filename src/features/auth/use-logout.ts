import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { logoutRequest } from "./auth-api";
import { useAuthStore } from "./auth-store";

/** Logout terpusat: hapus sesi Rust, bersihkan cache, lalu kembali ke login. */
export function useLogout(): () => Promise<void> {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const clearSession = useAuthStore((state) => state.clearSession);

  return async () => {
    try {
      if (token) await logoutRequest(token);
    } catch (error) {
      console.warn("Gagal menghapus sesi di backend:", error);
    } finally {
      clearSession();
      queryClient.clear();
      toast.success("Anda telah keluar dari LaundryKu.");
      await navigate({ to: "/login", replace: true });
    }
  };
}
