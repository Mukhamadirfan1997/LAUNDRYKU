import { useState } from "react";
import {
  type ErrorComponentProps,
  Link,
  useRouter,
} from "@tanstack/react-router";
import { Home, RefreshCw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuthStore } from "@/features/auth/auth-store";
import { getRoleHome } from "@/features/auth/types";
import { getErrorMessage } from "@/lib/api";

/**
 * Batas kesalahan (error boundary) untuk seluruh route. Detail teknis hanya
 * dicatat ke konsol; pengguna melihat pesan Indonesia dan tombol pemulihan.
 */
export function RouteErrorPage({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [retrying, setRetrying] = useState(false);
  const home = user ? getRoleHome(user.role) : "/login";

  console.error("Kesalahan halaman:", error);

  const handleRetry = async (): Promise<void> => {
    setRetrying(true);
    try {
      reset();
      await router.invalidate();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="flex min-h-[65vh] items-center justify-center py-8">
      <Card className="w-full max-w-lg border-destructive/30">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/15">
            <TriangleAlert className="size-7" />
          </div>
          <CardTitle className="text-xl">Halaman gagal dimuat</CardTitle>
          <CardDescription>
            {getErrorMessage(
              error,
              "Terjadi kesalahan saat membuka halaman ini. Coba muat ulang halaman atau kembali ke menu utama.",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col justify-center gap-2 sm:flex-row">
          <Button onClick={() => void handleRetry()} disabled={retrying}>
            <RefreshCw className={retrying ? "size-4 animate-spin" : "size-4"} />
            {retrying ? "Memuat ulang…" : "Coba lagi"}
          </Button>
          <Button asChild variant="outline">
            <Link to={home}>
              <Home className="size-4" />
              Kembali ke halaman utama
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
