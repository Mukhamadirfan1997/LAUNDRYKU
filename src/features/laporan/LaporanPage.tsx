import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Info,
  Loader2,
  RefreshCw,
  Scale,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/PageHeader";
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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/features/auth/auth-store";
import { getErrorMessage } from "@/lib/api";
import {
  formatAngka,
  formatRupiah,
  formatTanggal,
  toIsoDate,
} from "@/lib/format";
import {
  notifyFileSaved,
  openSavedFile,
  revealSavedFile,
  saveFileWithDialog,
} from "@/lib/export";
import { buildReportExcel } from "@/lib/report-excel";
import { buildReportPdf } from "@/lib/report-pdf";
import { cn } from "@/lib/utils";

import { logReportExportRequest } from "./report-api";
import {
  buildReportPeriod,
  fetchReportData,
  reportsQueryKey,
} from "./report-queries";
import type { ReportMode } from "./types";

const compactNumber = new Intl.NumberFormat("id-ID", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatRupiahCompact(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "Rp 0";
  return `Rp ${compactNumber.format(value)}`;
}

type ExportKind = "pdf" | "excel";

function ReportSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

export function LaporanPage() {
  const token = useAuthStore((state) => state.token);
  const now = new Date();
  const [mode, setMode] = useState<ReportMode>("monthly");
  const [month, setMonth] = useState(() => toIsoDate(now).slice(0, 7));
  const [year, setYear] = useState(() => now.getFullYear());
  const [exporting, setExporting] = useState<ExportKind | null>(null);

  const period = useMemo(
    () => buildReportPeriod(mode, month, year),
    [mode, month, year],
  );

  const reportQuery = useQuery({
    queryKey: [
      ...reportsQueryKey,
      mode,
      mode === "monthly" ? month : String(year),
    ],
    queryFn: () => {
      if (!period) {
        throw new Error("Periode laporan tidak valid.");
      }
      return fetchReportData(period);
    },
    enabled: period !== null,
  });

  const data = reportQuery.data;
  const isLoading = reportQuery.isLoading;
  const isExporting = exporting !== null;

  const handleExport = async (kind: ExportKind): Promise<void> => {
    if (!data || !token) {
      toast.error("Laporan belum siap diekspor.");
      return;
    }

    setExporting(kind);

    try {
      const result =
        kind === "pdf"
          ? buildReportPdf(data)
          : await buildReportExcel(data);
      const path = await saveFileWithDialog(result.bytes, {
        defaultFileName: result.fileName,
        filters:
          kind === "pdf"
            ? [{ name: "Berkas PDF", extensions: ["pdf"] }]
            : [{ name: "Berkas Excel", extensions: ["xlsx"] }],
      });

      if (!path) return;

      toast.success(
        `Laporan ${kind === "pdf" ? "PDF" : "Excel"} berhasil disimpan.`,
        {
          description: result.fileName,
          action: {
            label: "Buka file",
            onClick: () => {
              void openSavedFile(path).catch(() => {
                toast.error(
                  "File tersimpan, tetapi tidak dapat dibuka otomatis.",
                );
              });
            },
          },
          cancel: {
            label: "Buka folder",
            onClick: () => {
              void revealSavedFile(path).catch(() => {
                toast.error("Folder file tidak dapat dibuka otomatis.");
              });
            },
          },
        },
      );
      void notifyFileSaved(
        "Laporan LaundryKu tersimpan",
        `${result.fileName} • ${path}`,
      );

      try {
        await logReportExportRequest(token, {
          reportType: data.modeLabel,
          periodLabel: data.periodLabel,
          format: kind === "pdf" ? "PDF" : "Excel",
        });
      } catch (error) {
        console.warn("Gagal mencatat log ekspor laporan:", error);
      }
    } catch (error) {
      toast.error(
        getErrorMessage(
          error,
          "Gagal mengekspor laporan. Silakan coba lagi.",
        ),
      );
    } finally {
      setExporting(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Laporan"
        description="Ringkasan operasional, pendapatan, pengeluaran, dan saldo dalam satu halaman."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => void handleExport("pdf")}
              disabled={!data || isExporting || isLoading}
            >
              {exporting === "pdf" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileText className="size-4" />
              )}
              Unduh PDF
            </Button>
            <Button
              onClick={() => void handleExport("excel")}
              disabled={!data || isExporting || isLoading}
            >
              {exporting === "excel" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="size-4" />
              )}
              Unduh Excel
            </Button>
          </>
        }
      />

      <Card className="mb-4 gap-0 py-0">
        <CardContent className="flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                Jenis laporan
              </p>
              <div className="inline-flex rounded-lg border bg-muted/40 p-1">
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "monthly" ? "default" : "ghost"}
                  className="h-7 px-3"
                  onClick={() => setMode("monthly")}
                >
                  Bulanan
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "yearly" ? "default" : "ghost"}
                  className="h-7 px-3"
                  onClick={() => setMode("yearly")}
                >
                  Tahunan
                </Button>
              </div>
            </div>

            {mode === "monthly" ? (
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  Bulan
                </p>
                <Input
                  type="month"
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                  className="w-[180px]"
                  aria-label="Pilih bulan laporan"
                />
              </div>
            ) : (
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  Tahun
                </p>
                <Input
                  type="number"
                  min={2000}
                  max={2100}
                  value={year}
                  onChange={(event) => setYear(Number(event.target.value))}
                  className="w-[120px]"
                  aria-label="Pilih tahun laporan"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarDays className="size-4 shrink-0" />
            {period ? (
              <span>
                {formatTanggal(period.startDate)} –{" "}
                {formatTanggal(period.endDate)}
              </span>
            ) : (
              <span className="text-destructive">
                Periode tidak valid. Periksa bulan atau tahun.
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <ReportSkeleton />
      ) : reportQuery.isError ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <Info className="size-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">
                Gagal memuat laporan
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {getErrorMessage(reportQuery.error)}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => void reportQuery.refetch()}
              disabled={reportQuery.isFetching}
            >
              <RefreshCw
                className={
                  reportQuery.isFetching ? "size-4 animate-spin" : "size-4"
                }
              />
              Coba lagi
            </Button>
          </CardContent>
        </Card>
      ) : data ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="gap-0 py-0">
              <CardContent className="flex items-start justify-between gap-3 p-5">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    Pendapatan diterima
                  </p>
                  <p className="mt-1 truncate text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                    {formatRupiah(data.revenue)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Dari pembayaran pada periode
                  </p>
                </div>
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 ring-1 ring-inset ring-emerald-500/15 dark:text-emerald-400">
                  <ArrowUpRight className="size-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="gap-0 py-0">
              <CardContent className="flex items-start justify-between gap-3 p-5">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    Pengeluaran
                  </p>
                  <p className="mt-1 truncate text-2xl font-bold tracking-tight text-red-600 dark:text-red-400">
                    {formatRupiah(data.expenseTotal)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Dari catatan pengeluaran
                  </p>
                </div>
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/15">
                  <ArrowDownRight className="size-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="gap-0 py-0">
              <CardContent className="flex items-start justify-between gap-3 p-5">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    Saldo
                  </p>
                  <p
                    className={cn(
                      "mt-1 truncate text-2xl font-bold tracking-tight",
                      data.balance < 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-cyan-700 dark:text-cyan-300",
                    )}
                  >
                    {formatRupiah(data.balance)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Pendapatan dikurangi pengeluaran
                  </p>
                </div>
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-700 ring-1 ring-inset ring-cyan-500/15 dark:text-cyan-300">
                  <Scale className="size-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="gap-0 py-0">
              <CardContent className="flex items-start justify-between gap-3 p-5">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    Jumlah order
                  </p>
                  <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
                    {data.orderCount}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {data.completedOrderCount} selesai
                  </p>
                </div>
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 ring-1 ring-inset ring-amber-500/15 dark:text-amber-400">
                  <ClipboardList className="size-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Tren Pendapatan & Pengeluaran</CardTitle>
                <CardDescription>
                  Perbandingan arus kas masuk dan keluar pada periode terpilih.
                </CardDescription>
                <CardAction>
                  <Badge
                    variant={data.balance < 0 ? "destructive" : "success"}
                  >
                    Saldo {formatRupiah(data.balance)}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={data.trend}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="var(--border)"
                      />
                      <XAxis
                        dataKey="axisLabel"
                        tickLine={false}
                        axisLine={false}
                        minTickGap={20}
                        tick={{
                          fontSize: 11,
                          fill: "var(--muted-foreground)",
                        }}
                        dy={6}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={78}
                        tick={{
                          fontSize: 11,
                          fill: "var(--muted-foreground)",
                        }}
                        tickFormatter={(value) =>
                          formatRupiahCompact(Number(value))
                        }
                      />
                      <RechartsTooltip
                        cursor={{
                          stroke: "var(--border)",
                          strokeDasharray: "3 3",
                        }}
                        contentStyle={{
                          borderRadius: 10,
                          border: "1px solid var(--border)",
                          background: "var(--card)",
                          color: "var(--card-foreground)",
                          fontSize: 12,
                          boxShadow: "0 8px 24px rgb(0 0 0 / 0.08)",
                        }}
                        labelStyle={{
                          color: "var(--muted-foreground)",
                          fontSize: 11,
                        }}
                        formatter={(value, name) => [
                          formatRupiah(Number(value)),
                          name === "revenue" ? "Pendapatan" : "Pengeluaran",
                        ]}
                      />
                      <Legend
                        verticalAlign="top"
                        align="right"
                        iconType="line"
                        wrapperStyle={{ fontSize: 11, paddingBottom: 10 }}
                        formatter={(value) =>
                          value === "revenue" ? "Pendapatan" : "Pengeluaran"
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="var(--chart-3)"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 5 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="expense"
                        stroke="var(--chart-5)"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  <p>
                    Pendapatan dihitung dari pembayaran yang diterima, bukan
                    nilai order. Pengeluaran mengikuti tanggal transaksi
                    pengeluaran.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ringkasan Operasional</CardTitle>
                <CardDescription>
                  Aktivitas laundry pada periode ini.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-3 border-b pb-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ClipboardList className="size-4" />
                    Jumlah order
                  </div>
                  <p className="font-semibold text-foreground">
                    {data.orderCount} order
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3 border-b pb-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <TrendingUp className="size-4" />
                    Order selesai
                  </div>
                  <p className="font-semibold text-foreground">
                    {data.completedOrderCount} order
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3 border-b pb-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Wallet className="size-4" />
                    Nilai order
                  </div>
                  <p className="font-semibold text-foreground">
                    {formatRupiah(data.orderValue)}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3 border-b pb-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Scale className="size-4" />
                    Item terjual
                  </div>
                  <p className="font-semibold text-foreground">
                    {formatAngka(data.itemQty)} qty
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="size-4" />
                    Baris item
                  </div>
                  <p className="font-semibold text-foreground">
                    {data.itemLineCount} baris
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Pengeluaran per Kategori</CardTitle>
              <CardDescription>
                Distribusi biaya operasional pada periode terpilih.
              </CardDescription>
              <CardAction>
                <Badge variant="secondary">
                  {formatRupiah(data.expenseTotal)}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent>
              {data.expenseCategories.length === 0 ? (
                <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                  Belum ada pengeluaran pada periode ini.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {data.expenseCategories.map((category) => (
                    <div key={category.categoryId}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate font-medium text-foreground">
                          {category.name}
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums text-foreground">
                          {formatRupiah(category.amount)}
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, category.percentage)}%`,
                            backgroundColor: "var(--chart-5)",
                          }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {category.percentage.toFixed(1)}% dari total
                        pengeluaran
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Pilih periode laporan yang valid untuk melihat ringkasan.
          </CardContent>
        </Card>
      )}
    </>
  );
}
