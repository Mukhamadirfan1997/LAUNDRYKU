import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import {
  Download,
  FolderOpen,
  HardDrive,
  History,
  Loader2,
  RotateCcw,
  ShieldAlert,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/features/auth/auth-store";
import { getErrorMessage, isTauriRuntime } from "@/lib/api";
import {
  notifyFileSaved,
  openSavedFile,
  revealSavedFile,
  saveFileWithDialog,
} from "@/lib/export";
import {
  formatFileSize,
  formatTanggalWaktu,
  todayIso,
} from "@/lib/format";

import {
  discardDatabaseBackupRequest,
  finalizeDatabaseBackupRequest,
  prepareDatabaseBackupRequest,
  restoreDatabaseRequest,
} from "./settings-api";
import {
  fetchDatabaseInfo,
  fetchRecentBackups,
  settingsActivityLogsQueryKey,
  settingsDatabaseInfoQueryKey,
  settingsRecentBackupsQueryKey,
} from "./settings-queries";

function backupFileName(): string {
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, "0")}${String(
    now.getMinutes(),
  ).padStart(2, "0")}`;
  return `LaundryKu-Backup-${todayIso()}-${time}.db`;
}

export function BackupSettingsTab() {
  const token = useAuthStore((state) => state.token);
  const clearSession = useAuthStore((state) => state.clearSession);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [restoreCandidate, setRestoreCandidate] = useState<string | null>(null);
  const [choosingRestore, setChoosingRestore] = useState(false);

  const databaseInfoQuery = useQuery({
    queryKey: settingsDatabaseInfoQueryKey,
    queryFn: fetchDatabaseInfo,
  });

  const recentBackupsQuery = useQuery({
    queryKey: settingsRecentBackupsQueryKey,
    queryFn: fetchRecentBackups,
  });

  const backupMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("Sesi berakhir.");
      if (!isTauriRuntime()) {
        throw new Error(
          "Backup hanya tersedia saat aplikasi dijalankan melalui LaundryKu desktop.",
        );
      }

      const snapshot = await prepareDatabaseBackupRequest(token);
      let finalized = false;

      try {
        const contents = await readFile(snapshot.path);
        const target = await saveFileWithDialog(contents, {
          defaultFileName: backupFileName(),
          filters: [{ name: "Database LaundryKu", extensions: ["db"] }],
        });

        if (!target) return null;

        const result = await finalizeDatabaseBackupRequest(
          token,
          snapshot.path,
          target,
        );
        finalized = true;
        return result;
      } finally {
        if (!finalized) {
          await discardDatabaseBackupRequest(token, snapshot.path).catch(() => {
            // File sementara akan dibersihkan saat aplikasi ditutup bila gagal.
          });
        }
      }
    },
    onSuccess: async (result) => {
      if (!result) return;

      toast.success("Cadangan database berhasil disimpan.", {
        description: result.fileName,
        action: {
          label: "Buka folder",
          onClick: () => {
            void revealSavedFile(result.path).catch(() => {
              toast.error("Folder cadangan tidak dapat dibuka otomatis.");
            });
          },
        },
        cancel: {
          label: "Buka file",
          onClick: () => {
            void openSavedFile(result.path).catch(() => {
              toast.error("File cadangan tidak dapat dibuka otomatis.");
            });
          },
        },
      });

      void notifyFileSaved(
        "Cadangan LaundryKu tersimpan",
        `${result.fileName} • ${result.path}`,
      );

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: settingsActivityLogsQueryKey,
        }),
        queryClient.invalidateQueries({
          queryKey: settingsRecentBackupsQueryKey,
        }),
        queryClient.invalidateQueries({
          queryKey: settingsDatabaseInfoQueryKey,
        }),
      ]);
    },
    onError: (error) => {
      toast.error(
        getErrorMessage(
          error,
          "Gagal membuat cadangan database. Silakan coba lagi.",
        ),
      );
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (path: string) => {
      if (!token) throw new Error("Sesi berakhir.");
      return restoreDatabaseRequest(token, path);
    },
    onSuccess: (result) => {
      setRestoreCandidate(null);
      toast.success("Database berhasil dipulihkan.", {
        description: `${result.users} akun, ${result.orders} order, ${result.expenses} pengeluaran. Silakan login kembali.`,
        duration: 8000,
      });
      queryClient.clear();
      clearSession();
      void navigate({ to: "/login", replace: true });
    },
    onError: (error) => {
      setRestoreCandidate(null);
      toast.error(
        getErrorMessage(
          error,
          "Gagal memulihkan database. File lama tetap digunakan.",
        ),
      );
    },
  });

  const handleChooseRestoreFile = async (): Promise<void> => {
    if (!isTauriRuntime()) {
      toast.error("Restore hanya tersedia di aplikasi desktop LaundryKu.");
      return;
    }

    setChoosingRestore(true);
    try {
      const selected = await open({
        title: "Pilih File Cadangan Database LaundryKu",
        multiple: false,
        directory: false,
        filters: [{ name: "Database LaundryKu", extensions: ["db"] }],
      });

      if (typeof selected === "string") {
        setRestoreCandidate(selected);
      }
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Gagal membuka dialog file cadangan."),
      );
    } finally {
      setChoosingRestore(false);
    }
  };

  const recentBackups = recentBackupsQuery.data ?? [];

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.72fr)]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="size-4 text-primary" />
              Cadangkan Database
            </CardTitle>
            <CardDescription>
              Simpan salinan seluruh data LaundryKu ke file <code>.db</code>.
              Simpan file di tempat yang aman.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/30 px-3.5 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground">
                    Database aktif
                  </p>
                  <p
                    className="mt-0.5 break-all text-[11px] text-muted-foreground"
                    title={databaseInfoQuery.data?.path}
                  >
                    {databaseInfoQuery.data?.path ?? "Memuat lokasi database..."}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0">
                  {databaseInfoQuery.data
                    ? formatFileSize(databaseInfoQuery.data.sizeBytes)
                    : "—"}
                </Badge>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3.5 py-3 text-xs text-amber-800 dark:text-amber-300">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <p className="leading-relaxed">
                File cadangan berisi seluruh data usaha, akun, dan riwayat
                transaksi. Jangan bagikan file ini kepada orang yang tidak
                berwenang.
              </p>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => backupMutation.mutate()}
                disabled={backupMutation.isPending}
              >
                {backupMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                {backupMutation.isPending
                  ? "Membuat Cadangan..."
                  : "Simpan Cadangan"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="size-4 text-destructive" />
              Pulihkan Database
            </CardTitle>
            <CardDescription>
              Ganti seluruh data saat ini dengan data dari file cadangan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-2.5 rounded-lg border border-destructive/25 bg-destructive/10 px-3.5 py-3 text-xs text-destructive">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <div className="space-y-1 leading-relaxed">
                <p className="font-medium">Tindakan ini tidak dapat dibatalkan.</p>
                <p>
                  Data yang ada sekarang akan diganti oleh isi file cadangan.
                  Semua sesi login akan diakhiri dan Anda perlu login kembali.
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                variant="destructive"
                onClick={() => void handleChooseRestoreFile()}
                disabled={choosingRestore || restoreMutation.isPending}
              >
                {choosingRestore ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                {choosingRestore
                  ? "Membuka File..."
                  : "Pilih File Cadangan"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="size-4 text-primary" />
            Riwayat Backup
          </CardTitle>
          <CardDescription>
            Aktivitas backup dan restore terakhir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentBackupsQuery.isLoading ? (
            <div className="space-y-3">
              <div className="h-12 animate-pulse rounded-lg bg-muted" />
              <div className="h-12 animate-pulse rounded-lg bg-muted" />
            </div>
          ) : recentBackups.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <HardDrive className="size-8 text-muted-foreground/60" />
              <p className="text-sm font-medium">Belum ada riwayat backup</p>
              <p className="max-w-[220px] text-xs text-muted-foreground">
                Aktivitas backup dan restore akan muncul di sini.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentBackups.map((log, idx) => (
                <div key={log.id}>
                  {idx > 0 ? <Separator className="mb-3" /> : null}
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 rounded-md border bg-muted/40 p-1.5">
                      {log.action === "restore" ? (
                        <RotateCcw className="size-3.5 text-destructive" />
                      ) : (
                        <Download className="size-3.5 text-primary" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-foreground">
                          {log.action === "restore" ? "Restore" : "Backup"}
                        </p>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {formatTanggalWaktu(log.created_at)}
                        </span>
                      </div>
                      <p className="mt-0.5 break-words text-[11px] leading-relaxed text-muted-foreground">
                        {log.description}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        oleh @{log.user_name || "sistem"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 border-t pt-3">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <FolderOpen className="size-3.5" />
              <span>Gunakan dialog Save As untuk memilih lokasi file.</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={restoreCandidate !== null}
        onOpenChange={(open) => {
          if (!open) setRestoreCandidate(null);
        }}
        title="Pulihkan Database?"
        description={`Seluruh data saat ini akan diganti dengan data dari file:\n\n${
          restoreCandidate ?? ""
        }\n\nPastikan file cadangan berasal dari LaundryKu dan berisi data yang ingin dipulihkan.`}
        confirmLabel="Restore Data"
        pendingLabel="Memulihkan..."
        isPending={restoreMutation.isPending}
        onConfirm={() => {
          if (restoreCandidate) restoreMutation.mutate(restoreCandidate);
        }}
      />
    </div>
  );
}
