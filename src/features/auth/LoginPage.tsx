import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import {
  Eye,
  EyeOff,
  Fingerprint,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  WashingMachine,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage, isTauriRuntime } from "@/lib/api";
import { useDocumentTitle } from "@/lib/use-document-title";

import { loginRequest } from "./auth-api";
import { useAuthStore } from "./auth-store";
import { getDisplayName, getRoleHome } from "./types";

const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Username wajib diisi.")
    .max(50, "Username maksimal 50 karakter."),
  password: z
    .string()
    .min(1, "Password wajib diisi.")
    .max(200, "Password terlalu panjang."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const trustPoints = [
  {
    icon: ShieldCheck,
    title: "Login diverifikasi Rust",
    description: "Password diperiksa dengan Argon2id, bukan di browser.",
  },
  {
    icon: Fingerprint,
    title: "Sesi 8 jam",
    description: "Token acak disimpan di memori aplikasi dan berakhir otomatis.",
  },
  {
    icon: LockKeyhole,
    title: "Akses sesuai role",
    description: "Menu dan halaman dilindungi sesuai Admin, Kasir, atau Operator.",
  },
];

export function LoginPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  useDocumentTitle("Masuk");

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const isSubmitting = form.formState.isSubmitting;

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);

    if (!isTauriRuntime()) {
      setServerError(
        "Login hanya tersedia di aplikasi desktop LaundryKu, bukan di browser biasa.",
      );
      return;
    }

    try {
      const response = await loginRequest(values.username.trim(), values.password);
      useAuthStore.getState().setSession(response);
      toast.success(`Selamat datang, ${getDisplayName(response.user)}.`);
      await navigate({ to: getRoleHome(response.user.role) });
    } catch (error) {
      setServerError(
        getErrorMessage(error, "Login gagal. Periksa username dan password Anda."),
      );
    }
  });

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(6,182,212,0.28),transparent_34%),radial-gradient(circle_at_85%_80%,rgba(20,184,166,0.22),transparent_36%)]"
      />

      <div className="absolute right-4 top-4 z-20 rounded-lg border bg-background/90 shadow-sm backdrop-blur-sm">
        <ThemeToggle />
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-[1440px] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden flex-col justify-between px-12 py-12 text-white lg:flex xl:px-16">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-white/10 text-cyan-100 shadow-lg ring-1 ring-inset ring-white/20">
              <WashingMachine className="size-7" />
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight">
                Laundry<span className="text-cyan-300">Ku</span>
              </p>
              <p className="text-xs text-cyan-100/75">
                Kelola laundry, catat kas, tanpa ribet
              </p>
            </div>
          </div>

          <div className="max-w-xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
              <ShieldCheck className="size-3.5" />
              Akses terproteksi
            </p>
            <h1 className="text-4xl font-black leading-[1.1] tracking-tight xl:text-5xl">
              Kasir rapi,
              <br />
              laporan jelas,
              <br />
              <span className="text-cyan-300">akses tetap aman.</span>
            </h1>
            <p className="mt-5 max-w-lg text-sm leading-relaxed text-slate-300">
              Setiap tindakan penting tercatat. Hanya pengguna dengan role yang
              sesuai dapat membuka data operasional dan keuangan laundry Anda.
            </p>

            <div className="mt-9 grid gap-4">
              {trustPoints.map((point) => {
                const Icon = point.icon;
                return (
                  <div key={point.title} className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-cyan-200 ring-1 ring-inset ring-white/15">
                      <Icon className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {point.title}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
                        {point.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Data tersimpan lokal di perangkat Anda · LaundryKu v
            {__APP_VERSION__}
          </p>
        </section>

        <section className="flex items-center justify-center px-4 py-14 sm:px-8">
          <div className="w-full max-w-md">
            <Card className="border-white/10 bg-card/95 shadow-2xl shadow-black/25 backdrop-blur">
              <CardHeader>
                <div className="mb-3">
                  <Logo size="lg" showTagline />
                </div>
                <CardTitle className="text-2xl">Masuk ke LaundryKu</CardTitle>
                <CardDescription>
                  Gunakan akun yang diberikan Admin untuk membuka aplikasi.
                </CardDescription>
              </CardHeader>

              <CardContent>
                {serverError ? (
                  <div
                    role="alert"
                    className="mb-5 flex items-start gap-2.5 rounded-lg border border-destructive/25 bg-destructive/10 px-3.5 py-3 text-sm text-destructive"
                  >
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                    <p className="leading-relaxed">{serverError}</p>
                  </div>
                ) : null}

                <form onSubmit={onSubmit} className="space-y-5" noValidate>
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <div className="relative">
                      <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="username"
                        autoComplete="username"
                        autoFocus
                        placeholder="Masukkan username"
                        className="h-10 pl-9"
                        aria-invalid={Boolean(form.formState.errors.username)}
                        disabled={isSubmitting}
                        {...form.register("username")}
                      />
                    </div>
                    {form.formState.errors.username ? (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.username.message}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="Masukkan password"
                        className="h-10 pl-9 pr-10"
                        aria-invalid={Boolean(form.formState.errors.password)}
                        disabled={isSubmitting}
                        {...form.register("password")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((visible) => !visible)}
                        className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={
                          showPassword
                            ? "Sembunyikan password"
                            : "Tampilkan password"
                        }
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                    {form.formState.errors.password ? (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.password.message}
                      </p>
                    ) : null}
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Memeriksa akun…
                      </>
                    ) : (
                      "Masuk"
                    )}
                  </Button>
                </form>

                {import.meta.env.DEV ? (
                  <div className="mt-5 rounded-lg border border-dashed bg-muted/40 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      Mode pengembangan:
                    </span>{" "}
                    akun awal <code className="font-semibold">admin</code> /{" "}
                    <code className="font-semibold">Admin123!</code>. Ganti
                    password sebelum aplikasi dipakai.
                  </div>
                ) : null}

                <p className="mt-5 text-center text-[11px] leading-relaxed text-muted-foreground">
                  Sesi disimpan di memori aplikasi dan berakhir otomatis setelah
                  8 jam.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
