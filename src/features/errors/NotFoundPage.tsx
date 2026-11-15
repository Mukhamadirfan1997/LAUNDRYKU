import { Link } from "@tanstack/react-router";

import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/features/auth/auth-store";
import { getRoleHome } from "@/features/auth/types";
import { useDocumentTitle } from "@/lib/use-document-title";

export function NotFoundPage() {
  const user = useAuthStore((state) => state.user);
  const home = user ? getRoleHome(user.role) : "/";

  useDocumentTitle("Halaman tidak ditemukan");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <Logo size="lg" showTagline />
      <p className="mt-8 text-7xl font-black tracking-tighter text-primary/20">
        404
      </p>
      <h1 className="mt-2 text-xl font-semibold text-foreground">
        Halaman tidak ditemukan
      </h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Menu yang Anda tuju tidak tersedia. Periksa kembali alamat halaman atau
        kembali ke dashboard.
      </p>
      <Button asChild className="mt-6">
        <Link to={home}>Kembali ke halaman utama</Link>
      </Button>
    </div>
  );
}
