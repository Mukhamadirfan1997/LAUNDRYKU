import { Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldX } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { useAuthStore } from "./auth-store";
import { getRoleHome, roleLabels } from "./types";

export function ForbiddenPage() {
  const user = useAuthStore((state) => state.user);
  const home = user ? getRoleHome(user.role) : "/";

  return (
    <div className="flex min-h-[65vh] items-center justify-center py-8">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/15">
            <ShieldX className="size-7" />
          </div>
          <CardTitle className="text-xl">Akses ditolak</CardTitle>
          <CardDescription>
            Role <strong>{user ? roleLabels[user.role] : "Anda"}</strong> tidak
            memiliki izin untuk membuka halaman ini. Hubungi Admin bila Anda
            merasa seharusnya memiliki akses.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button asChild>
            <Link to={home}>
              <ArrowLeft className="size-4" />
              Kembali ke halaman utama
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
