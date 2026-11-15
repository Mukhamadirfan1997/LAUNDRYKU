import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Clock,
  Database,
  Info,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Store,
  Wallet,
  WashingMachine,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/features/auth/auth-store";
import {
  bootstrapQueryKey,
  fetchBootstrapData,
} from "@/db/queries/bootstrap";
import { getAppInfo, getErrorMessage } from "@/lib/api";
import {
  formatHariTanggal,
  formatRupiah,
  formatTanggalPendek,
  todayIso,
  toIsoDate,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { quickAccess } from "@/components/layout/nav-config";

interface ChartPoint {
  date: string;
  label: string;
  total: number;
}

function buildLastSevenDays(): ChartPoint[] {
  const points: ChartPoint[] = [];
  const today = new Date();

  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const iso = toIsoDate(date);
    points.push({
      date: iso,
      label: formatTanggalPendek(iso),
      total: 0,
    });
  }

  return points;
}

type StatTone = "emerald" | "cyan" | "amber" | "teal";

const toneStyles: Record<StatTone, string> = {
  emerald:
    "bg-emerald-500/10 text-emerald-600 ring-emerald-500/15 dark:text-emerald-400",
  cyan: "bg-cyan-500/10 text-cyan-600 ring-cyan-500/15 dark:text-cyan-400",
  amber:
    "bg-amber-500/10 text-amber-600 ring-amber-500/15 dark:text-amber-400",
  teal: "bg-teal-500/10 text-teal-600 ring-teal-500/15 dark:text-teal-400",
};

interface StatusRowProps {
  icon: typeof Database;
  label: string;
  value: string;
  ok: boolean;
  hint?: string;
}

function StatusRow({ icon: Icon, label, value, ok, hint }: StatusRowProps) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
          ok
            ? "bg-emerald-500/10 text-emerald-600 ring-emerald-500/15 dark:text-emerald-400"
            : "bg-amber-500/10 text-amber-600 ring-amber-500/15 dark:text-amber-400",
        )}
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-foreground">{label}</p>
          {ok ? (
            <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
          ) : (
            <CircleAlert className="size-3.5 shrink-0 text-amber-500" />
          )}
        </div>
        <p className="truncate text-[11px] text-muted-foreground" title={value}>
          {value}
        </p>
        {hint ? (
          <p className="truncate text-[10px] text-muted-foreground/70">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-40 w-full rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </div>
  );
}

