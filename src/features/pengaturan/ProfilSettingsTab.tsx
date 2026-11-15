import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Info,
  Loader2,
  MapPin,
  Monitor,
  Moon,
  Palette,
  Phone,
  Save,
  Store,
  Sun,
  UserRound,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  bootstrapQueryKey,
  fetchBootstrapData,
} from "@/db/queries/bootstrap";
import { useAuthStore } from "@/features/auth/auth-store";
import { reportsQueryKey } from "@/features/laporan/report-queries";
import { getAppInfo, getErrorMessage } from "@/lib/api";
import { formatFileSize, formatTanggalWaktu } from "@/lib/format";
import { cn } from "@/lib/utils";
import { type Theme, useThemeStore } from "@/stores/theme-store";

import { updateBusinessProfileRequest } from "./settings-api";
import {
  fetchDatabaseInfo,
  settingsActivityLogsQueryKey,
  settingsDatabaseInfoQueryKey,
} from "./settings-queries";

const themeOptions: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Terang", icon: Sun },
  { value: "dark", label: "Gelap", icon: Moon },
  { value: "system", label: "Ikuti Sistem", icon: Monitor },
];

const profileSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(2, "Nama usaha minimal 2 karakter.")
    .max(100, "Nama usaha maksimal 100 karakter."),
  ownerName: z
    .string()
    .trim()
    .min(2, "Nama pemilik minimal 2 karakter.")
    .max(100, "Nama pemilik maksimal 100 karakter."),
  address: z
    .string()
    .trim()
    .max(250, "Alamat maksimal 250 karakter."),
  phone: z
    .string()
    .trim()
    .max(30, "No. telepon maksimal 30 karakter."),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const emptyProfile: ProfileFormValues = {
  businessName: "",
  ownerName: "",
  address: "",
  phone: "",
};

export function ProfilSettingsTab() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  const bootstrapQuery = useQuery({
    queryKey: bootstrapQueryKey,
    queryFn: fetchBootstrapData,
  });
  const appInfoQuery = useQuery({
    queryKey: ["app", "info"],
    queryFn: getAppInfo,
  });
  const databaseInfoQuery = useQuery({
    queryKey: settingsDatabaseInfoQueryKey,
    queryFn: fetchDatabaseInfo,
  });

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: emptyProfile,
  });

  useEffect(() => {
    const profile = bootstrapQuery.data?.profile;
    if (!profile) return;
    form.reset({
      businessName: profile.business_name,
      ownerName: profile.owner_name,
      address: profile.address,
      phone: profile.phone,
    });
  }, [bootstrapQuery.data?.profile, form]);

  const mutation = useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      if (!token) throw new Error("Sesi Anda sudah berakhir. Silakan login kembali.");
      await updateBusinessProfileRequest(token, values);
    },
    onSuccess: async () => {
      toast.success("Profil usaha berhasil disimpan.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: bootstrapQueryKey }),
        queryClient.invalidateQueries({ queryKey: reportsQueryKey }),
        queryClient.invalidateQueries({ queryKey: settingsActivityLogsQueryKey }),
      ]);
    },
    onError: (error) => {
      toast.error(
        getErrorMessage(error, "Gagal menyimpan profil usaha. Silakan coba lagi."),
      );
    },
  });

  const profile = bootstrapQuery.data?.profile;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="size-4 text-primary" />
            Profil Usaha
          </CardTitle>
          <CardDescription>
            Data ini tampil pada struk pembayaran dan laporan PDF.
          </CardDescription>
          <CardAction>
            <span className="text-xs text-muted-foreground">
              {profile ? `Diperbarui ${formatTanggalWaktu(profile.updated_at)}` : ""}
            </span>
          </CardAction>
        </CardHeader>
        <CardContent>
          {bootstrapQuery.isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="business-name">
                    <Building2 className="mr-1 inline size-3.5" />
                    Nama usaha
                  </Label>
                  <Input
                    id="business-name"
                    placeholder="Contoh: Laundry Bersih"
                    {...form.register("businessName")}
                  />
                  {form.formState.errors.businessName ? (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.businessName.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="owner-name">
                    <UserRound className="mr-1 inline size-3.5" />
                    Nama pemilik
                  </Label>
                  <Input
                    id="owner-name"
                    placeholder="Nama pemilik usaha"
                    {...form.register("ownerName")}
                  />
                  {form.formState.errors.ownerName ? (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.ownerName.message}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="business-phone">
                  <Phone className="mr-1 inline size-3.5" />
                  No. telepon
                </Label>
                <Input
                  id="business-phone"
                  inputMode="tel"
                  placeholder="Contoh: 0812 3456 7890"
                  {...form.register("phone")}
                />
                {form.formState.errors.phone ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.phone.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="business-address">
                  <MapPin className="mr-1 inline size-3.5" />
                  Alamat
                </Label>
                <Textarea
                  id="business-address"
                  rows={3}
                  placeholder="Alamat lengkap usaha"
                  {...form.register("address")}
                />
                {form.formState.errors.address ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.address.message}
                  </p>
                ) : null}
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Simpan Profil
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="size-4 text-primary" />
              Tampilan
            </CardTitle>
            <CardDescription>
              Pilih tema yang paling nyaman untuk layar Anda.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {themeOptions.map((option) => {
                const Icon = option.icon;
                const active = theme === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTheme(option.value)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-lg border px-3 py-3 text-xs font-medium transition-colors",
                      active
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="size-4 text-primary" />
              Informasi Aplikasi
            </CardTitle>
            <CardDescription>Versi dan identitas aplikasi desktop.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-0">
            <InfoRow label="Aplikasi" value="LaundryKu" />
            <InfoRow
              label="Versi"
              value={appInfoQuery.data?.version ?? "Memuat..."}
            />
            <InfoRow
              label="Identifier"
              value={appInfoQuery.data?.identifier ?? "Memuat..."}
            />
            <InfoRow
              label="File database"
              value={
                databaseInfoQuery.data?.path ??
                appInfoQuery.data?.dbPath ??
                "Memuat..."
              }
            />
            <InfoRow
              label="Ukuran file"
              value={
                databaseInfoQuery.data
                  ? formatFileSize(databaseInfoQuery.data.sizeBytes)
                  : "Memuat..."
              }
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border/60 py-2.5 last:border-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="break-all text-right text-xs font-medium text-foreground">
        {value}
      </span>
    </div>
  );
}
