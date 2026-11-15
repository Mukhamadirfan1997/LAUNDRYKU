import { Loader2 } from "lucide-react";

import { Logo } from "@/components/brand/Logo";

export function AuthLoadingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-6 text-center">
      <Logo size="lg" showTagline />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-primary" />
        Memeriksa sesi Anda…
      </div>
    </div>
  );
}