export function DashboardPage() {
  const role = useAuthStore((state) => state.user?.role ?? null);
  const bootstrap = useQuery({
    queryKey: bootstrapQueryKey,
    queryFn: fetchBootstrapData,
  });
  const appInfo = useQuery({
    queryKey: ["app", "info"] as const,
    queryFn: getAppInfo,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const chartData = useMemo(() => {
    const points = buildLastSevenDays();
    const totals = new Map(
      (bootstrap.data?.revenueLast7Days ?? []).map((row) => [row.date, row.total]),
    );

    return points.map((point) => ({
      ...point,
      total: totals.get(point.date) ?? 0,
    }));
  }, [bootstrap.data?.revenueLast7Days]);
  const profile = bootstrap.data?.profile ?? null;
  const counts = bootstrap.data?.counts;
  const totalRevenue = chartData.reduce((total, point) => total + point.total, 0);
  const visibleQuickAccess = role
    ? quickAccess.filter((item) => item.roles.includes(role))
    : [];

  if (bootstrap.isLoading) {
    return <DashboardSkeleton />;
  }

  if (bootstrap.isError) {
    return (
      <div className="mx-auto max-w-3xl py-8">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <Database className="size-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">
                Database belum dapat diakses
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {getErrorMessage(bootstrap.error)}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => void bootstrap.refetch()}
              disabled={bootstrap.isRefetching}
            >
              <RefreshCw
                className={cn("size-4", bootstrap.isRefetching && "animate-spin")}
              />
              Coba lagi
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeServices = counts?.activeServices ?? 0;
  const totalServices = counts?.totalServices ?? 0;

  const stats: Array<{
    label: string;
    value: string;
    hint: string;
    icon: typeof Wallet;
    tone: StatTone;
  }> = [
    {
      label: "Pendapatan hari ini",
      value: formatRupiah(counts?.revenueToday ?? 0),
      hint: "Dari pembayaran tercatat",
      icon: Wallet,
      tone: "emerald",
    },
    {
      label: "Order hari ini",
      value: `${counts?.ordersToday ?? 0} order`,
      hint: formatHariTanggal(todayIso()),
      icon: ClipboardList,
      tone: "cyan",
    },
    {
      label: "Order belum selesai",
      value: `${counts?.unfinishedOrders ?? 0} order`,
      hint: "Status masuk & proses",
      icon: Clock,
      tone: "amber",
    },
    {
      label: "Layanan aktif",
      value: `${activeServices} / ${totalServices}`,
      hint: "Master layanan siap dipakai",
      icon: Sparkles,
      tone: "teal",
    },
  ];

  return (
    <div className="space-y-5">
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-cyan-600 via-teal-600 to-cyan-800 py-0 text-white shadow-lg shadow-cyan-900/10">
        <div className="absolute inset-0 bg-soft-grid opacity-20" />
        <div className="absolute -right-16 -top-20 size-56 rounded-full bg-white/10 blur-2xl" />
        <CardContent className="relative flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-inset ring-white/25 backdrop-blur-sm">
              <WashingMachine className="size-7" />
            </div>
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <Badge className="border-white/20 bg-white/15 text-[10px] text-white hover:bg-white/15">
                  Offline-first
                </Badge>
                <Badge className="border-white/20 bg-white/15 text-[10px] text-white hover:bg-white/15">
                  SQLite lokal
                </Badge>
              </div>
              <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">
                {profile?.business_name ?? "LaundryKu"}
              </h1>
              <p className="mt-1 max-w-md text-sm text-cyan-50/90">
                Kelola laundry, catat kas, tanpa ribet.
              </p>
              <p className="mt-1 text-[11px] text-cyan-100/75">
                {profile?.owner_name
                  ? `Pemilik: ${profile.owner_name}`
                  : "Lengkapi profil usaha di menu Pengaturan"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              asChild
              className="bg-white text-cyan-800 shadow-sm hover:bg-cyan-50"
            >
              <Link to="/transaksi/baru" aria-keyshortcuts="Control+N">
                Transaksi Baru
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            {role === "admin" ? (
              <Button
                asChild
                variant="ghost"
                className="border border-white/25 text-white hover:bg-white/10 hover:text-white"
              >
                <Link to="/laporan">Lihat Laporan</Link>
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="gap-0 py-0">
              <CardContent className="flex items-start justify-between gap-3 p-5">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className="mt-1 truncate text-2xl font-bold tracking-tight text-foreground">
                    {stat.value}
                  </p>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">
                    {stat.hint}
                  </p>
                </div>
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
                    toneStyles[stat.tone],
                  )}
                >
                  <Icon className="size-5" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Pendapatan 7 Hari Terakhir</CardTitle>
            <CardDescription>
              Total pembayaran yang tercatat setiap hari.
            </CardDescription>
            <CardAction>
              <Badge variant="secondary">{formatRupiah(totalRevenue)}</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="revenueGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="var(--chart-1)"
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--chart-1)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--border)"
                  />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    dy={6}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={72}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickFormatter={(value) => formatRupiah(Number(value))}
                  />
                  <RechartsTooltip
                    cursor={{ stroke: "var(--border)", strokeDasharray: "3 3" }}
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      background: "var(--card)",
                      color: "var(--card-foreground)",
                      fontSize: 12,
                      boxShadow: "0 8px 24px rgb(0 0 0 / 0.08)",
                    }}
                    labelStyle={{ color: "var(--muted-foreground)", fontSize: 11 }}
                    formatter={(value) => [
                      formatRupiah(Number(value)),
                      "Pendapatan",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="var(--chart-1)"
                    strokeWidth={2.5}
                    fill="url(#revenueGradient)"
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              <p>
                Grafik terisi otomatis dari pembayaran order yang dicatat pada
                menu transaksi.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Status Sistem</CardTitle>
              <CardDescription>Pemeriksaan fondasi aplikasi.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <StatusRow
                icon={Database}
                label="Database SQLite"
                value={
                  bootstrap.isSuccess ? "Terhubung & siap" : "Menghubungkan…"
                }
                ok={bootstrap.isSuccess}
              />
              <StatusRow
                icon={Store}
                label="Profil usaha"
                value={profile?.business_name ?? "Belum diatur"}
                ok={Boolean(profile)}
              />
              <StatusRow
                icon={Sparkles}
                label="Master layanan"
                value={`${activeServices} aktif dari ${totalServices} layanan`}
                ok={totalServices > 0}
              />
              <StatusRow
                icon={ShieldCheck}
                label="Versi aplikasi"
                value={`LaundryKu v${appInfo.data?.version ?? __APP_VERSION__}`}
                ok={Boolean(appInfo.data)}
              />
              <Separator />
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Lokasi database
                </p>
                <p className="mt-1 break-all font-mono text-[10px] leading-relaxed text-muted-foreground">
                  {appInfo.data?.dbPath ?? "Memuat…"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="pb-2 pt-5">
              <CardTitle>Akses Cepat</CardTitle>
              <CardDescription>Menu yang sering dipakai.</CardDescription>
            </CardHeader>
            <CardContent className="pb-3">
              {visibleQuickAccess.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-accent"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted ring-1 ring-inset ring-border/60">
                      <Icon className={cn("size-4", item.color)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground">
                        {item.title}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
